---
id: production-latency-localization
title: "Production latency localization"
difficulty: 3
prerequisites: ["resource-saturation-and-backpressure","runtime-request-execution-and-concurrency"]
tags: [coding-course, revision-first]
---

# Production latency localization

## Summary
Break latency into meaningful spans and compare competing causes with one discriminating observation. Keep averages, tail latency and queueing from being conflated.

## Common Misconceptions
- Listing possible technologies instead of predicting what each hypothesis would make observable.

## Practice Questions
- Requests slow only under load while one downstream span stays constant. Which measurement would falsify your leading bottleneck hypothesis?

## Teacher use
Select the capability through Learning OS before turning the prompt into an attempt. Freeze the consequential criterion and allowed tools; use one question at a time. A correct explanation does not certify implementation. A provided model is exposure; a repair remains guided until a later qualifying independent attempt. Stop when the selected criterion is sufficiently demonstrated, not after a quota of examples.

## Sources
[OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/) supports request-path interpretation; [Node.js execution and blocking](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) supports one possible cause. A large metric does not itself establish causation. The supplied incident is original and needs no full monitoring-platform installation.

## Course route
[Production diagnosis and architecture boundaries](../units/b06.md)
