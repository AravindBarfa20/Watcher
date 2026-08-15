import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { apiError, requestId } from "../../../../lib/server/http";
import { getIncidentService } from "../../../../lib/server/runtime";
import { DomainError } from "../../../../server/services/incident-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const id = requestId(request);
  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new DomainError("VOICE_NOT_CONFIGURED", "Add OPENAI_API_KEY to .env and restart Redline.", 503);
    const snapshot = getIncidentService().snapshot();
    if (snapshot.incident.status !== "AWAITING_HUMAN") throw new DomainError("VOICE_NOT_READY", "Voice briefing becomes available when investigation requests human judgment.", 409);

    const evidenceSummary = snapshot.evidence.map(item => `${item.kind}: ${item.title}`).join("\n");
    const vocabulary=[snapshot.incident.service,snapshot.incident.deploymentVersion,...snapshot.evidence.map(item=>item.title)].join(", ");
    const instructions = `You are Redline, a calm senior incident commander speaking with Nadia Okafor.
The current incident is ${snapshot.incident.title}. Current impact: ${snapshot.incident.impact}.
Known evidence:\n${evidenceSummary}
Keep answers under 30 seconds unless asked for detail. Never invent facts. Use the read-only evidence tools before making a factual claim. Say when evidence is missing. You may explain and compare options, but you cannot authorize or execute a change. Ask Nadia to record the final decision in the Redline interface.`;

    const providerResponse = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": "redline-local-incident-commander",
      },
      body: JSON.stringify({ session: {
        type: "realtime",
        model: "gpt-realtime-2.1",
        instructions,
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
              language: "en",
              prompt: `Expect incident-response vocabulary including ${vocabulary}.`,
            },
            turn_detection: {
              type: "semantic_vad",
              eagerness: "medium",
              create_response: true,
              interrupt_response: true,
            },
            noise_reduction: { type: "near_field" },
          },
          output: { voice: "marin" },
        },
        tool_choice: "auto",
        tools: [
          { type: "function", name: "get_incident_context", description: "Read the current incident state and policy decision.", parameters: { type: "object", properties: {}, additionalProperties: false } },
          { type: "function", name: "get_evidence", description: "Read all grounded metric, deployment, and log evidence.", parameters: { type: "object", properties: {}, additionalProperties: false } },
          { type: "function", name: "compare_remediation_options", description: "Compare the supported rollback and wait options. This tool never executes changes.", parameters: { type: "object", properties: {}, additionalProperties: false } },
        ],
      } }),
    });

    if (!providerResponse.ok) {
      const providerRequestId = providerResponse.headers.get("x-request-id");
      console.error("Realtime client secret failed", { status: providerResponse.status, providerRequestId });
      throw new DomainError("VOICE_PROVIDER_ERROR", `OpenAI rejected the voice session (${providerResponse.status}). Check the API key, project access, and billing.`, 502);
    }
    const payload = await providerResponse.json() as { value?: string; expires_at?: number };
    if (!payload.value) throw new DomainError("VOICE_PROVIDER_ERROR", "OpenAI returned an invalid voice credential.", 502);
    return NextResponse.json({ clientSecret: payload.value, model: "gpt-realtime-2.1", expiresAt: payload.expires_at ?? null, voiceSessionId: `voice_${nanoid(10)}` });
  } catch (error) { return apiError(error, id); }
}
