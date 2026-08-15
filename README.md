# Redline

**A human control plane for autonomous production agents.**

Redline detects operational incidents, assembles grounded evidence, explains the situation through a two-way voice supervisor, and requires accountable human authorization before any consequential production action is executed.

```text
monitor → detect → investigate → human review → authorize → execute → verify
```

## Product highlights

- Production-style operations dashboard with incident, evidence, approval, action, and audit views
- Deterministic incident labs for payments, authentication, and notification delivery
- Interactive React Three Fiber service-topology visualization
- Evidence-backed findings with confidence and source attribution
- OpenAI Realtime two-way voice conversation over WebRTC
- Explicit human authorization for consequential actions
- Idempotent execution gateway and verified recovery state
- Persistent local audit trail and deterministic policy evaluation
- Responsive desktop, tablet, and mobile interface

## Technology

- Next.js App Router, React and TypeScript
- React Three Fiber, Drei and Three.js
- Framer Motion and Radix UI
- SQLite with `better-sqlite3` for local development
- OpenAI Realtime API for duplex voice
- Zod, Vitest and ESLint

## Local setup

### Requirements

- Node.js 20 or newer
- npm
- An OpenAI API key for live voice (optional)

### Installation

```bash
git clone https://github.com/AravindBarfa20/Watcher.git
cd Watcher
npm install
cp .env.example .env
npm run db:seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Environment variables

```env
OPENAI_API_KEY=your_openai_api_key
```

The key is read only by server-side route handlers. Never expose it through a `NEXT_PUBLIC_` variable or commit it to source control. Live voice is optional; typed evidence and authorization remain available without it.

## Using Redline

1. Select **New incident** and choose an incident lab.
2. Redline detects the anomaly, correlates evidence, and evaluates policy.
3. Inspect the dependency topology and grounded evidence.
4. Use **Voice supervisor** or typed questions to examine evidence and alternatives.
5. Review the action, scope, risk, and expiration before authorization.
6. Execute the approved action and verify recovery in the activity log.

## Commands

```bash
npm run dev         # Development server on port 5173
npm run build       # Production build
npm run lint        # Static analysis
npm test            # Test suite
npm run db:migrate  # Create/update the local SQLite schema
npm run db:seed     # Seed the local incident state
```

## Architecture

```text
Browser UI
  ├── Operations shell and command palette
  ├── Interactive 3D dependency topology
  └── OpenAI Realtime WebRTC voice session
           │
Next.js route handlers
  ├── Incident workflow and policy service
  ├── Evidence and authorization gateway
  └── Short-lived Realtime credentials
           │
Local SQLite repository
  └── Incidents, evidence, approvals, actions and audit events
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design and authority boundaries.

## Deployment

The Next.js application is compatible with Vercel. The current SQLite repository is optimized for local development and must be migrated to managed storage before a reliable Vercel deployment because Vercel Functions do not provide persistent local storage.

Recommended options:

- **Turso** for hosted SQLite-compatible storage
- **Neon** for serverless PostgreSQL

After migrating the database adapter, configure `DATABASE_URL` and `OPENAI_API_KEY` in Vercel project settings and deploy this repository as a standard Next.js project.

## Security model

- Long-lived OpenAI credentials remain server-side.
- Browsers receive short-lived Realtime credentials only.
- Voice tools are advisory and read-only.
- Consequential actions require explicit human authorization.
- Authorizations are scoped, expiring, and single-use.
- Execution requires idempotency and a matching incident state.
- Secrets, local databases, build output, and Vercel metadata are excluded from Git.

## Verification

```bash
npm run lint
npm test
npm run build
```

## Status

Redline is an actively developed incident-control prototype. Production connectors use deterministic simulations so the complete human-in-the-loop workflow can be evaluated safely.

