import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import { scenarios, type ScenarioId } from "../../lib/scenarios";
import type { Action, Authorization, Evidence, Incident, IncidentSnapshot, PolicyDecision, TimelineEvent } from "../domain";

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${nanoid(10)}`;
type IncidentRow = {
  id: string; service: string; title: string; status: Incident["status"]; severity: Incident["severity"]; impact: string;
  error_rate: number; baseline_error_rate: number; deployment_version: string; created_at: string; updated_at: string;
};

function asIncident(row: IncidentRow): Incident {
  return {
    id: row.id, service: row.service, title: row.title, status: row.status, severity: row.severity,
    impact: row.impact, errorRate: Number(row.error_rate), baselineErrorRate: Number(row.baseline_error_rate),
    deploymentVersion: row.deployment_version, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export class IncidentRepository {
  constructor(private readonly db: Database.Database) {}
  transaction<T>(fn: () => T): T { return this.db.transaction(fn)(); }

  reset(scenarioId:ScenarioId="payment-routing"): Incident {
    return this.transaction(() => {
      const scenario=scenarios[scenarioId];
      for (const table of ["audit_events", "agent_runs", "voice_sessions", "actions", "approvals", "policy_decisions", "hypotheses", "evidence", "incident_events", "incidents", "services", "users"]) this.db.prepare(`DELETE FROM ${table}`).run();
      const time = now();
      this.db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run("usr_nadia", "Nadia Okafor", "INCIDENT_COMMANDER", time);
      this.db.prepare("INSERT INTO services VALUES (?, ?, ?, ?)").run(scenario.serviceId, scenario.service, "production", time);
      const incident: Incident = { id:scenario.incidentId,service:scenario.service,title:scenario.title,status:"HEALTHY",severity:scenario.severity,impact:scenario.normalImpact,errorRate:scenario.healthyRate,baselineErrorRate:scenario.baselineRate,deploymentVersion:scenario.version,createdAt:time,updatedAt:time };
      this.db.prepare(`INSERT INTO incidents (id,service_id,title,status,severity,impact,error_rate,baseline_error_rate,deployment_version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(incident.id,scenario.serviceId,incident.title,incident.status,incident.severity,incident.impact,incident.errorRate,incident.baselineErrorRate,incident.deploymentVersion,time,time);
      this.event(incident.id,"SYSTEM","System baseline established",`${scenario.service} is operating within its ${scenario.baselineRate.toFixed(2)}% error-rate baseline.`,"Monitoring Agent");
      this.audit(incident.id,null,"scenario.reset",{scenario:scenario.id},"seed");
      return incident;
    });
  }

  get(id: string): Incident | null { const row = this.db.prepare(`SELECT i.*, s.name as service FROM incidents i JOIN services s ON s.id=i.service_id WHERE i.id=?`).get(id) as IncidentRow | undefined; return row ? asIncident(row) : null; }
  current(): Incident { const row=this.db.prepare(`SELECT i.*, s.name as service FROM incidents i JOIN services s ON s.id=i.service_id ORDER BY i.created_at DESC LIMIT 1`).get() as IncidentRow|undefined; return row?asIncident(row):this.reset(); }
  event(incidentId: string, type: string, title: string, detail: string, actor: string) { const time = now(); this.db.prepare("INSERT INTO incident_events VALUES (?, ?, ?, ?, ?, ?, ?)").run(id("evt"), incidentId, type, title, detail, actor, time); }
  audit(incidentId: string, actorId: string | null, action: string, metadata: unknown, requestId: string) { this.db.prepare("INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?)").run(id("audit"), incidentId, actorId, action, JSON.stringify(metadata), requestId, now()); }
  agent(incidentId: string, agent: string, summary: string, latency = 120) { this.db.prepare("INSERT INTO agent_runs VALUES (?, ?, ?, ?, ?, ?, ?)").run(id("run"), incidentId, agent, "COMPLETED", summary, latency, now()); }
  setIncident(incident: Incident, status: Incident["status"], patch: Partial<Pick<Incident, "impact" | "errorRate" | "deploymentVersion">> = {}) {
    const time = now(); this.db.prepare("UPDATE incidents SET status=?, impact=?, error_rate=?, deployment_version=?, updated_at=? WHERE id=?").run(status, patch.impact ?? incident.impact, patch.errorRate ?? incident.errorRate, patch.deploymentVersion ?? incident.deploymentVersion, time, incident.id);
  }
  addEvidence(incidentId: string, evidence: Omit<Evidence, "id" | "createdAt">) { this.db.prepare("INSERT INTO evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id("evd"), incidentId, evidence.kind, evidence.title, evidence.detail, evidence.confidence, evidence.source, now()); }
  policy(incidentId: string, decision: PolicyDecision) { this.db.prepare("INSERT INTO policy_decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id("pol"), incidentId, "ROLLBACK", Number(decision.allowed), Number(decision.requiresHuman), JSON.stringify(decision.reasons), decision.policyVersion, now()); }
  authorization(incidentId: string): Authorization | null { const row = this.db.prepare("SELECT a.*, u.name as actor FROM approvals a JOIN users u ON u.id=a.actor_id WHERE incident_id=? ORDER BY created_at DESC LIMIT 1").get(incidentId) as Record<string, unknown> | undefined; if (!row) return null; return { id: String(row.id), incidentId: String(row.incident_id), action: "ROLLBACK", target: String(row.target), decision: row.decision as Authorization["decision"], reason: String(row.reason), actor: String(row.actor), expiresAt: String(row.expires_at), status: row.status as Authorization["status"], createdAt: String(row.created_at) }; }
  action(incidentId: string): Action | null { const row = this.db.prepare("SELECT * FROM actions WHERE incident_id=? ORDER BY created_at DESC LIMIT 1").get(incidentId) as Record<string, unknown> | undefined; if (!row) return null; return { id: String(row.id), type: "ROLLBACK", target: String(row.target), status: row.status as Action["status"], idempotencyKey: String(row.idempotency_key), result: row.result ? String(row.result) : null, createdAt: String(row.created_at), completedAt: row.completed_at ? String(row.completed_at) : null }; }
  snapshot(voiceEnabled: boolean): IncidentSnapshot {
    const incident = this.current();
    const evidence = this.db.prepare("SELECT id,kind,title,detail,confidence,source,created_at as createdAt FROM evidence WHERE incident_id=? ORDER BY created_at DESC").all(incident.id) as Evidence[];
    const timeline = this.db.prepare("SELECT id,type,title,detail,actor,created_at as createdAt FROM incident_events WHERE incident_id=? ORDER BY created_at ASC").all(incident.id) as TimelineEvent[];
    const policyRow = this.db.prepare("SELECT * FROM policy_decisions WHERE incident_id=? ORDER BY created_at DESC LIMIT 1").get(incident.id) as Record<string, unknown> | undefined;
    const policy = policyRow ? { allowed: Boolean(policyRow.allowed), requiresHuman: Boolean(policyRow.requires_human), reasons: JSON.parse(String(policyRow.reasons)) as string[], policyVersion: String(policyRow.policy_version) } : null;
    return { incident, evidence, timeline, authorization: this.authorization(incident.id), action: this.action(incident.id), policy, voiceEnabled };
  }
  createApproval(incident:Incident, decision: "APPROVE" | "REJECT", reason: string) {
    const time = now(); const approvalId = id("apr"); const expires = new Date(Date.now() + 5 * 60_000).toISOString(); const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    this.db.prepare("INSERT INTO approvals VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(approvalId,incident.id,"usr_nadia","ROLLBACK",`${incident.service}@${incident.deploymentVersion}`,decision,reason,expires,status,time);
    return this.authorization(incident.id)!;
  }
  consumeApproval(authorizationId: string) { this.db.prepare("UPDATE approvals SET status='CONSUMED' WHERE id=?").run(authorizationId); }
  createAction(incident:Incident, authorizationId:string, key:string) { const existing=this.db.prepare("SELECT * FROM actions WHERE idempotency_key=?").get(key);if(existing)return this.action(incident.id)!;const time=now();this.db.prepare("INSERT INTO actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id("act"),incident.id,authorizationId,"ROLLBACK",incident.service,"RUNNING",key,null,time,null);return this.action(incident.id)!; }
  finishAction(incidentId: string, result: string) { this.db.prepare("UPDATE actions SET status='SUCCEEDED', result=?, completed_at=? WHERE incident_id=? AND status='RUNNING'").run(result, now(), incidentId); }
}
