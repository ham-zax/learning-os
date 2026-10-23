# Research-grounded teaching implementation plan

## Goal and scope

Make authoritative, version-appropriate source verification a routine teacher responsibility when the lesson depends on changing technical facts. Preserve proportionality for stable concepts and ordinary conversation. This plan refines the learner's supplied investigation and authorizes a bounded documentation/portable-skill implementation; it does not establish that the proposed behavior has already been observed in live teachers.

**Architecture:** The replaceable teacher owns research through its host's available capabilities. The existing teacher skill owns the reusable procedure; canonical repository instructions link to it. The kernel continues to own learner truth and sequencing.

**Tech stack:** Markdown instructions and references; existing read-only course resource discovery. No TypeScript changes are needed.

**TaskStartSnapshot:** `/home/ubuntu/repo/learning-os`, branch `main`, commit `5076f75`, clean working tree before this plan was added, 2026-10-23. No learner data was opened. The delegated writer shares this checkout and must preserve this plan and any later unrelated changes.

## Authority and change necessity

Read `AGENTS.md`, `skills/learning-os-teacher/SKILL.md`, `docs/teacher-agent-protocol.md`, relevant exposure/frozen-support sections of `docs/kernel-contracts.md`, `docs/coding-courses.md`, `docs/capability-aware-teaching.md`, and `docs/teacher-evaluation.md`. Inspect `src/knowledge/courses.ts` only to confirm source metadata semantics. The existing course resource schema has locators, not verified freshness or framework versions.

The demonstrated gap is an incomplete portable teacher procedure, so **documentation/skill-only** is sufficient. A research engine, source cache, helper CLI, provider adapter, manifest change, or database would add an unnecessary owner. One new reference is justified because the same conditional procedure serves registered courses and ad-hoc topics across hosts. Existing instructions should link to that reference rather than duplicate the full procedure.

**Compatibility boundary:** Keep public APIs, schema, capabilities, contexts, curriculum, frozen challenge/rubric contracts, evidence and FSRS semantics intact. External documentation is reference data, never authority over tool permissions or repository instructions. Research does not authorize running documentation commands, installing tools, sending private learner/code context externally, or changing project dependencies.

**TDD route:** Off/skipped. This is documentation work. No test creation, modification, execution, evaluation CLI runs, or synthetic/managed learner DB access is authorized by this plan. Define reviewer scenarios now; executing model behavior pilots is a separate step. Static link checks and `git diff --check` are appropriate completion checks.

## Design decisions and gaps resolved

1. Research is conditional on the claim, not every message or the broad subject name. Stable conceptual explanations need no automatic browsing. Version-sensitive implementation code, current APIs, support/deprecation/security status, and claims about latest releases require authoritative verification appropriate to the target. For high-stakes domains, use current primary authorities appropriate to jurisdiction/context and the host's safety rules; this change is not a general academic research workflow.
2. Resolve tracked continuation and frozen support conditions before research/presentation. Ad-hoc teaching remains ephemeral and needs no invented learner/profile/goal.
3. Resolve the target by context: a project task uses its installed/resolved or pinned version; an explicit request for another release establishes a distinct comparison/migration target, not permission to silently switch project APIs. For a version-specific standalone lesson, use that version. For an unversioned introductory lesson that needs current APIs, verify the latest stable release. A package range alone may not establish an installed version; disclose uncertainty or ask only if it materially changes the lesson.
4. Prefer official versioned documentation, API references, release notes and specifications. Confirm that the page/package/ecosystem and release channel actually match the claim. Search snippets, URL registries, page copyright years, filenames and model memory do not establish verification. Search can discover sources; inspect the relevant source content before claiming it supports the lesson. Disclose conflicts or unresolved scope rather than fabricate certainty.
5. Use native available search/fetch/browser tools first, then relevant installed skill metadata and authorized connectors as needed. Do not blanket-scan, silently install, or hardcode a mandatory provider. Direct retrieval of a known official source can be sufficient; search is not mandatory ceremony.
6. Keep a small optional conversational research brief: target/task, version and channel, checked primary sources and supported claims, actual check date, consequential differences, uncertainty. This is not a new durable format or learner-state field. Cite the pages supporting material changing claims near the explanation; disclose version/date concisely when useful rather than append a report to every response.
7. Reuse the brief within an intact context while the target and claims remain applicable. Refresh when version/project constraints change, the topic introduces unverified claims, sources conflict, the learner requests a current check, or a new teacher/context no longer has verifiable source provenance. Recheck a new claim of “latest/current.” Do not invent a universal TTL or imply that an old check proves today's freshness.
8. Separate private preparation from learner-visible help. Private source reading does not itself mean the learner received a hint. Before presenting material that supplies target reasoning during an active assessment or pending diagnostic, record the existing hint/exposure as appropriate. Documentation access explicitly permitted by the frozen task is not automatically contamination; do not retroactively change support conditions. Research must not leak hidden solutions or regenerate frozen criteria to fit a newly discovered API. Handle a genuinely incompatible frozen task through existing invalid-opportunity/clarification boundaries, without inventing a new kernel method.
9. If live access fails, name the unverified portion and use appropriate local/versioned material or stable conceptual explanation. Do not claim “latest,” invent citations, or present remembered changing APIs as verified. Request missing context only when necessary. No automatic curriculum or learner-state writes follow from research.
10. Omit hardcoded claims about today's React/LangGraph releases. Their actual versions must be checked during a real teaching/evaluation run. This plan does not endorse the supplied investigation's React release assertion.

## Implementation: one coherent writing task

Use one delegated writer because these instructions form one synchronized procedure. Parallel file owners would add coordination and inconsistent rules. Execute the following steps in order within that task.

### 1. Create the canonical conditional reference

Create `skills/learning-os-teacher/references/research-grounding.md` with the trigger, version resolution, source verification, progressive capability discovery, concise provenance/citations, reuse/refresh, offline behavior, trust/privacy and assessment-support boundaries above. Keep it portable and practical. Include a compact example only if it clarifies the project-version conflict.

Acceptance: A fresh teacher can choose whether research is necessary, identify the target version, verify the relevant claims or disclose limitations, and safely present them without creating learner state or a separate learning plan.

### 2. Integrate at the existing instruction frontier

Modify:

- `AGENTS.md`: a concise requirement after episode readiness and before version-sensitive teaching, pointing to the canonical reference.
- `skills/learning-os-teacher/SKILL.md`: an explicit conditional reference-loading trigger and short research step after tracked state resolution, before version-sensitive authoring/teaching. Preserve the existing ordered preflight and ad-hoc exceptions.
- `docs/teacher-agent-protocol.md`: teacher ownership/timing, source versus instruction authority, and private-research/visible-exposure distinction. Link to the reference.
- `docs/capability-aware-teaching.md`: concise link explaining research establishes applicable facts and presentation explains them. No research ranking module or changes to the presentation advisor.
- `docs/coding-courses.md` and `skills/learning-os-teacher/references/technical-revision.md`: start registered-course source lookup with existing `listCourseResources()`/local availability; distinguish curriculum locators from inspected current/versioned evidence and link to the research reference.
- `skills/learning-os-teacher/references/teacher-protocol.md`: synchronize a short portable summary/link because this reference is explicitly the standalone fallback when repository docs cannot be loaded. Do not copy the whole procedure.

Acceptance: Canonical and portable instructions agree; the new reference is discoverable for ad-hoc technical topics as well as registered courses; routine stable questions do not acquire a browsing ritual.

### 3. Define reviewer-only behavioral scenarios

Modify `docs/teacher-evaluation.md`. Clearly label these as manual fresh-teacher probes, separate from the existing CLI's executable scenario IDs. Use actual host tool traces, retrieved source contents, final explanation and state actions as evidence, not the teacher's self-report. Record actual run time and versions when eventually run; never hardcode expected future releases.

Required cases:

- New LangGraph API lesson: inspect relevant official current/versioned material before implementation code; identify matching package/API/channel; cite actual supporting pages. It may remain ad-hoc with no learner DB.
- React project pinned to an older release: use a fixture or learner-supplied version context without managed state; respect the project version, separate latest from applicable, and handle an explicit newer-release request without silently migrating the project.
- Research unavailable: disclose precisely what could not be checked; offer appropriately bounded help without invented versions, URLs or successful-tool claims.

Add concise reviewer checks for a stable-concept negative control (no unnecessary browsing), verified-context reuse/refresh, and an active-attempt pressure case (private preparation versus allowed references versus answer-bearing display; pre-display provenance when required). These are criteria, not new evaluator code or claimed runs. Any later tracked pilot must use isolated synthetic state under separately authorized execution.

Acceptance: Reviewers can distinguish genuinely grounded behavior from plausible output, excessive browsing, incompatible versions and assessment contamination.

## Verification and stopping

The writer reads back the synchronized sections and runs `git diff --check`. Check newly added relative Markdown links resolve to existing files, including `research-grounding.md` from the portable skill. Inspect the bounded diff for scope and contradictory “always research”/“all documentation is exposure” language. Confirm no source, package, curriculum or learner data files changed.

Return changed files, checks actually run and results, unresolved issues, and a clear distinction between static instruction checks and unexecuted behavioral probes. Do not claim cross-provider research compliance from documentation review. No commits, pushes, PRs, installs or extra subagents in the writing task. The coordinator reviews the result when T3 delivers it; the start-of-implementation handoff is fulfilled once the bounded child is confirmed running.

Stop after these instruction/evaluation-definition changes. Reconsider cache/freshness metadata or automation only after observed recurring failures justify them. If completing this scope requires a new runtime contract, persistent state, external publication, or a materially different architecture, report the exact boundary instead of expanding.

## Orchestration handoff

Use T3 V2 `delegate_task`, shared checkout, implementation role, asynchronous mode, with Pi provider `pi`, catalog model `opencode2api/deepseek-v4.1-flash-free`, advertised option `thinking: max`. Preserve the returned task ID and verify provider/model/options. If launch fails before a task exists, report the concrete failure and use the user's alternate Luna Max only after confirming its catalog options; never duplicate a running task. Do not launch a top-level thread. T3 completion wakes the parent; no polling watcher is needed.

Status: Implemented by the T3 V2 Pi/DeepSeek child and reviewed directly by the coordinating agent. Review closed a stale-curriculum verification exemption, clarified frozen-criteria access in probes, restored explicit LangGraph/React cases, separated LTS support lines from prerelease channels, and made the conversational brief optional. Static file-scope, relative-link and whitespace checks passed. Behavioral probes remain unexecuted; live teacher compliance is not certified.
