import { NextResponse } from "next/server";
import { getIncidentService } from "../../../../lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return NextResponse.json(getIncidentService().snapshot(), { headers: { "cache-control": "no-store" } }); }
