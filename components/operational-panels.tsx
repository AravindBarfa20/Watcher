"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, CheckCircle2, ChevronDown, CircleAlert, Clock3, Code2, FileSearch2, GitCommitHorizontal, History, TerminalSquare } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import type { Snapshot } from "../lib/types";
import { scenarioForIncident } from "../lib/scenarios";
import { cn, formatTime } from "../lib/ui";

export function MetricStrip({snapshot}:{snapshot:Snapshot}) {
  const {incident}=snapshot; const active=incident.status!=="HEALTHY"&&incident.status!=="RESOLVED";
  const scenario=scenarioForIncident(incident.id);
  const values=[
    ["Error rate",`${incident.errorRate.toFixed(2)}%`,`${active?"+":""}${(incident.errorRate-incident.baselineErrorRate).toFixed(2)} pp`,active?"danger":"good"],
    ["Failed operations",active?scenario.failedCount:"31",active?"last 5 minutes":"within baseline",active?"danger":"neutral"],
    ["Affected region",scenario.region,active?`${scenario.service} degraded`:"all routes normal","neutral"],
    ["Confidence",snapshot.evidence.length?"93%":"—",snapshot.evidence.length?"deployment correlated":"awaiting investigation",snapshot.evidence.length?"good":"neutral"],
  ];
  return <section className="metric-strip" aria-label="Incident metrics">{values.map(([label,value,note,tone])=><div key={label}><span>{label}</span><strong className={tone}>{value}</strong><small>{note}</small></div>)}</section>;
}

export function IncidentChart({snapshot}:{snapshot:Snapshot}) {
  const scenario=scenarioForIncident(snapshot.incident.id);
  const active=snapshot.incident.status!=="HEALTHY"&&snapshot.incident.status!=="RESOLVED";
  const resolved=snapshot.incident.status==="RESOLVED";
  const line=active?"M0 174 C110 173 180 170 238 169 C255 166 260 54 286 48 C362 38 440 44 600 42":resolved?"M0 174 C100 173 180 170 238 169 C255 166 260 54 286 48 C360 40 402 46 438 66 C460 94 480 159 600 169":"M0 172 C100 170 180 166 250 171 C350 175 430 165 600 169";
  const markers=active?[...["Deploy","Detect"]]:resolved?["Deploy","Detect","Rollback","Recovery"]:[];
  return <section className="panel chart-panel"><header className="panel-header"><div><span className="eyebrow">SERVICE HEALTH</span><h2>{scenario.metricLabel}</h2></div><div className={cn("chart-value",active&&"danger",resolved&&"good")}>{snapshot.incident.errorRate.toFixed(2)}%<small>5m error rate</small></div></header><div className="chart-wrap"><svg viewBox="0 0 600 210" preserveAspectRatio="none" role="img" aria-label={`${scenario.metricLabel} over time`}><path d="M0 175 H600 M0 105 H600 M0 35 H600" className="chart-grid"/><path d={line} className={cn("chart-line",active&&"danger",resolved&&"resolved")}/></svg>{markers.map((label,index)=><div key={label} className={cn("chart-marker",`marker-${index}`)}><i/><span>{label}</span></div>)}<div className="chart-axis"><span>14:00</span><span>14:03</span><span>now</span></div></div><footer className="chart-footer"><span>Baseline <b>{snapshot.incident.baselineErrorRate}%</b></span><span>Current <b>{snapshot.incident.errorRate.toFixed(2)}%</b></span><span>Version <b>{snapshot.incident.deploymentVersion}</b></span></footer></section>;
}

export function EvidencePanel({snapshot}:{snapshot:Snapshot}) {
  const [open,setOpen]=useState<string|null>(snapshot.evidence[0]?.id??null);
  return <section className="panel evidence-panel"><header className="panel-header"><div><span className="eyebrow">GROUNDED EVIDENCE</span><h2>Investigation findings</h2></div><span className="count">{snapshot.evidence.length}</span></header>{snapshot.evidence.length===0?<EmptyEvidence/>:<div className="evidence-list">{snapshot.evidence.map(item=><article key={item.id} className={cn("evidence-item",open===item.id&&"open")}><button onClick={()=>setOpen(open===item.id?null:item.id)} aria-expanded={open===item.id}><span className={cn("evidence-icon",item.kind.toLowerCase())}>{item.kind==="LOG"?<Code2/>:item.kind==="DEPLOYMENT"?<GitCommitHorizontal/>:<Activity/>}</span><span className="evidence-heading"><b>{item.title}</b><small>{item.source}</small></span><span className="confidence">{Math.round(item.confidence*100)}%</span><ChevronDown className="chevron"/></button><AnimatePresence initial={false}>{open===item.id&&<motion.div className="evidence-detail" initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}><p>{item.detail}</p><div><span>Source <b>{item.source}</b></span><span>Evidence ID <b>{item.id}</b></span><span>Confidence <b>{Math.round(item.confidence*100)}%</b></span></div></motion.div>}</AnimatePresence></article>)}</div>}</section>;
}

function EmptyEvidence(){return <div className="empty-state"><FileSearch2/><b>Investigation has not started</b><span>Metric, deployment, and log findings will appear here with source attribution.</span></div>}

export function InvestigationTimeline({snapshot}:{snapshot:Snapshot}) {
  const steps=["Monitoring baseline","Anomaly detection","Evidence assembly","Human oversight","Authorization","Verified recovery"];
  const progress={HEALTHY:0,DETECTED:1,INVESTIGATING:2,AWAITING_HUMAN:3,AUTHORIZED:4,EXECUTING:4,VERIFYING:5,RESOLVED:6,FAILED:4}[snapshot.incident.status];
  return <section className="workflow"><div className="workflow-track" style={{"--progress":`${progress/6*100}%`} as CSSProperties}/>{steps.map((step,index)=><div key={step} className={cn("workflow-step",index<progress&&"complete",index===progress&&"current")}><i>{index<progress?<CheckCircle2/>:index+1}</i><div><b>{step}</b><small>{index===3?"Incident commander":index===4?"Policy gateway":index===5?"Verification agent":"Redline agent"}</small></div></div>)}</section>;
}

export function ExecutionPanel({snapshot,onExecute,busy}:{snapshot:Snapshot;onExecute:()=>void;busy:boolean}) {
  const scenario=scenarioForIncident(snapshot.incident.id);
  const [now,setNow]=useState(Date.now());useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);const expired=snapshot.authorization?new Date(snapshot.authorization.expiresAt).getTime()<=now:false;
  if(snapshot.incident.status==="AUTHORIZED") return <section className="panel execution-ready"><div className="execution-icon"><TerminalSquare/></div><div><span className="eyebrow">ACTION GATEWAY</span><h2>{expired?"Authorization expired":"Authorization validated"}</h2><p>{expired?"Execution is locked. Re-open human review to issue a new decision.":`One idempotent rollback is permitted for ${scenario.target}.`}</p></div>{snapshot.authorization&&<Countdown expiresAt={snapshot.authorization.expiresAt}/>}<button className="button danger" onClick={onExecute} disabled={busy||expired}><CircleAlert/>{expired?"Execution locked":busy?"Executing…":scenario.actionLabel}</button></section>;
  if(snapshot.incident.status!=="RESOLVED") return null;
  return <section className="panel recovery-panel"><CheckCircle2/><div><span className="eyebrow">VERIFIED RECOVERY</span><h2>{scenario.service} recovered</h2><p>Error rate returned to {snapshot.incident.errorRate.toFixed(2)}% across three consecutive verification windows.</p></div>{snapshot.action&&<dl><div><dt>Action ID</dt><dd>{snapshot.action.id}</dd></div><div><dt>Idempotency key</dt><dd>{snapshot.action.idempotencyKey}</dd></div><div><dt>Actor</dt><dd>{snapshot.authorization?.actor}</dd></div></dl>}</section>;
}

export function AuditTimeline({snapshot}:{snapshot:Snapshot}) {return <section className="panel audit-timeline"><header className="panel-header"><div><span className="eyebrow">IMMUTABLE ACTIVITY</span><h2>Decision and execution log</h2></div><History/></header><div>{snapshot.timeline.map((event,index)=><article key={event.id}><i className={index===snapshot.timeline.length-1?"latest":""}/><time>{formatTime(event.createdAt)}</time><div><b>{event.title}</b><p>{event.detail}</p><small>{event.actor} · {event.type} · {event.id}</small></div></article>)}</div></section>}

export function Countdown({expiresAt}:{expiresAt:string}) {const [now,setNow]=useState(Date.now());useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);const seconds=Math.max(0,Math.floor((new Date(expiresAt).getTime()-now)/1000));return <span className={cn("countdown",seconds<60&&"urgent")}><Clock3/>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</span>}
