export const incidentStatuses = [
  "HEALTHY", "DETECTED", "INVESTIGATING", "AWAITING_HUMAN", "AUTHORIZED", "EXECUTING", "VERIFYING", "RESOLVED", "FAILED",
] as const;
export type IncidentStatus = (typeof incidentStatuses)[number];

export type Severity = "SEV1" | "SEV2" | "SEV3";
export type Decision = "APPROVE" | "REJECT" | "MODIFY" | "DEFER" | "MORE_INFO";
export type Actor = { id: string; name: string; role: "INCIDENT_COMMANDER" | "ENGINEER" | "VIEWER" };

export interface Incident {
  id: string; service: string; title: string; status: IncidentStatus; severity: Severity;
  impact: string; errorRate: number; baselineErrorRate: number; deploymentVersion: string;
  createdAt: string; updatedAt: string;
}
export interface Evidence { id: string; kind: "METRIC" | "DEPLOYMENT" | "LOG" | "CORRELATION"; title: string; detail: string; confidence: number; source: string; createdAt: string; }
export interface TimelineEvent { id: string; type: string; title: string; detail: string; actor: string; createdAt: string; }
export interface Authorization { id: string; incidentId: string; action: "ROLLBACK"; target: string; decision: Decision; reason: string; actor: string; expiresAt: string; status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CONSUMED"; createdAt: string; }
export interface Action { id: string; type: "ROLLBACK"; target: string; status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED"; idempotencyKey: string; result: string | null; createdAt: string; completedAt: string | null; }
export interface IncidentSnapshot { incident: Incident; evidence: Evidence[]; timeline: TimelineEvent[]; authorization: Authorization | null; action: Action | null; policy: PolicyDecision | null; voiceEnabled: boolean; }
export interface PolicyDecision { allowed: boolean; requiresHuman: boolean; reasons: string[]; policyVersion: string; }

export const DEMO_ENGINEER: Actor = { id: "usr_nadia", name: "Nadia Okafor", role: "INCIDENT_COMMANDER" };
