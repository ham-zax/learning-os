/**
 * DB-free presentation advisor for agent/terminal sessions.
 *
 * npm run -s present:teaching -- '{"need":"relationship","tools":[]}'
 * The agent supplies observed capabilities. This command does not discover or
 * execute any host tools, nor access learner profiles.
 */
import { z } from "zod";
import {
  recommendTeachingPresentation,
  teachingMedia,
  teachingNeeds,
  teachingToolSources,
} from "./teacher-presentation.js";

const toolSchema = z.object({
  id: z.string().trim().min(1).max(160),
  source: z.enum(teachingToolSources),
  modes: z.array(z.enum(teachingMedia)).min(1).max(teachingMedia.length),
  available: z.boolean(),
}).strict();

const requestSchema = z.object({
  need: z.enum(teachingNeeds),
  tools: z.array(toolSchema).max(100),
}).strict();

function main(): void {
  const [payload, ...extras] = process.argv.slice(2);
  if (!payload || extras.length) {
    throw new Error("Usage: npm run -s present:teaching -- '<JSON {need, tools}>'");
  }
  const data = requestSchema.parse(JSON.parse(payload) as unknown);
  console.log(JSON.stringify(recommendTeachingPresentation(data)));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Invalid presentation request";
  console.error(JSON.stringify({ error: message }));
  process.exitCode = 1;
}
