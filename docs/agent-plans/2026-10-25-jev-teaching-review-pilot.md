# Jev teaching review pilot

## Mission and scope

The user authorizes a Jev experiment for ad-hoc teaching and the tracked canonical
workflow. Use existing optional reply/session review functions. Do not enable an
automatic reviewer or delivery gate. Preserve the current mixed checkout and index.
Send synthetic teaching material only. No managed learner profile is opened.

Use the existing native TypeSafe request, three checks per request, 15-second
deadline, no retries. Credentials come only from the existing environment and
never enter artifacts. Returned model identity and elapsed review time are measured.
The adapter does not return token usage, so no dollar-cost claim is planned.

## Cases and expected labels

Freeze expected labels before the first request. Keep labels and source filenames
out of reviewer inputs. Use neutral case IDs and deterministic shuffled order.

Four ad-hoc cases form two pairs from actual earlier synthetic teacher outputs:
correct/incorrect recursion support and established/invented learner knowledge
during a stepwise repair. Labels use code execution and the supplied conversation
facts. Reviewers receive the relevant facts as ordinary source evidence, not labels.

Six tracked cases cover three matched correct/flawed action paths: canonical
completion, exposure-before-display, and neutral clarification of an ambiguous
answer. Each path runs against its own disposable synthetic database through
public kernel methods. Record actual calls, results, visible-event order, and
independent database inspection. Deliberately flawed simulations are labeled as
such in the ground truth, not presented as observed model failures.

Replay each case twice through the unmodified reviewer to observe variability.
Report each primary judgment and any off-target concerns. Uncertain judgments
are abstentions, not provider errors or successful defect detection.

## Interpretation and stopping

Report defects caught, missed defects, false alarms, unknowns, request failures,
model identity, latency, and repeated-case agreement separately by route.
Labels are coordinator-authored, not blind human annotations. Clear synthetic
cases are a smoke test, not production accuracy or real learner benefit.
Correct final database state cannot by itself prove exposure happened before
display, so use the actual event log for that pair.

Finish after the bounded pilot and evidence report. If the reviewer misses a
high-cost workflow defect, do not make it a gate. Even clean results authorize
only a scoped recommendation, not automatic changes to everyday teaching.

Scratch artifacts: `/tmp/learning-os-jev-pilot-ia8mwh8p`.

## Initial results and input-contract correction

Twenty initial requests complete with `jev-1.14.0`. Primary labels match across
both repetitions for all ten cases. Ad-hoc review catches invented learner
knowledge but misses the technical prose defects. Tracked review flags all three
deliberate defects and also flags the correct calibrated completion.

The tracked session inputs use coordinator-written instruction summaries. Current
review documentation requires actual applicable source excerpts. Correct that
input-contract omission and repeat the same six tracked cases twice with verbatim
source instructions. Keep labels, action evidence, native reviewer questions,
and the first result set unchanged. This is a development correction after seeing
results, not independent validation. Report both versions and do not hide the
initial false alarm. Corrected artifacts use `inputs-source/` and `results-source/`.

## Final results

All 32 native requests complete with `jev-1.14.0`. Initial ad-hoc review catches
invented learner knowledge, misses the technical explanation defects, and clears
both sound controls. Initial tracked review detects all three defects and falsely
flags a correct completion. Corrected source-excerpt tracked review detects all
three defects and clears all three controls, twice each. Labels repeat identically
within each input version. No reviewer code or confidence threshold is tuned.

Median reviewer latency is 160 ms initially and 192 ms with source-excerpt tracked
inputs. Maximum observed latency is 6,816 ms. No usage-based cost, end-to-end teaching
speedup, or learner-outcome gain is measured. The source-excerpt follow-up uses the
same cases after seeing initial results, not independent validation.

Keep review optional and advisory. Do not enable automatic gates or delegate
technical correctness or learner-state authority to Jev. The
[result report](../research/2026-10-25-jev-teaching-review-pilot.md) records ground
truth, all versions, scope limits, artifacts, and the brief retrospective.
