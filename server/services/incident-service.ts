import { nanoid } from "nanoid";
import type { IncidentSnapshot } from "../domain";
import { evaluateRollback } from "../policy";
import { IncidentRepository } from "../db/repository";
import { scenarioForIncident, type ScenarioId } from "../../lib/scenarios";

export class DomainError extends Error { constructor(public readonly code: string, message: string, public readonly statusCode = 400) { super(message); } }

export class IncidentService {
  constructor(private readonly repo: IncidentRepository, private readonly voiceEnabled: boolean) {}
  snapshot() { return this.repo.snapshot(this.voiceEnabled); }
  reset(requestId:string,scenarioId:ScenarioId="payment-routing") { const incident=this.repo.reset(scenarioId);this.repo.audit(incident.id,"usr_nadia","scenario.reset",{scenarioId},requestId);return this.snapshot(); }

  advance(requestId: string): IncidentSnapshot {
    return this.repo.transaction(() => {
      const incident = this.repo.current();
      const scenario=scenarioForIncident(incident.id);
      if (incident.status === "HEALTHY") {
        this.repo.setIncident(incident,"DETECTED",{impact:scenario.detectedImpact,errorRate:scenario.detectedRate});
        this.repo.event(incident.id,"ANOMALY","Error budget breach detected",`5-minute error rate rose from ${scenario.healthyRate}% to ${scenario.detectedRate}%, exceeding the service threshold.`,"Monitoring Agent");
        this.repo.agent(incident.id,"Monitoring Agent",`Detected ${scenario.service} error-rate anomaly`,83);
      } else if (incident.status === "DETECTED") {
        this.repo.setIncident(incident, "INVESTIGATING");
        scenario.evidence.forEach(finding=>this.repo.addEvidence(incident.id,finding));
        this.repo.event(incident.id,"INVESTIGATION","Investigation linked spike to deployment",scenario.investigation,"Investigation Agent");
        this.repo.agent(incident.id, "Investigation Agent", "Correlated deploy, metric inflection, and new error signature", 612);
      } else if (incident.status === "INVESTIGATING") {
        const policy = evaluateRollback(incident); this.repo.policy(incident.id, policy);
        this.repo.setIncident(incident, "AWAITING_HUMAN");
        this.repo.event(incident.id,"ESCALATION","Human judgment required",scenario.escalation,"Supervisor Agent");
        this.repo.agent(incident.id, "Supervisor Agent", "Recommended rollback; created a human-required policy decision", 171);
      } else throw new DomainError("INVALID_TRANSITION", `Cannot advance demo while incident is ${incident.status}.`, 409);
      this.repo.audit(incident.id,"usr_nadia","scenario.advance",{from:incident.status,scenario:scenario.id},requestId);
      return this.snapshot();
    });
  }

  answer(question: string, requestId: string) {
    const incident = this.repo.current();
    const scenario=scenarioForIncident(incident.id);
    if (incident.status !== "AWAITING_HUMAN" && incident.status !== "AUTHORIZED") throw new DomainError("INCIDENT_NOT_READY", "Investigation must reach human escalation before interrogation.", 409);
    const q = question.toLowerCase();
    let answer: string; let evidenceIds: string[];
    if (/(why|deploy|cause|changed)/.test(q)) { answer=scenario.causeAnswer;evidenceIds=["DEPLOYMENT","LOG","METRIC"]; }
    else if (/(risk|blast|rollback|option)/.test(q)) { answer=scenario.riskAnswer;evidenceIds=["DEPLOYMENT","LOG"]; }
    else if (/(nothing|wait|impact)/.test(q)) { answer=scenario.waitAnswer;evidenceIds=["METRIC"]; }
    else { answer=`I can only support claims with this incident’s persisted evidence. ${scenario.investigation} I do not have evidence for explanations outside the collected metric, deployment, and log sources.`;evidenceIds=["METRIC","DEPLOYMENT","LOG"]; }
    this.repo.event(incident.id, "VOICE_QA", "Engineer interrogated incident evidence", question, "Voice Supervisor Agent");
    this.repo.audit(incident.id, "usr_nadia", "voice.grounded_answer", { evidenceKinds: evidenceIds }, requestId);
    return { answer, evidenceKinds: evidenceIds };
  }

  authorize(decision: "APPROVE" | "REJECT", reason: string, requestId: string) {
    return this.repo.transaction(() => {
      const incident = this.repo.current();
      if (incident.status !== "AWAITING_HUMAN") throw new DomainError("INVALID_TRANSITION", "This incident is not awaiting a human decision.", 409);
      const policy = evaluateRollback(incident); this.repo.policy(incident.id, policy);
      if (!policy.allowed || !policy.requiresHuman) throw new DomainError("POLICY_DENIED", "Rollback policy denied authorization.", 403);
      const approval = this.repo.createApproval(incident,decision,reason);
      if (decision === "APPROVE") { this.repo.setIncident(incident, "AUTHORIZED"); this.repo.event(incident.id, "AUTHORIZATION", "Rollback authorized by Nadia Okafor", reason, "Nadia Okafor"); }
      else { this.repo.event(incident.id, "AUTHORIZATION", "Rollback rejected by Nadia Okafor", reason, "Nadia Okafor"); }
      this.repo.audit(incident.id, "usr_nadia", "authorization.created", { decision, approvalId: approval.id }, requestId);
      return this.snapshot();
    });
  }

  execute(idempotencyKey: string | undefined, requestId: string) {
    return this.repo.transaction(() => {
      const incident=this.repo.current();const scenario=scenarioForIncident(incident.id);const authorization=this.repo.authorization(incident.id);
      if (incident.status !== "AUTHORIZED") throw new DomainError("INVALID_TRANSITION", "A current authorization is required before execution.", 409);
      if (!authorization || authorization.status !== "APPROVED" || new Date(authorization.expiresAt) <= new Date()) throw new DomainError("AUTHORIZATION_INVALID", "Authorization is missing, expired, or no longer valid.", 403);
      const key=idempotencyKey??`scenario-${nanoid()}`;
      this.repo.setIncident(incident,"EXECUTING");this.repo.createAction(incident,authorization.id,key);
      this.repo.event(incident.id,"ACTION","Rollback executed through controlled gateway",`Restoring ${scenario.service} version ${scenario.rollbackVersion}. Idempotency key recorded.`,"Action Agent");
      this.repo.agent(incident.id, "Action Agent", "Validated authorization, policy, target, and idempotency before rollback", 289);
      this.repo.consumeApproval(authorization.id);
      const executing=this.repo.current();this.repo.setIncident(executing,"VERIFYING");this.repo.finishAction(incident.id,`Rollback completed: ${scenario.service}@${scenario.rollbackVersion} is healthy.`);
      this.repo.event(incident.id,"VERIFICATION","Recovery verified",`Error rate returned to ${scenario.recoveryRate}% for three consecutive windows and the correlated failure signature stopped.`,"Verification Agent");
      this.repo.agent(incident.id, "Verification Agent", "Compared post-rollback metrics against baseline and verified recovery", 544);
      const verifying=this.repo.current();this.repo.setIncident(verifying,"RESOLVED",{impact:`${scenario.shortTitle} recovered`,errorRate:scenario.recoveryRate,deploymentVersion:scenario.rollbackVersion});
      this.repo.event(incident.id,"RESOLVED","Incident resolved",`Recovery verified after controlled rollback of ${scenario.service}. Follow-up engineering work has been recorded.`,"Supervisor Agent");
      this.repo.audit(incident.id, "usr_nadia", "action.executed", { action: "ROLLBACK", idempotencyKey: key }, requestId);
      return this.snapshot();
    });
  }
}
