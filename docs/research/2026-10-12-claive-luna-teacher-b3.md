# B3 — ARM Claive/Luna kernel-connected teacher evaluation (2026-10-12)

**Scope:** Fresh AI-teacher behavioral dogfood against the **12 remaining** synthetic, isolated Learning OS kernel scenarios. This completes the **16/16 scenario coverage across B2+B3**, but **not** a 16/16 single-model uniform-version evaluation: B2 used separate older Codex probes, and B3 used GPT-6 Luna at max. These are database invariant checks and bounded manual review, **not** human learning outcomes or mastery evidence.

## Runner and isolation

- Canonical workstation/repository: `oci-hunter-arm`, `/home/ubuntu/repo/learning-os`, baseline Git HEAD `8c562a8df41571952a835ea04cafb8c32980ed7d` (synchronized from `origin/main`, clean before the B3 policy change).
- Installed Claive orchestration (`/home/ubuntu/repo/claive/skills/subagent-routing/SKILL.md`, `skills/worker-orchestration/SKILL.md`), engine `codex`, pinned model **`gpt-6-luna`**, reasoning **`max`**, with explicitly scoped ARM-only workstation calls. Launched independent worker sessions with strict `webharness_armserver` routing. Claive's worker launcher was adapted in disposable scratch to enable tool approvals; it did not grant permission to use non-ARM workstations. A separate short read-only Scout session verified the ARM path.
- Each credited model session had **its own** disposable fresh database under `/home/ubuntu/work/scratch/learning-os-b3-20261012/probes/CASE/tutor.db`, created using the existing `prepare` command. Models read `AGENTS.md`, the current Teacher skill and relevant teacher protocol, then exercised `node /home/ubuntu/repo/learning-os/dist/kernel-cli.js --db ABSOLUTE_SYNTHETIC_PATH METHOD ...` via ARM tool calls. They were forbidden from evaluator code, gold answers, real learner profiles, unscoped workstation access, and editing the repository.
- Each actual model reply, complete Claive event trace, and per-case JSON inspector output remain **outside Git** under the Claive state directory and the B3 scratch `results` folder. SHA-256s below are the exact UTF-8 bytes in `result.txt`; a model report alone is not accepted as provenance.
- The initial Claive attempts used a read-only execution policy or auto-selected non-ARM tools. They were stopped/excluded without being credited as passing episodes. An ARM-only route check and correctly scoped fresh workers replaced them.

## Initial failures and one targeted policy repair

The **initial twelve-run baseline** yielded nine complete, passing checks; two model behavior failures; and one timed-out worker that had partially mutated its *own* fixture (3/5 checks) but did not finish and is **not counted**. Raw initial traces and altered synthetic DBs remain archived in scratch. No contaminated fixture was reused for the credited retests.

1. `calibrated_idempotency_ambiguous`: an underspecified phrase, “It runs again,” led the teacher to reveal the expected output and operation-key distinction, record assessment and exposure, instead of preserving the partial answer and asking a neutral clarification. The **initial 0/3** is retained.
2. `calibrated_idempotency_model_error`: correct output coupled with confidently wrong causal reasoning was treated as an invitation to clarify, not as a complete wrong-model answer to be verified, assessed and repaired. Initial **0/5** is retained.
3. `calibrated_transaction_wrong_model`: initial model worker exceeded its wall-time cap while exploring the case (3/5 DB assertions at interruption); **timed out, not judged as a completed teaching reply**.

The single B3 policy change clarifies this exact decision boundary in `skills/learning-os-teacher/SKILL.md` and `docs/teacher-agent-protocol.md`: missing technical referent/output → persist partial response and ask one neutral clarification without running/revealing the answer; explicit prediction **plus** a false causal mechanism → submit the original answer verbatim, run required deterministic verification, assess criteria honestly, then record targeted repair and reconstruction. No schema, selection, FSRS, learner profile or evidence implementation was changed.

Each of these **three** cases was prepared afresh and independently rerun with the updated skill. The initial failures are not reclassified as successes.

## Final credited run evidence

| Case | Kernel checks | Claive worker | Reply SHA-256 |
| --- | ---: | --- | --- |
| Correct cold answer | 3/3 | `e48775142206` | `f3bf3feaa7aca5f159440f93c27123e775e8c4dd6841a1e669a3f66929323e95` |
| Question too large | 3/3 | `2674fde6fa19` | `23a40c27a7954c60f74b5ec4cd7c85369064876912da2f287eb732c0eb164594` |
| Unclear blocker | 3/3 | `90e3031fa378` | `dee2a8c646c55158fa1cf935c109f435d4c794509d9138d3c0023689c300cd25` |
| Resumed complete answer | 4/4 | `001ae35f8df0` | `f6f385e52d756fd2a9b34b773c328e3feef2de663683c4905b807406b5283940` |
| Changed-surface transfer | 3/3 | `e7a9e8c7ab7e` | `07abc23ad2a917582fed4cabdbfe646b64e9aa49aebf6e2f68de29e73a6f0675` |
| Correct last-seat prediction | 4/4 | `2715d4c55717` | `84a705b5879b67df24683aa8e9405d45fe962fda4ec807ca6ef70f0f11ce340e` |
| Wrong last-seat causal model (fresh retest) | 5/5 | `1106bfc75c52` | `1ecda6f5486ec9d2c5ff9514c57cc60b6607c45abe46086df7fd2e90aeb8484c` |
| Ambiguous retry response (fresh retest) | 3/3 | `691b56c45712` | `7f1cde6aab22021d29b97d6c1617e2282640c83e1be20c39a9f039e9564382b1` |
| Wrong retry causal model (fresh retest) | 5/5 | `d308b4245b8c` | `60bb08767fea3a43c804c47d2c707faf04d159e5af6bf195b65f06aaa4184077` |
| Scaffold completion → frozen question | 4/4 | `7566f433f6f6` | `63cd0f9200d09760347e3e3fd42339022b058025b097d033e614ca2fb6133af6` |
| Assisted correct answer closure | 5/5 | `7f5993568b71` | `368972c35c0a9e0b0b04b974aa3e87cbfabd221a7707248aa1f574fe72006201` |
| Declined further instruction | 5/5 | `95dacead34a4` | `5ebf244473c75466c6bcffd627d951a05d67eb246e549015114936da63d8ea92` |

**Aggregate: 47/47 automated DB assertions across the 12 final credited sessions.** These are deterministic kernel/postcondition assertions, **not 47 independent semantic teaching grades**. The final three fresh retests account for 13 of these checks (3+5+5); the nine original passing cases account for 34. All 12 credited workers exited normally and used only ARM tools with zero cross-case `--db` paths, zero evaluator/profile reads in logged tool arguments, and no tool calls after their last `recordExposure` when an exposure occurred.

### Manual text-quality notes

- The ambiguous retry retest asked what “it” means and what that action would do; it **did not reveal expected output or operation identity**. The coherent wrong-model retest completed deterministic verification, saved corrective explanation and one pending reconstruction question; its learner-facing response specifically corrected the operation-key misconception. The last-seat wrong-model retest explained the check/await/decrement interleaving and asked the learner to reconstruct the mistaken single-threaded assumption.
- The last-seat repair stored a 678-character *answer-bearing explanation* as a teaching artifact, with the pending reconstruction question persisted separately; the visible reply was precisely that content followed by `\n\n` and the saved question prompt. The retry repair persisted its entire visible reply in one teaching artifact. Both used an atomic reconstruction-plus-exposure final state action, without subsequent tool operations.
- Two scaffold return/closure outputs triggered optional **lexical heuristics** for mechanism terminology and prior assistance acknowledgement; their DB checks passed. The returned saved challenge contains “interleave” as neutral task wording, not the answer. The assisted closure explicitly states the prior guidance makes the answer assisted; the completion return shows the saved frozen question without a redundant worked example. These should remain manual reviewer points, not automatic failures or claims of learner mastery.
- Correct closure, blocker diagnosis, reduced question size, fresh answer resumption, changed-surface answer, accepted last-seat prediction and declined instruction each passed their corresponding public-kernel invariant checks. Reviewer judgment of language and user experience is still needed beyond these checks.

## Limitations and next decisions

This is synthetic stateful **single-turn** evaluation, not an empirical measure of multi-turn continuity, delayed unassisted transfer, retention or provider portability. Nine initially passing runs exercised the earlier teacher-policy revision; three fresh reruns exercised the new wording. The model was GPT-6 Luna max throughout credited B3; Muse was not available on this ARM workstation. The broader Learning OS curriculum, persistent evidence, scheduling and selection were never modified. Owner-judged trigonometry and meditation conversations and real later learning outcomes remain separate and unverified.

Review the exact two-file Teacher skill/protocol diff, the above attribution and the raw Claive traces in one consolidated independent read-only review. Do not retroactively claim any failed original case passed, and do not turn these 47 kernel checks into a pedagogical percentage.
