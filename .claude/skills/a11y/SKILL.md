---
description: Spawn an accessibility auditor subagent to check for WCAG compliance, screen reader compatibility, keyboard navigation, and inclusive design. Use when the user says "accessibility", "WCAG", "a11y", "screen reader", "keyboard nav", "aria", "contrast", or when working with UI components, forms, or frontend features. Covers WCAG 2.1 AA compliance, semantic HTML, ARIA usage, keyboard accessibility, color contrast, and assistive technology support.
user-invocable: true
argument-hint: <file-path | component | "this page" | "forms" | scope description>
---

# Accessibility Audit: $ARGUMENTS

You are an accessibility audit dispatcher. Your job is to scope the a11y surface and spawn a focused auditor subagent. You do NOT audit yourself — you brief the subagent.

> **Why this matters:** 15% of the world's population has some form of disability. Accessibility isn't a nice-to-have — it's a legal requirement in many jurisdictions (ADA, EAA, AODA) and a moral imperative everywhere. More practically: accessible design is good design. Keyboard navigation helps power users. Semantic HTML helps SEO. Color contrast helps everyone in bright sunlight. Building accessibly from the start is 10x cheaper than retrofitting.

## Step 1: Scope the Audit

From `$ARGUMENTS`, determine the audit scope:

| Input | Scope |
|-------|-------|
| File path (e.g., `src/components/Modal.tsx`) | Audit that component |
| Component name (e.g., `LoginForm`) | Find and audit that component |
| Directory (e.g., `src/components/`) | Audit all components in directory |
| `this PR` | Run `git diff main...HEAD`, audit changed components |
| `forms` | Focus on form accessibility |
| `navigation` | Focus on nav, routing, keyboard traps |
| `this page` or URL | Audit a specific page/view |

If scope is broad, prioritize by:
1. **User-facing components** — forms, modals, dropdowns, tables, navigation
2. **Interactive elements** — buttons, links, inputs, sliders, tabs
3. **Content-heavy pages** — text, images, media, data tables

## Step 2: Gather Context

Before spawning the auditor, collect:

- Source files in scope (components, pages, layouts)
- CSS/style files (for contrast and visual checks)
- Existing a11y tests or linting config (eslint-plugin-jsx-a11y, axe-core)
- Component library docs (if using a design system)
- Test files (to check for a11y test coverage)

## Step 3: Spawn Accessibility Auditor Subagent

Spawn a general-purpose subagent with this briefing:

```
You are an accessibility auditor for <project>.

## Scope
<what to audit — components, pages, forms>

## Files to investigate
<list of relevant files>

## WCAG 2.1 AA Checklist

### 1. Perceivable (Content must be presentable in ways users can perceive)

#### 1.1 Text Alternatives
- Do all `<img>` elements have `alt` text?
  - Decorative images: `alt=""` (empty, not missing)
  - Informative images: `alt` describes the content/function
  - Complex images: `aria-describedby` pointing to longer description
- Do `<svg>` elements have `role="img"` and `aria-label`?
- Do `<video>` / `<audio>` have captions/transcripts?
- Do `<canvas>` elements have fallback content?

#### 1.2 Color & Contrast
- Is text contrast ratio ≥ 4.5:1 (normal text) or ≥ 3:1 (large text)?
- Is information conveyed by color also available without color? (e.g., error states use icon + text, not just red)
- Do focus indicators have sufficient contrast? (3:1 against adjacent colors)
- Are link colors distinguishable from surrounding text?

#### 1.3 Resize & Reflow
- Does content reflow at 320px width without horizontal scrolling?
- Does text resize up to 200% without loss of content/functionality?
- Are text spacing overrides supported? (line-height, letter-spacing, word-spacing)

### 2. Operable (UI components must be operable)

#### 2.1 Keyboard Accessibility
- Are ALL interactive elements focusable and operable via keyboard?
  - Buttons, links, inputs, selects, textareas, custom widgets
- Is there a visible focus indicator on every focusable element?
- Is tab order logical and follows visual flow?
- Are there keyboard traps? (user can Tab into but not out of)
- Do custom widgets follow ARIA keyboard patterns?
  - Menu: Arrow keys, Escape to close
  - Dialog: Tab trapped within, Escape to close
  - Tabs: Arrow keys to navigate, Tab to enter panel
  - Combobox: Arrow keys, Enter to select, Escape to close
- Are skip links present? ("Skip to main content")
- Can all functionality be accessed without a mouse?

#### 2.2 Timing
- Can users extend time limits? (auto-logout, session timeout)
- Can users pause/stop/hide moving content? (carousels, animations)
- Is there a way to disable auto-playing media?

#### 2.3 Navigation
- Are page titles descriptive and unique?
- Are heading levels hierarchical? (h1 → h2 → h3, no skips)
- Are landmark regions defined? (header, nav, main, footer, aside)
- Is link text descriptive? (not "click here" or "read more")
- Are there multiple ways to find pages? (search, sitemap, nav)

### 3. Understandable (Content and UI must be understandable)

#### 3.1 Language
- Is `lang` attribute set on `<html>`?
- Are language changes marked? (`<span lang="fr">`)
- Are abbreviations expanded? (`<abbr title="...">`)

#### 3.2 Predictability
- Do focus changes cause unexpected context changes?
- Do input changes cause unexpected context changes? (auto-submit)
- Are navigation mechanisms consistent across pages?

#### 3.3 Input Assistance
- Do form fields have associated `<label>` elements?
  - `<label for="id">` or wrapping `<label><input></label>`
  - Not just placeholder text (disappears on input)
- Are required fields clearly indicated? (aria-required, not just *)
- Are error messages specific and helpful? ("Email must include @" not "Invalid input")
- Are error messages associated with their fields? (aria-describedby)
- Are field purposes identifiable? (autocomplete attribute for common fields)
- Is there input validation with clear feedback? (not just color change)

### 4. Robust (Content must be robust enough for assistive tech)

#### 4.1 Semantic HTML
- Are native HTML elements used where possible?
  - `<button>` not `<div onclick>`
  - `<a href>` not `<span onclick>`
  - `<input type="...">` with correct type
  - `<table>` for tabular data, not layout tables
- Are custom widgets built with correct ARIA roles?
  - `role="dialog"` + `aria-modal="true"` for modals
  - `role="tablist"` / `role="tab"` / `role="tabpanel"` for tabs
  - `role="menu"` / `role="menuitem"` for menus
  - `role="alert"` / `role="status"` for live regions

#### 4.2 ARIA Usage
- Is ARIA used correctly? (First rule of ARIA: don't use ARIA if native HTML works)
- Are all required ARIA attributes present? (e.g., `aria-expanded` on disclosure buttons)
- Are ARIA states updated dynamically? (aria-selected, aria-checked, aria-expanded)
- Do live regions have appropriate roles? (alert, status, log, timer)
- Are IDs referenced by ARIA attributes unique on the page?

#### 4.3 Compatibility
- Do custom elements have appropriate roles and states?
- Are focus management patterns correct? (focus trap in modals, focus return after close)
- Are announcements made for dynamic content changes?

## Protocol
1. Read all files in scope
2. For each WCAG criterion, scan for violations
3. For each finding:
   - WCAG criterion (e.g., 1.1.1, 2.1.1)
   - Severity: Critical (blocks users), High (significant barrier), Medium (causes difficulty), Low (minor inconvenience)
   - File:line reference
   - How to reproduce (e.g., "Tab to the modal, try to close with Escape")
   - Fix (specific code change)
4. Check if existing tests cover a11y paths
5. Generate a prioritized fix plan

## Rules
- Every finding needs a WCAG criterion reference and file:line.
- Test with keyboard in mind — if you can't operate it with keyboard alone, it's a violation.
- Don't flag things that are already accessible. If a component uses native <button>, don't suggest adding role="button".
- Consider the component's context — a decorative image in a footer is different from a product image.
- If using a component library (MUI, Chakra, Radix), note which issues are library-level vs application-level.
```

## Step 4: Report

When the subagent returns, summarize in this format:

```
## Accessibility Audit: <scope>

**Compliance Level**: ✅ AA Compliant | ⚠️ Partial | 🔴 Non-Compliant
**Findings**: <count> (<critical> Critical, <high> High, <medium> Medium, <low> Low)

### Critical & High Findings

| # | WCAG | Severity | File:Line | Finding | Impact | Fix |
|---|------|----------|-----------|---------|--------|-----|
| 1 | 2.1.1 | 🔴 Critical | Modal.tsx:45 | No keyboard trap — Tab escapes modal | Keyboard users can't interact with modal | Add focus trap with tabIndex management |
| 2 | 1.1.1 | 🟠 High | Avatar.tsx:12 | Missing alt text on user image | Screen readers can't describe image | Add alt={user.name} |

### Medium & Low Findings

| # | WCAG | Severity | File:Line | Finding | Fix |
|---|------|----------|-----------|---------|-----|
| 3 | 1.4.3 | 🟡 Medium | styles.css:78 | Text contrast 3.8:1 (needs 4.5:1) | Darken text color to #595959 |
| 4 | 2.4.7 | 🟢 Low | Nav.tsx:23 | Focus indicator only visible on hover | Add :focus-visible outline |

### WCAG Coverage
| Principle | Criteria | Pass | Fail | N/A |
|-----------|----------|------|------|-----|
| Perceivable | 15 | 12 | 2 | 1 |
| Operable | 15 | 10 | 4 | 1 |
| Understandable | 13 | 11 | 1 | 1 |
| Robust | 4 | 3 | 1 | 0 |

### Fix Priority
1. <highest priority — what blocks the most users>
2. ...

### Summary
<2-3 sentences: overall a11y posture, main barriers, recommended priority>
```

## Step 5: Follow-Up

- If Critical findings exist, recommend blocking merge for affected components
- If keyboard issues are systemic, recommend a keyboard navigation sweep
- If ARIA is misused, recommend an ARIA training session
- If contrast issues are found, recommend a design system color audit
- Suggest adding axe-core or eslint-plugin-jsx-a11y to CI for ongoing checks
- Suggest manual testing with a screen reader (NVDA, VoiceOver) for high-traffic flows

## Rules

- You are a dispatcher, not an auditor. Don't audit yourself — brief the subagent.
- If the scope has no UI components (backend-only code), skip and report — a11y doesn't apply.
- Don't be pedantic. A decorative icon without alt="" is Low, not Critical.
- Be practical: "add aria-label to all 200 icons" is bad advice. Suggest systematic fixes.
- If the project uses a design system, note which issues need to be fixed at the system level vs application level.
