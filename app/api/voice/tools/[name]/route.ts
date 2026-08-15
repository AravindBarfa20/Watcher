import { z } from "zod";
import { apiError, requestId } from "../../../../../lib/server/http";
import { getIncidentService } from "../../../../../lib/server/runtime";

export const runtime = "nodejs";
const toolName = z.enum(["get_incident_context", "get_evidence", "compare_remediation_options"]);

export async function POST(request: Request, context: { params: Promise<{ name: string }> }) {
  const id = requestId(request);
  try {
    const name = toolName.parse((await context.params).name);
    const snapshot = getIncidentService().snapshot();
    if (name === "get_incident_context") return Response.json({ incident: snapshot.incident, policy: snapshot.policy, authorization: snapshot.authorization });
    if (name === "get_evidence") return Response.json({ evidence: snapshot.evidence });
    return Response.json({ options: [
      { action:"ROLLBACK",recommendation:"recommended",risk:`production ${snapshot.incident.service} changes; explicit authorization required`,expectedOutcome:`restore known-good ${snapshot.incident.deploymentVersion} predecessor` },
      { action:"WAIT",recommendation:"not recommended",risk:`${snapshot.incident.impact} continues`,expectedOutcome:"no evidence of spontaneous recovery" },
    ] });
  } catch (error) { return apiError(error, id); }
}
