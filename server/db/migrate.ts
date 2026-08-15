import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Vercel Functions expose only /tmp as writable storage. This keeps the
// deterministic incident lab operational in a single function instance while
// the production database adapter is migrated to managed storage.
export const DATABASE_PATH = process.env.VERCEL
  ? "/tmp/redline.db"
  : resolve(process.cwd(), "data/redline.db");

export function openDatabase() {
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });
  const db = new Database(DATABASE_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, environment TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY, service_id TEXT NOT NULL REFERENCES services(id), title TEXT NOT NULL, status TEXT NOT NULL,
      severity TEXT NOT NULL, impact TEXT NOT NULL, error_rate REAL NOT NULL, baseline_error_rate REAL NOT NULL,
      deployment_version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS incident_events (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), type TEXT NOT NULL, title TEXT NOT NULL,
      detail TEXT NOT NULL, actor TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), kind TEXT NOT NULL, title TEXT NOT NULL,
      detail TEXT NOT NULL, confidence REAL NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS hypotheses (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), statement TEXT NOT NULL, confidence REAL NOT NULL,
      supporting_evidence TEXT NOT NULL, contradicting_evidence TEXT NOT NULL, missing_information TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS policy_decisions (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), action_type TEXT NOT NULL, allowed INTEGER NOT NULL,
      requires_human INTEGER NOT NULL, reasons TEXT NOT NULL, policy_version TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), actor_id TEXT NOT NULL REFERENCES users(id), action_type TEXT NOT NULL,
      target TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, expires_at TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), authorization_id TEXT NOT NULL REFERENCES approvals(id), type TEXT NOT NULL,
      target TEXT NOT NULL, status TEXT NOT NULL, idempotency_key TEXT NOT NULL UNIQUE, result TEXT, created_at TEXT NOT NULL, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS voice_sessions (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), user_id TEXT NOT NULL REFERENCES users(id), provider TEXT NOT NULL,
      status TEXT NOT NULL, created_at TEXT NOT NULL, closed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), actor_id TEXT, action TEXT NOT NULL, metadata TEXT NOT NULL, request_id TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id), agent TEXT NOT NULL, status TEXT NOT NULL,
      summary TEXT NOT NULL, latency_ms INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
    CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_incident ON incident_events(incident_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_evidence_incident ON evidence(incident_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_actions_incident ON actions(incident_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_incident ON audit_events(incident_id, created_at);
  `);
}

if (process.argv[1]?.endsWith("migrate.ts")) { openDatabase().close(); console.log(`Migrated ${DATABASE_PATH}`); }
