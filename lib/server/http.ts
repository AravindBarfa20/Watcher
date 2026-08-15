import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "../../server/services/incident-service";

export function requestId(request: Request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export function apiError(error: unknown, id: string) {
  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, requestId: id } },
      { status: error.statusCode, headers: { "x-request-id": id } },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Please check the submitted information.", requestId: id } },
      { status: 400, headers: { "x-request-id": id } },
    );
  }
  console.error("Redline API error", { requestId: id, error });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Redline could not complete that operation. Try again or reset the incident.", requestId: id } },
    { status: 500, headers: { "x-request-id": id } },
  );
}
