import type { Snapshot } from "./types";
import type { ScenarioId } from "./scenarios";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json() as T & { error?: { message?: string; requestId?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body;
}

export const redlineApi = {
  snapshot: () => request<Snapshot>("/api/incidents/current"),
  reset: (scenario?:ScenarioId) => request<Snapshot>("/api/workflow/reset", { method:"POST",body:JSON.stringify({scenario}) }),
  advance: () => request<Snapshot>("/api/workflow/advance", { method: "POST" }),
  question: (question:string) => request<{answer:string;evidenceKinds:string[]}>("/api/incidents/current/question", { method:"POST", body:JSON.stringify({question}) }),
  authorize: (decision:"APPROVE"|"REJECT", reason:string) => request<Snapshot>("/api/incidents/current/authorization", { method:"POST", body:JSON.stringify({decision,reason}) }),
  execute: () => request<Snapshot>("/api/incidents/current/execute", { method:"POST", body:JSON.stringify({idempotencyKey:crypto.randomUUID()}) }),
};
