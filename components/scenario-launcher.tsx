"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, BellRing, CreditCard, KeyRound, X } from "lucide-react";
import { scenarioList, type ScenarioId } from "../lib/scenarios";

const icons={"payment-routing":CreditCard,"auth-keys":KeyRound,"notification-queue":BellRing} as const;

export function ScenarioLauncher({open,onOpenChange,onRun,busy}:{open:boolean;onOpenChange:(open:boolean)=>void;onRun:(scenario:ScenarioId)=>void;busy:boolean}) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="scenario-dialog"><div className="dialog-title-row"><div><span className="eyebrow">LOCAL INCIDENT LAB</span><Dialog.Title>Run another incident</Dialog.Title></div><Dialog.Close className="icon-button" aria-label="Close scenario launcher"><X/></Dialog.Close></div><Dialog.Description>Choose a deterministic production scenario. Redline will detect it, assemble evidence, and stop before the consequential action.</Dialog.Description><div className="scenario-list">{scenarioList.map(item=>{const Icon=icons[item.id];return <button key={item.id} disabled={busy} onClick={()=>onRun(item.id)}><span className="scenario-icon"><Icon/></span><span><b>{item.title}</b><small>{item.service} · {item.region}</small></span><em>{item.severity}</em><ArrowRight/></button>})}</div><small className="scenario-note">Starting a scenario resets the current local incident state and audit trail.</small></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
