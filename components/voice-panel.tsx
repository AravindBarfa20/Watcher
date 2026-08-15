"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Headphones, Mic, MicOff, Send, ShieldCheck, Square, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { redlineApi } from "../lib/api";
import { scenarioForIncident } from "../lib/scenarios";
import type { Snapshot } from "../lib/types";

type VoiceState = "idle" | "connecting" | "listening" | "processing" | "responding";
type ToolCall = { name: string; callId: string; arguments: string };
type ResponseRequest = { instructions?: string };
type LiveEvent = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  delta?: string;
  transcript?: string;
  error?: { message?: string };
};

const activeResponseError = "active response in progress";

export function VoicePanel({ snapshot, onUpdate, onError }: { snapshot: Snapshot; onUpdate: (snapshot: Snapshot) => void; onError: (message: string) => void }) {
  const scenario=scenarioForIncident(snapshot.incident.id);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [engineerText, setEngineerText] = useState("");
  const [redlineText, setRedlineText] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [reason, setReason] = useState(`${scenario.actionLabel}. Deployment timing and the correlated failure signature support this action.`);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(false);

  const call = useRef<{ peer: RTCPeerConnection; stream: MediaStream; audio: HTMLAudioElement; channel: RTCDataChannel } | null>(null);
  const responseActive = useRef(false);
  const queuedResponse = useRef<ResponseRequest | null>(null);
  const pendingTool = useRef<ToolCall | null>(null);

  const stop = () => {
    call.current?.stream.getTracks().forEach(track => track.stop());
    call.current?.peer.close();
    call.current?.audio.remove();
    call.current = null;
    responseActive.current = false;
    queuedResponse.current = null;
    pendingTool.current = null;
    setVoiceState("idle");
    setMuted(false);
  };
  useEffect(() => stop, []);

  const requestResponse = (channel: RTCDataChannel, request: ResponseRequest = {}) => {
    if (channel.readyState !== "open") return;
    if (responseActive.current) {
      queuedResponse.current = request;
      return;
    }
    responseActive.current = true;
    channel.send(JSON.stringify({
      event_id: `redline_${crypto.randomUUID()}`,
      type: "response.create",
      ...(request.instructions ? { response: { instructions: request.instructions } } : {}),
    }));
  };

  const deliverToolResult = async (channel: RTCDataChannel, tool: ToolCall) => {
    let output: unknown;
    try {
      const response = await fetch(`/api/voice/tools/${tool.name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: tool.arguments,
      });
      output = await response.json();
      if (!response.ok) throw new Error("Evidence tool unavailable.");
    } catch {
      output = { error: "Evidence tool unavailable. State uncertainty explicitly." };
    }
    if (channel.readyState !== "open") return;
    channel.send(JSON.stringify({
      event_id: `redline_tool_${crypto.randomUUID()}`,
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: tool.callId, output: JSON.stringify(output) },
    }));
    requestResponse(channel);
  };

  const handleRealtimeEvent = async (channel: RTCDataChannel, event: LiveEvent) => {
    if (event.type === "response.created") {
      responseActive.current = true;
      setRedlineText("");
      setVoiceState("responding");
    }
    if (event.type === "input_audio_buffer.speech_started") setVoiceState("listening");
    if (event.type === "input_audio_buffer.speech_stopped") setVoiceState("processing");
    if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) setEngineerText(event.transcript);
    if (event.type === "response.output_audio_transcript.delta" && event.delta) {
      setVoiceState("responding");
      setRedlineText(current => current + event.delta);
    }
    if (event.type === "response.output_audio_transcript.done" && event.transcript) setRedlineText(event.transcript);
    if (event.type === "response.function_call_arguments.done" && event.name && event.call_id) {
      pendingTool.current = { name: event.name, callId: event.call_id, arguments: event.arguments ?? "{}" };
    }
    if (event.type === "response.cancelled") responseActive.current = false;
    if (event.type === "response.done") {
      responseActive.current = false;
      const tool = pendingTool.current;
      pendingTool.current = null;
      if (tool) {
        setVoiceState("processing");
        await deliverToolResult(channel, tool);
        return;
      }
      const queued = queuedResponse.current;
      queuedResponse.current = null;
      if (queued) requestResponse(channel, queued);
      else setVoiceState("listening");
    }
    if (event.type === "error") {
      const message = event.error?.message ?? "The voice session reported an error.";
      if (message.toLowerCase().includes(activeResponseError)) {
        // Keep the follow-up queued; response.done will safely release it.
        responseActive.current = true;
        queuedResponse.current ??= {};
        return;
      }
      onError(message);
    }
  };

  const start = async () => {
    try {
      setVoiceState("connecting");
      setEngineerText("");
      setRedlineText("");
      const response = await fetch("/api/voice/session", { method: "POST" });
      const token = await response.json() as { clientSecret?: string; error?: { message?: string } };
      if (!response.ok || !token.clientSecret) throw new Error(token.error?.message ?? "Could not create the voice briefing.");

      const peer = new RTCPeerConnection();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      stream.getTracks().forEach(track => peer.addTrack(track, stream));
      const audio = document.createElement("audio");
      audio.autoplay = true;
      peer.ontrack = event => { audio.srcObject = event.streams[0]; };
      const channel = peer.createDataChannel("oai-events");
      channel.onmessage = message => { void handleRealtimeEvent(channel, JSON.parse(message.data) as LiveEvent); };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const realtime = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: { Authorization: `Bearer ${token.clientSecret}`, "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!realtime.ok) throw new Error(`OpenAI Realtime connection failed (${realtime.status}).`);
      await peer.setRemoteDescription({ type: "answer", sdp: await realtime.text() });
      call.current = { peer, stream, audio, channel };
      channel.onopen = () => requestResponse(channel, { instructions: "Brief the incident commander in no more than three sentences, then invite one question." });
    } catch (error) {
      stop();
      onError(error instanceof Error ? error.message : "Voice connection failed.");
    }
  };

  const toggleMute = () => {
    const next = !muted;
    call.current?.stream.getAudioTracks().forEach(track => { track.enabled = !next; });
    setMuted(next);
  };
  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    try {
      const result = await redlineApi.question(question);
      setAnswer(result.answer);
      setSources(result.evidenceKinds);
      setQuestion("");
    } catch (error) { onError(error instanceof Error ? error.message : "Question failed."); }
    finally { setBusy(false); }
  };
  const decide = async (decision: "APPROVE" | "REJECT") => {
    setBusy(true);
    try {
      onUpdate(await redlineApi.authorize(decision, reason));
      setDialog(false);
      stop();
    } catch (error) { onError(error instanceof Error ? error.message : "Decision failed."); }
    finally { setBusy(false); }
  };

  const active = voiceState !== "idle" && voiceState !== "connecting";
  const status = voiceState === "idle" ? "Ready for interrogation" : voiceState === "connecting" ? "Establishing secure session" : voiceState === "listening" ? "Listening" : voiceState === "processing" ? "Checking grounded evidence" : "Responding";

  return <section className="panel voice-panel" id="oversight">
    <header className="panel-header"><div><span className="eyebrow">AGENT INTERROGATION</span><h2>Voice supervisor</h2><p>Ask about evidence and tradeoffs. The agent cannot authorize or execute actions.</p></div><div className="voice-controls">{active && <button className="icon-button bordered" onClick={toggleMute} aria-label={muted ? "Unmute microphone" : "Mute microphone"}>{muted ? <MicOff/> : <Mic/>}</button>}<button className={active ? "button secondary" : "button primary"} onClick={active ? stop : start} disabled={voiceState === "connecting" || !snapshot.voiceEnabled}>{active ? <><Square/>Stop</> : <><Headphones/>{voiceState === "connecting" ? "Connecting…" : "Start voice"}</>}</button></div></header>
    <div className="voice-status"><div className={`voice-orb ${voiceState}`}><Volume2/></div><div><b>{status}</b><span>{active ? "Speak naturally · interrupt anytime" : "Two-way speech through OpenAI Realtime"}</span></div><span className={`live-indicator ${active ? "active" : ""}`}>{active ? "LIVE" : "OFFLINE"}</span></div>
    <div className="transcript" aria-live="polite">{engineerText && <div><span>YOU</span><p>{engineerText}</p></div>}<AnimatePresence>{redlineText && <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}><span>REDLINE</span><p>{redlineText}</p></motion.div>}</AnimatePresence>{!engineerText && !redlineText && <p className="transcript-empty">Start voice or ask a typed question. Answers are limited to this incident’s persisted evidence.</p>}</div>
    <div className="typed-question"><input value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => event.key === "Enter" && ask()} aria-label="Ask an evidence question" placeholder="Why is rollback safer than waiting?"/><button onClick={ask} disabled={busy || !question.trim()} aria-label="Send question"><Send/></button></div>
    {answer && <div className="text-answer"><b>Grounded answer</b><p>{answer}</p><div>{sources.map(source => <span key={source}>{source}</span>)}</div></div>}
    <footer><div><ShieldCheck/><span><b>Human authority required</b> Voice is advisory and read-only.</span></div><button className="button danger" onClick={() => setDialog(true)}><Check/>Review authorization</button></footer>
    <Dialog.Root open={dialog} onOpenChange={setDialog}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="dialog-content"><div className="dialog-title-row"><div><span className="eyebrow">CONSEQUENTIAL ACTION</span><Dialog.Title>Authorize production rollback</Dialog.Title></div><Dialog.Close className="icon-button" aria-label="Close authorization"><X/></Dialog.Close></div><Dialog.Description>Review the exact scope and record an accountable decision. Approval expires five minutes after it is issued.</Dialog.Description><dl className="authorization-facts"><div><dt>Action</dt><dd>{scenario.actionLabel}</dd></div><div><dt>Target</dt><dd>{scenario.target}</dd></div><div><dt>Risk</dt><dd><span className="risk-high">HIGH</span> Brief service interruption</dd></div><div><dt>Confidence</dt><dd>93% evidence correlation</dd></div><div><dt>Scope</dt><dd>One deployment, {scenario.region}</dd></div><div><dt>Expiration</dt><dd>5 minutes after approval</dd></div></dl><label className="field-label" htmlFor="reason">Decision rationale</label><textarea id="reason" value={reason} onChange={event => setReason(event.target.value)}/><div className="dialog-actions"><button className="button secondary" onClick={() => decide("REJECT")} disabled={busy}>Reject action</button><button className="button danger" onClick={() => decide("APPROVE")} disabled={busy || reason.trim().length < 20}><Check/>{busy ? "Recording…" : "Authorize rollback"}</button></div><small className="authorization-note">This creates a signed, expiring authorization record. It does not execute the rollback.</small></Dialog.Content></Dialog.Portal></Dialog.Root>
  </section>;
}
