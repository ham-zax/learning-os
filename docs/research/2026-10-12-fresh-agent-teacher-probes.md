# Fresh-agent teaching probes — 2026-10-12

**Scope:** Engineering dogfood of the current Teacher skill in two **ad-hoc, non-assessed synthetic** learner conversations. Neither prompt is a private learner transcript. No managed profile or learner database was accessed by these model runs.

## Method and provenance

- Starting integrated code: `365e2fb`; host: non-ARM WSL at `/home/hamza/repo/learning-os`.
- Exported two prompts using `npm run -s eval:teacher -- adhoc-cases` (the command deliberately omits review criteria). Each fresh invocation received the current `skills/learning-os-teacher/SKILL.md`, a concise synthetic previous-context statement, and the new learner message.
- Ran **two separate ephemeral Codex sessions**, each with a read-only sandbox, working directory `/tmp`, and the instruction not to use tools. Provider-reported runtime: OpenAI Codex v0.162.1, model `gpt-6.1-sol`, low reasoning effort; neither run recorded a tool event. Both calls exited **0** with a nonempty model reply. An earlier invocation failed before reaching a model because `/tmp` was not a trusted Git directory; the corrected run used `--skip-git-repo-check`. This failure is not counted as a model reply.
- Replies and invocation logs were kept outside the repository. The independent reviewer should verify the raw output against the SHA-256 values below. The `adhoc-inspect` command computes the digest and prints **manual** reviewer criteria but does not grade the response.

| Scenario | Observed reply digest (SHA-256) | Words | Provisional reading of actual response |
| --- | --- | ---: | --- |
| `changed_question` | `d3e4e51ad23f63a2ce24267444f435a2579d6114a0c6a690a5531af10ce25859` | 106 | Answered why angle-dependent functions have names, used a shifted/scaled circle and oscillating voltage to connect the same relationship to another domain; no redundant quiz. |
| `knows_basics` | `f93f329a8557644ae0664e69d2f42819bb571567d6042337d4bfeb3ac19fe8e4` | 110 | Provided a short mindfulness refresher followed immediately by a two-minute breath-attention practice; no diagnosis, competence score or learner-state proposal. |

All four manual rubric criteria appear satisfied in each reply **on this initial inspection**, but this is the implementer's preliminary judgment, not blinded external model scoring or owner judgment.

## Boundaries and next interpretation

- These are **observed model-generated replies**, unlike A1's explicitly hypothetical example texts. They establish a bounded ability to obey two ad-hoc teacher directions with the supplied skill; they do not show that ChatGPT web, Claude, or a tool-using kernel-connected teacher consistently behaves this way.
- The repository's **16 tracked teacher scenarios** still require independent teacher execution and inspection of actual tool/action order for a live teacher-quality claim. Passing kernel tests is not equivalent to that evaluation.
- The pending **owner-judged** trigonometry and meditation replay in `docs/agent-plans/2026-10-11-implementation-plan.md` remains unchecked. These synthetic paraphrases do not replace the owner's direct judgment.
- No delayed unassisted transfer or human retention was observed. Do not extrapolate learning effectiveness from a reply-quality pilot.
- No concrete flaw was observed in these two ad-hoc replies, so **no speculative teacher policy change** was warranted. If independent review finds a specific repeated problem, apply a targeted repair and preserve the assessment/exposure boundaries.
