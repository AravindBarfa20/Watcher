# Redline architecture decision record

## Scope
Redline ships one complete, deterministic payment-service incident. The system detects a post-deployment error spike, assembles evidence, requires a human authorization for rollback, executes through a narrow gateway, and verifies recovery.

## Decisions
- **SQLite + migrations** is the self-contained relational runtime for the local incident lab. All state changes are transactions; the `IncidentRepository` boundary is deliberately provider-neutral for a future PostgreSQL adapter.
- **Next.js route handlers** own all state transitions, authorization, policy evaluation, audit events, and privileged tools. The React client cannot mutate the database directly, and one process serves both UI and API.
- **Policy is deterministic.** A production rollback affecting checkout always requires a current incident, an active engineer, a matching authorization, and a non-expired approval. Model output can recommend; it cannot execute.
- **Voice is progressive enhancement.** With `OPENAI_API_KEY`, the browser asks the server for a short-lived Realtime credential and establishes two-way WebRTC audio directly to OpenAI. Without it, typed grounded questions and the complete authorization workflow remain available; the interface does not claim voice is live.

## Incident state machine
`HEALTHY → DETECTED → INVESTIGATING → AWAITING_HUMAN → AUTHORIZED → EXECUTING → VERIFYING → RESOLVED`

Every state transition, policy decision, authorization, action, verification, and grounded answer is written to the audit trail.
