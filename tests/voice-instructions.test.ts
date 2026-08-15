import { describe, expect, it } from "vitest";
import { buildVoiceInstructions } from "../lib/voice-instructions";

describe("voice operating contract", () => {
  const prompt = buildVoiceInstructions({
    title: "Payment authorization failures after deploy",
    impact: "Checkout is degraded",
    service: "payment-service",
    deploymentVersion: "2026.08.15-rc3",
    evidenceSummary: "DEPLOYMENT: release correlated with failures",
  });

  it("keeps the assistant in the incident-response domain", () => {
    expect(prompt).toContain("Discuss only this incident");
    expect(prompt).toContain("Never invent telemetry");
    expect(prompt).toContain("cannot authorize, execute, deploy, roll back");
  });

  it("explicitly rejects entertainment and music behavior", () => {
    expect(prompt).toContain("Do not sing, hum, rhyme");
    expect(prompt).toContain("incident supervisor");
  });
});
