export type IncidentStatus = "HEALTHY"|"DETECTED"|"INVESTIGATING"|"AWAITING_HUMAN"|"AUTHORIZED"|"EXECUTING"|"VERIFYING"|"RESOLVED"|"FAILED";
export interface Snapshot {
  incident: { id:string; service:string; title:string; status:IncidentStatus; severity:string; impact:string; errorRate:number; baselineErrorRate:number; deploymentVersion:string; createdAt:string };
  evidence: { id:string;kind:"METRIC"|"DEPLOYMENT"|"LOG"|"CORRELATION";title:string;detail:string;confidence:number;source:string }[];
  timeline: {id:string;type:string;title:string;detail:string;actor:string;createdAt:string}[];
  authorization: {id:string;decision:string;reason:string;actor:string;expiresAt:string;status:string;target:string}|null;
  action:{id:string;status:string;result:string|null;idempotencyKey:string}|null;
  policy:{allowed:boolean;requiresHuman:boolean;reasons:string[];policyVersion:string}|null;
  voiceEnabled:boolean;
}
