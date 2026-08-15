import { openDatabase } from "./migrate";
import { IncidentRepository } from "./repository";
const db = openDatabase(); new IncidentRepository(db).reset(); db.close(); console.log("Seeded deterministic Redline incident lab");
