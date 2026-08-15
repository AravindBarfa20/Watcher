import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { IncidentStatus } from "./types";

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

export const statusCopy: Record<IncidentStatus,string> = {
  HEALTHY:"Healthy", DETECTED:"Detected", INVESTIGATING:"Investigating",
  AWAITING_HUMAN:"Approval required", AUTHORIZED:"Authorized", EXECUTING:"Executing",
  VERIFYING:"Verifying", RESOLVED:"Resolved", FAILED:"Failed",
};

export function formatTime(value:string) {
  return new Intl.DateTimeFormat("en",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(value));
}
