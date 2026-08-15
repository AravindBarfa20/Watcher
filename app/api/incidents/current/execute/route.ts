import { z } from "zod";
import { apiError, requestId } from "../../../../../lib/server/http";
import { getIncidentService } from "../../../../../lib/server/runtime";

export const runtime = "nodejs";
export async function POST(request: Request) { const id=requestId(request); try { const body=z.object({idempotencyKey:z.string().min(8).max(100).optional()}).parse(await request.json()); return Response.json(getIncidentService().execute(body.idempotencyKey,id)); } catch(error) { return apiError(error,id); } }
