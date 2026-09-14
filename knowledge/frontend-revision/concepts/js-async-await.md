---
id: js-async-await
title: "async/await"
difficulty: 1
prerequisites: []
tags: [coding-course, revision-first]
---

# async/await

## Summary
An async function starts synchronously until it suspends. Await resumes through promise-job scheduling; it does not make a CPU loop parallel. Concurrent requests can settle out of order.

## Common Misconceptions
- Assuming await blocks the whole process or makes an earlier request finish first.

## Practice Questions
- In the latest-result lab, distinguish request-start order, completion order and permission to update the visible state.

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[MDN JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model) The course summary is original; inspect the focused primary reference when the distinction is subtle or version-sensitive.

## Course route
[Async results, errors and execution order](../units/f02.md)
