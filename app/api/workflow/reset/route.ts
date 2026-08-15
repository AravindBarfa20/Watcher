import { apiError, requestId } from "../../../../lib/server/http";
import { getIncidentService } from "../../../../lib/server/runtime";
import { z } from "zod";
import { scenarioIds } from "../../../../lib/scenarios";

export const runtime = "nodejs";
const bodySchema=z.object({scenario:z.enum(scenarioIds).optional()});
export async function POST(request:Request) { const id=requestId(request);try{const raw=await request.text();const body=bodySchema.parse(raw?JSON.parse(raw):{});return Response.json(getIncidentService().reset(id,body.scenario));}catch(error){return apiError(error,id);} }
