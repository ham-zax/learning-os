# Revision-friction checklist (proposed)

Status: proposed review aid. It supplements the `scaffold_*` scenarios in [teacher-evaluation.md](teacher-evaluation.md); it is not a learner-facing step, a gate, or evidence of learning.

## What the automated checks cover

`npm run eval:teacher -- prepare CASE_ID` seeds a synthetic database; a fresh teacher continues it through the public kernel; `inspect DIRECTORY` then checks durable state only.

| Scenario | Durable state checked |
| --- | --- |
| `scaffold_interrupted_after_presentation` | Exact worked-example artifact preserved (hash), one exposure (it is unknown whether the learner saw it), frozen question pending and unanswered, no new attempt or evidence |
| `scaffold_completion_return_to_frozen` | Completion exposure not duplicated, completion reply not stored as the frozen answer, no evidence, no new attempt |
| `scaffold_assisted_answer_closure` | Exact answer stored, frozen source executed, one assessment with `retrieval_valid = 0`, no review-card change, episode closed |
| `scaffold_declined_further_instruction` | No unrequested exposure, reconstruction not required, no extra question or attempt, episode closed, and no `review_gap` obligation left for the next session |

The first two leave state unchanged when the teacher behaves correctly, so their checks pass on a fresh seed. They guard against harm (duplicate exposure, a silent attempt) and cannot show that the teacher did the right thing.

## Advisory reply heuristics

`inspect DIRECTORY REPLY_FILE` also reads a saved learner-facing reply (keep it outside Git) and prints advisory flags: repeated long sentences, verbatim echo of the recorded scaffold body, mechanism wording that appears in no recorded exposure, and whether the reply mentions assistance. These are lexical heuristics. They never change the exit code or the pass/fail count, can miss a paraphrase, and can flag harmless wording. A person still reads the reply.

## What they cannot establish

Database checks cannot tell whether the conversation felt clear or concise, whether a transition was confusing, or whether the teacher reread the right material. A person must read the actual learner-facing replies for each scenario. No live teacher run has been reviewed for these scenarios yet.

Keep real learner transcripts out of Git. Review synthetic scenario runs only, and store any notes without learner text.

## Human review checklist

For each scenario, mark pass / concern with a one-line reason.

- **Unnecessary questions.** Is every question needed? After a decline or a sufficient answer, does the teacher stop asking?
- **Repeated explanations.** After an interruption, does the teacher disclose that guidance was recorded, ask once whether it came through, and present it only if it did not (or the learner asks) instead of re-teaching or paraphrasing it again?
- **Confusing transitions.** Is it clear when instruction ends and the frozen question begins? Is the exercise reply kept distinct from the real answer?
- **Lost context.** After a fresh session, does the learner need to restate anything the saved state already holds?
- **Assistance withdraws appropriately.** Is the next step less supported than the last? Is assisted success described as assisted, without claiming independent mastery? Is a decline respected without argument?
- **Answer leakage.** Does anything shown before the frozen answer reveal the expected output or teacher notes?

## Procedure

1. `prepare` a scenario into a temporary directory outside the repository.
2. Give a fresh compatible teacher the database path and send `learnerMessage` verbatim as a separate message.
3. Save the learner-facing replies outside the repository and review them against the checklist.
4. Run `inspect` and record automated results next to the human review.
