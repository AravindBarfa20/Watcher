import { describe, expect, it } from "vitest";
import { evaluateRollback } from "../server/policy";
import type { Incident } from "../server/domain";

const incident: Incident = { id: "inc", service: "payment-service", title: "test", status: "AWAITING_HUMAN", severity: "SEV1", impact: "test", errorRate: 12, baselineErrorRate: .2, deploymentVersion: "v1", createdAt: "", updatedAt: "" };
describe("rollback policy", () => {
  it("requires human oversight for payment-service production rollback", () => { const result = evaluateRollback(incident); expect(result.allowed).toBe(true); expect(result.requiresHuman).toBe(true); expect(result.reasons.join(" ")).toContain("financial impact"); });
  it("blocks execution before human escalation", () => { expect(evaluateRollback({ ...incident, status: "INVESTIGATING" }).allowed).toBe(false); });
});
