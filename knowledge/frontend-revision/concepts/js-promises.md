---
id: js-promises
title: "Promises and Chaining"
difficulty: 1
prerequisites: []
tags: [coding-course, revision-first]
---

# Promises and Chaining

## Summary
A promise represents eventual settlement. Each then returns a new promise whose settlement depends on the callback return or throw. Starting work and awaiting its result are separate decisions.

## Common Misconceptions
- Forgetting to return a nested promise or assuming Promise.all starts function bodies that were never called.

## Practice Questions
- Trace one chain with a missing return and one that returns the nested operation. Which completion does the caller actually wait for?

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[MDN JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model) The course summary is original; inspect the focused primary reference when the distinction is subtle or version-sensitive.

## Course route
[Async results, errors and execution order](../units/f02.md)
