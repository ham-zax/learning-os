/**
 * A provider-neutral presentation aid for conversational teachers.
 *
 * The host agent, not Learning OS, discovers its tools and confirms availability.
 * This pure module never probes a host, opens a learner database, or grants access
 * to a tool. Its recommendations are optional presentation choices, not study plans.
 */

export const teachingNeeds = [
  "spatial",
  "relationship",
  "change_over_time",
  "process",
  "code_behavior",
  "symbolic",
  "explanation",
] as const;

export const teachingMedia = [
  "text",
  "math",
  "diagram",
  "graph",
  "interactive_diagram",
  "interactive_graph",
  "simulation",
  "code",
  "audio",
] as const;

export const teachingToolSources = ["native", "skill", "mcp", "local"] as const;

export type TeachingNeed = (typeof teachingNeeds)[number];
export type TeachingMedium = (typeof teachingMedia)[number];
export type TeachingToolSource = (typeof teachingToolSources)[number];

export interface TeachingTool {
  /** Local display identifier supplied by the agent; no global registry implied. */
  id: string;
  source: TeachingToolSource;
  modes: TeachingMedium[];
  /** Only true if the agent has verified that it can use the tool in this session. */
  available: boolean;
}

export interface PresentationRequest {
  need: TeachingNeed;
  tools: TeachingTool[];
}

export interface PresentationOption {
  mode: Exclude<TeachingMedium, "text">;
  toolId: string;
  source: TeachingToolSource;
  why: string;
}

export interface PresentationRecommendation {
  need: TeachingNeed;
  options: PresentationOption[];
  fallback: { mode: "text"; why: string };
}

const modesByNeed: Record<TeachingNeed, readonly TeachingMedium[]> = {
  spatial: ["interactive_diagram", "diagram", "interactive_graph", "graph", "math"],
  relationship: ["interactive_graph", "graph", "interactive_diagram", "diagram", "math"],
  change_over_time: ["simulation", "interactive_graph", "graph", "interactive_diagram", "diagram"],
  process: ["interactive_diagram", "diagram", "simulation", "code"],
  code_behavior: ["code", "simulation", "diagram"],
  symbolic: ["math", "interactive_graph", "graph", "diagram"],
  explanation: ["diagram", "audio"],
};

const whyByMode: Record<Exclude<TeachingMedium, "text">, string> = {
  math: "Express the relationship with readable mathematical notation.",
  diagram: "Make components and their spatial or causal relationships visible.",
  graph: "Show how quantities vary relative to one another.",
  interactive_diagram: "Let the learner explore components and connections directly.",
  interactive_graph: "Let the learner vary an input and observe its effect.",
  simulation: "Let the learner observe and vary a changing system.",
  code: "Make program behavior concrete through a safe, relevant example.",
  audio: "Support an explanation with an optional spoken representation.",
};

const sourceOrder: Record<TeachingToolSource, number> = {
  native: 0,
  skill: 1,
  mcp: 2,
  local: 3,
};

/**
 * Rank only reported and confirmed affordances. "Best" is advisory: the teacher
 * must still judge relevance, privacy, accessibility, cost and evidence exposure.
 * No tool is automatically invoked, and the text fallback is unconditional.
 */
export function recommendTeachingPresentation(
  request: PresentationRequest,
): PresentationRecommendation {
  const ranked = modesByNeed[request.need];
  const available = request.tools
    .filter((tool) => tool.available)
    .sort((a, b) => sourceOrder[a.source] - sourceOrder[b.source] || a.id.localeCompare(b.id));

  const options: PresentationOption[] = [];
  const usedTools = new Set<string>();
  for (const mode of ranked) {
    if (mode === "text") continue;
    const tool = available.find((candidate) =>
      candidate.modes.includes(mode) && !usedTools.has(`${candidate.source}:${candidate.id}`),
    );
    if (!tool) continue;
    options.push({ mode, toolId: tool.id, source: tool.source, why: whyByMode[mode] });
    usedTools.add(`${tool.source}:${tool.id}`);
    if (options.length === 4) break;
  }

  return {
    need: request.need,
    options,
    fallback: {
      mode: "text",
      why: "Use clear prose and text descriptions of essential relationships; add a worked example only when it is appropriate to reveal one.",
    },
  };
}
