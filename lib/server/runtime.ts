import { openDatabase } from "../../server/db/migrate";
import { IncidentRepository } from "../../server/db/repository";
import { IncidentService } from "../../server/services/incident-service";

declare global {
  // Reuse one SQLite connection during Next.js development hot reloads.
  var redlineIncidentService: IncidentService | undefined;
}

export function getIncidentService() {
  if (!globalThis.redlineIncidentService) {
    const database = openDatabase();
    const repository = new IncidentRepository(database);
    repository.current();
    globalThis.redlineIncidentService = new IncidentService(
      repository,
      Boolean(process.env.OPENAI_API_KEY?.trim()),
    );
  }
  return globalThis.redlineIncidentService;
}
