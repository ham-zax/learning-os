---
id: angular-signals-reactivity
title: "Angular Signals and Reactive State"
difficulty: 3
prerequisites: ["angular-fundamentals"]
tags: [coding-course, revision-first]
---

# Angular Signals and Reactive State

## Summary
A signal holds reactive state; computed derives a value from tracked reads. Dependencies can change with the executed branch. Effects are for appropriate external synchronization, not default state propagation.

## Common Misconceptions
- Using effects to mirror derived state or mutating nested data without considering how change notification occurs.

## Practice Questions
- A computed reads different signals depending on a toggle. Predict which subsequent change should invalidate the derived value.

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[Angular signals guide](https://angular.dev/guide/signals) The course summary is original; inspect the focused primary reference when the distinction is subtle or version-sensitive.

## Course route
[Angular reactive state and dependency lifetimes](../units/a01.md)
