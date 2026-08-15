import { z } from "zod";
import { apiError, requestId } from "../../../../../lib/server/http";
import { getIncidentService } from "../../../../../lib/server/runtime";

export const runtime = "nodejs";
export async function POST(request: Request) { const id=requestId(request); try { const body=z.object({decision:z.enum(["APPROVE","REJECT"]),reason:z.string().trim().min(3).max(500)}).parse(await request.json()); return Response.json(getIncidentService().authorize(body.decision,body.reason,id)); } catch(error) { return apiError(error,id); } }
