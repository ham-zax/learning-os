export type ConceptStatus = 'unseen' | 'learning' | 'reviewing' | 'mastered';

export interface SM2Result {
  ef: number;
  interval: number;
  repetitions: number;
  nextReview: string;
}

/**
 * SM-2 spaced repetition algorithm.
 *
 * @param grade   Quality of recall (0-5, where >= 3 is successful)
 * @param ef      Current easiness factor (>= 1.3)
 * @param interval  Current interval in days
 * @param repetitions  Number of consecutive successful reviews
 * @param today   ISO date string (YYYY-MM-DD) used as the base for nextReview
 */
export function sm2(
  grade: number,
  ef: number,
  interval: number,
  repetitions: number,
  today: string,
): SM2Result {
  let newInterval: number;
  let newRepetitions: number;

  if (grade >= 3) {
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * ef);
    }
    newRepetitions = repetitions + 1;
  } else {
    newRepetitions = 0;
    newInterval = 1;
  }

  const newEf = Math.max(
    1.3,
    ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)),
  );

  const [y, m, d] = today.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d + newInterval));
  const nextReview = base.toISOString().slice(0, 10);

  return { ef: newEf, interval: newInterval, repetitions: newRepetitions, nextReview };
}

/**
 * Derive the next concept status from the current state and the review grade.
 *
 * Transitions:
 *  - unseen -> learning: first interaction (any grade)
 *  - learning -> reviewing: 2+ successful reviews (grade >= 3)
 *  - reviewing -> mastered: 5+ consecutive passes AND interval > 21 days
 *  - Any grade 0-1 on reviewing/mastered -> back to learning
 */
export function updateStatus(
  currentStatus: ConceptStatus,
  grade: number,
  repetitions: number,
  interval: number,
): ConceptStatus {
  // First interaction: move out of unseen
  if (currentStatus === 'unseen') {
    return 'learning';
  }

  // Failed recall (grade 0-1) on reviewing/mastered sends back to learning
  if (grade <= 1 && (currentStatus === 'reviewing' || currentStatus === 'mastered')) {
    return 'learning';
  }

  // Promote from learning to reviewing after 2+ successful reviews
  if (currentStatus === 'learning' && grade >= 3 && repetitions >= 2) {
    return 'reviewing';
  }

  // Promote from reviewing to mastered: 5+ consecutive passes AND interval > 21 days
  if (currentStatus === 'reviewing' && grade >= 3 && repetitions >= 5 && interval > 21) {
    return 'mastered';
  }

  return currentStatus;
}
