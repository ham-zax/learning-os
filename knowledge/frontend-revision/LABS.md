# Frontend practical work

These are optional, original, deliberately faulty teaching starters. After the learner adopts practical work or gives an applicable standing instruction, the agent copies a selected file into a disposable learner workspace; the repository originals stay unchanged. Otherwise continue conversationally. The agent handles setup, but the learner performs the selected reasoning or implementation. A running starter is not learner evidence.

Do not expose instructor analysis or decisive output before a cold prediction. If help is requested, use the existing exposure lifecycle. Completing every lab is not a requirement for an oral-revision goal.

## Counter factory: closure ownership

File: `labs/counter-factory.mjs`. From the repository root: `node knowledge/frontend-revision/labs/counter-factory.mjs`.

**Learner contract:** each factory call creates an independent counter starting at zero. `next()` increments and returns that counter's new value; `peek()` returns the current value without mutation. Functions returned by one call share that call's state; different factory calls do not.

Use `js-closures:explain` for ownership reasoning or an explicitly adopted `js-closures:implement` for code. Freeze only the selected capability. Implementation requires the learner's actual code and observed execution, not a verbal explanation.

**Instructor observation:** the original driver produces `1, 2, 3, 3, 3` in its five fields. A correct isolated implementation produces `1, 2, 1, 2, 1`. Also exercise a third instance and repeated `peek()` calls. Do not supply this comparison before a cold attempt.

**Minimum repair:** identify the shared binding's lifetime. Avoid an unrelated lecture on every function form. A later task should use a different ownership problem, such as independent subscriptions, not merely renamed counters.

## Latest result: asynchronous update authority

File: `labs/latest-result.mjs`. Command: `node knowledge/frontend-revision/labs/latest-result.mjs`.

**Learner contract:** the latest started search owns the visible result, error and loading state. Older completions must not overwrite it. Current failure must be observable; stale failure must not replace a newer success. The injected loader controls completion order without network or clock dependence.

Use `js-async-await:predict` for a trace or an explicitly adopted `js-async-await:implement` for the repaired function. State the ES-module environment. Freeze the permitted documentation, supplied scaffolding and code the learner must own.

**Instructor observation:** the original driver first shows the current result, then incorrectly publishes the obsolete result. Inspect newer-first and older-first settlement, stale rejection after current success, and current rejection. Include loading ownership, not just the happy-path value.

Supplying the loader/driver can be scaffolding; supplying the result-version strategy is target reasoning and must be recorded as help. Copying an agent implementation is guided practice. This model does not certify React effect cleanup or browser accessibility; those need their own opportunities.

## Browser and framework work

Use a tiny disposable page or an explicitly authorized project. Preserve native semantics, keyboard operation and focus for interactive controls. Freeze runtime/version and expected behavior. Use the existing React/Angular sources for the selected framework mechanism; do not require a full new application or dependencies for a language-level task.

## Notes after closure

With a note request or standing consent, use current session/objective note context. Capture the causal distinction, an actual observed error when present, a tiny example and one recall prompt. Do not invent a personal mistake because the starter contains that bug.
