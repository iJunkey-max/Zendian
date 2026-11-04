import type { ProjectConsoleData, ProjectType } from "../types";
import { formatDate } from "../../utils/date";

export function createDefaultConsoleData(name: string, icon: string, type: ProjectType, desc = ""): ProjectConsoleData {
  return {
    schemaVersion: 2,
    projectId: globalThis.crypto.randomUUID(),
    name,
    icon,
    description: desc,
    type,
    status: "initiated",
    statusHistory: [],
    createdAt: formatDate(new Date()),
    tasks: [],
    deliverables: [],
    overview: { markdown: desc },
    timeline: { milestones: [] },
  };
}
