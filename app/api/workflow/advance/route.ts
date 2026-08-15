import { apiError, requestId } from "../../../../lib/server/http";
import { getIncidentService } from "../../../../lib/server/runtime";

export const runtime = "nodejs";
export async function POST(request: Request) { const id=requestId(request); try { return Response.json(getIncidentService().advance(id)); } catch(error) { return apiError(error,id); } }
