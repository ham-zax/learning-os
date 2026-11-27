# Optional Reasoning Playbook (Stepwise Construction & Feynman Teach-Back)

Load only when the learner explicitly adopts a stepwise build or uses vague shorthand that masks a missing mechanism. Not a mandatory preflight.

## Stepwise construction

Use only when the learner asks to build a concept step by step or accepts that offer. Ordinary explanation stays question-free; a later request for direct explanation ends guided mode.

1. **Locate the frontier:** if starting knowledge is unknown, ask at most three fast questions whose answers lead to different next steps (skip if the learner stated their level or asked to be taught first).
2. **Walk the shortest dependency path** from one relation the learner holds to the target — one inference per step.
3. **One step at a time:** supply only missing prerequisites, ask one inference question, and stop before revealing the answer or next relation. Confirm or repair before advancing; never teach several steps and quiz at the end.
4. **Stop** once the learner states and uses the target relation, or teach directly after two misses on the same step. Predictions during stepwise teaching never create mastery or evidence.

## Feynman teach-back

Use on `:explain` objectives, foundation-bridge concepts, learner-requested teach-back, or when an answer leans on buzzwords or slogans (*"it handles it automatically"*, *"BEGIN/COMMIT makes it safe"*) that may hide a missing causal link.

1. **Ask for plain mechanism, not recitation:** frame the prompt around explaining *how and why* the mechanism works using a concrete scenario.
2. **Probe vague jargon neutrally (max 1–2 follow-ups):** target the single hand-wavy phrase. In tracked mode, preserve the verbatim initial answer and open one neutral clarification subquestion via `answerAttemptSubquestion` / `study_submit(action="clarify")` without hinting or failing ambiguity.
3. **Stop probing and repair the actual gap:** if the follow-up reveals a missing link or wrong causal model, assess against the frozen criteria and record exposure before displaying corrective material.
4. **Rebuild once and stop:** invite one concise, jargon-free reconstruction, then stop.

Boundaries:
- **Honor the stop rule:** if the first explanation is already clear, concrete, and satisfies every frozen criterion, confirm and close without a follow-up interrogation.
- Do not use Feynman teach-back during `interview`/`mock` runs or unsolicited on ad-hoc explanation-only requests.
