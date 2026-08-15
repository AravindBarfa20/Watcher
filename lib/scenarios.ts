export const scenarioIds = ["payment-routing", "auth-keys", "notification-queue"] as const;
export type ScenarioId = (typeof scenarioIds)[number];

type Finding = { kind:"METRIC"|"DEPLOYMENT"|"LOG"; title:string; detail:string; confidence:number; source:string };
export type IncidentScenario = {
  id:ScenarioId; incidentId:string; serviceId:string; service:string; topologyNode:string;
  title:string; shortTitle:string; severity:"SEV1"|"SEV2"; region:string;
  normalImpact:string; detectedImpact:string; healthyRate:number; detectedRate:number; baselineRate:number;
  failedCount:string; version:string; rollbackVersion:string; actionLabel:string; target:string;
  metricLabel:string; recoveryRate:number; evidence:Finding[];
  investigation:string; escalation:string; causeAnswer:string; riskAnswer:string; waitAnswer:string;
};

export const scenarios:Record<ScenarioId,IncidentScenario> = {
  "payment-routing": {
    id:"payment-routing",incidentId:"inc_payments_001",serviceId:"svc_payments",service:"payment-service",topologyNode:"payment",
    title:"Payment authorization failures after deploy",shortTitle:"Payment routing failure",severity:"SEV1",region:"us-east-1",
    normalImpact:"Checkout availability normal",detectedImpact:"12.4% payment authorization failures in us-east-1",healthyRate:.18,detectedRate:12.4,baselineRate:.2,failedCount:"1,842",
    version:"2026.08.15-rc3",rollbackVersion:"2026.08.14-rc9",actionLabel:"Rollback issuer-routing release",target:"payment-service / production",metricLabel:"Payment authorization error rate",recoveryRate:.21,
    evidence:[
      {kind:"METRIC",title:"Authorization errors began at 14:03 UTC",detail:"5xx authorization failures rose to 12.4%; baseline is 0.18%. No corresponding traffic increase occurred.",confidence:.99,source:"payments.error_rate"},
      {kind:"DEPLOYMENT",title:"Version 2026.08.15-rc3 deployed at 14:01 UTC",detail:"The release completed 2 minutes before the first sustained error increase. It changed the issuer-routing retry policy.",confidence:.97,source:"deployments/payment-service"},
      {kind:"LOG",title:"Issuer routing validation errors cluster in new code path",detail:"1,842 requests contain issuer_route_missing from RetryPolicyV3; the signature was absent in the preceding 24 hours.",confidence:.94,source:"logs/payment-service"},
    ],
    investigation:"Timing correlation, logs, and stable traffic point to the new issuer-routing retry path.",escalation:"Rollback can restore checkout but changes production payment routing; policy requires an accountable incident commander.",
    causeAnswer:"The deployment is the leading cause: it completed two minutes before failures began, and the new RetryPolicyV3 path produced 1,842 issuer_route_missing errors while traffic remained stable.",riskAnswer:"Rollback restores the prior issuer-routing policy. The tradeoff is reintroducing the previous retry behavior across payment-service; there is no evidence of data corruption or duplicate captures.",waitAnswer:"Waiting leaves the 12.4% authorization failure rate in place across us-east-1. There is no evidence of spontaneous recovery.",
  },
  "auth-keys": {
    id:"auth-keys",incidentId:"inc_auth_001",serviceId:"svc_auth",service:"auth-service",topologyNode:"auth",
    title:"Token validation failures after key rotation",shortTitle:"Authentication key failure",severity:"SEV1",region:"eu-west-1",
    normalImpact:"Session validation normal",detectedImpact:"8.7% session validation failures in eu-west-1",healthyRate:.12,detectedRate:8.7,baselineRate:.15,failedCount:"1,126",
    version:"2026.08.15-jwks2",rollbackVersion:"2026.08.14-rc7",actionLabel:"Rollback JWKS cache release",target:"auth-service / production",metricLabel:"Token validation error rate",recoveryRate:.16,
    evidence:[
      {kind:"METRIC",title:"Token rejection rate crossed 8% at 15:22 UTC",detail:"invalid_kid responses rose from 0.12% to 8.7% in eu-west-1 while request volume stayed flat.",confidence:.99,source:"auth.token_rejections"},
      {kind:"DEPLOYMENT",title:"JWKS cache v2 deployed at 15:19 UTC",detail:"The release changed cache invalidation during signing-key rotation three minutes before the error spike.",confidence:.96,source:"deployments/auth-service"},
      {kind:"LOG",title:"New key ID absent from worker cache",detail:"1,126 validation attempts reference the rotated key while affected workers continue serving the previous JWKS set.",confidence:.95,source:"logs/auth-service"},
    ],
    investigation:"Metrics and worker logs link rejected sessions to stale JWKS caches introduced by the latest auth-service release.",escalation:"Rollback restores the previous cache behavior but changes production identity validation; human approval is mandatory.",
    causeAnswer:"The JWKS cache v2 release is the supported cause. It preceded the spike by three minutes, and affected workers lack the newly rotated key ID while traffic is stable.",riskAnswer:"Rollback restores the previous cache invalidation path. Existing sessions remain valid, but production identity validation changes require explicit human authority.",waitAnswer:"Waiting continues rejecting approximately 8.7% of sessions in eu-west-1; the stale worker caches show no evidence of self-correction.",
  },
  "notification-queue": {
    id:"notification-queue",incidentId:"inc_notifications_001",serviceId:"svc_notifications",service:"notification-service",topologyNode:"notifications",
    title:"Notification delivery backlog after worker deploy",shortTitle:"Notification queue backlog",severity:"SEV2",region:"global",
    normalImpact:"Delivery latency within SLO",detectedImpact:"6.9% notification delivery failures with a 14-minute backlog",healthyRate:.26,detectedRate:6.9,baselineRate:.3,failedCount:"24,680",
    version:"2026.08.15-worker5",rollbackVersion:"2026.08.14-rc4",actionLabel:"Rollback queue worker release",target:"notification-service / production",metricLabel:"Delivery failure rate",recoveryRate:.28,
    evidence:[
      {kind:"METRIC",title:"Queue age exceeded the 5-minute SLO at 16:11 UTC",detail:"Oldest-message age reached 14 minutes and delivery failures rose to 6.9% without an inbound traffic surge.",confidence:.98,source:"notifications.queue_age"},
      {kind:"DEPLOYMENT",title:"Batching worker v5 deployed at 16:06 UTC",detail:"The worker release increased batch size and changed retry visibility timeouts five minutes before the backlog formed.",confidence:.95,source:"deployments/notification-service"},
      {kind:"LOG",title:"Visibility timeout expires during oversized batches",detail:"24,680 messages were re-delivered after worker batches exceeded the configured visibility window.",confidence:.93,source:"logs/notification-workers"},
    ],
    investigation:"Queue telemetry and worker logs correlate the backlog with oversized batches in the latest worker release.",escalation:"Rollback reduces the queue backlog but changes global delivery workers; policy requires human authorization.",
    causeAnswer:"The batching worker v5 release is the leading cause. Batch duration exceeds the queue visibility timeout, producing redeliveries and a growing backlog without increased inbound load.",riskAnswer:"Rollback restores the previous batch size and timeout behavior. Delivery may briefly slow during worker replacement, but messages remain durable in the queue.",waitAnswer:"Waiting allows the 14-minute backlog and redelivery cycle to grow globally; the workers show no evidence of draining the queue at the current configuration.",
  },
};

export const scenarioList = scenarioIds.map(id=>scenarios[id]);
export function scenarioForIncident(incidentId:string){return scenarioList.find(item=>item.incidentId===incidentId)??scenarios["payment-routing"]}
