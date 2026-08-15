import { NextResponse } from "next/server";

export const runtime = "nodejs";
export function GET() {
  return NextResponse.json({ status: "ok", database: "sqlite", voice: Boolean(process.env.OPENAI_API_KEY?.trim()) });
}
