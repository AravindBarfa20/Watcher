import type { Incident, PolicyDecision } from "./domain";

export function evaluateRollback(incident: Incident): PolicyDecision {
  const reasons = ["Production rollback is a consequential change."];
  if (incident.service === "payment-service") reasons.push("Payment processing has financial impact.");
  if (incident.status !== "AWAITING_HUMAN" && incident.status !== "AUTHORIZED") reasons.push(`Rollback not executable while incident is ${incident.status}.`);
  return { allowed: incident.status === "AWAITING_HUMAN" || incident.status === "AUTHORIZED", requiresHuman: true, reasons, policyVersion: "redline-policy/1.0" };
}
