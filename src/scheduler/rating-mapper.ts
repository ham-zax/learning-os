import type { EvidenceEvent } from "../db/types.js";
import type { ReviewRating } from "./types.js";

export function mapEvidenceToReviewRating(
  evidence: EvidenceEvent,
): ReviewRating | null {
  if (!evidence.retrieval_valid || evidence.result === "ungradable") {
    return null;
  }

  switch (evidence.result) {
    case "incorrect":
      return "Again";
    case "partially_correct":
      return "Hard";
    case "correct":
      return "Good";
  }
}
