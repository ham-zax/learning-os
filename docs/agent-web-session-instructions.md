# Agent / web session instructions

How to use Learning OS from a chat session (Claude web, ChatGPT, or any agent) and how to pick up where you left off. The chat is the interface; Learning OS keeps the learner state. The default connected workstation for this project is **WebHarness ARM** at `/home/ubuntu/repo/learning-os`, unless the user explicitly names another checkout.

## What the session needs

Learning OS state is a SQLite profile in this repository (`data/profiles/<profile-id>/tutor.db`). A chat session can only use it if it can read the authoritative repository and run shell commands there, for example through the connected WebHarness ARM workstation or an expressly selected filesystem/shell connector. No dedicated Learning OS server is required.

Without that access the session can explain concepts, but it cannot select study, record evidence, schedule reviews, or truthfully report progress. It should say so rather than pretend.

Smoke test, before you trust a session:

```bash
cd /home/ubuntu/repo/learning-os
git rev-parse --show-toplevel
npm run -s kernel -- methods
```

Ask the session to run it and tell you it worked. If it cannot, stop and fix the connection first.

Privacy: whatever the session reads or prints is visible to the chat provider. Learner state stays on your machine, but the session sees the parts it queries. Do not paste secrets into the chat.

## Starter prompt

Two lines. Everything else is discovered by following the routing, not restated here.

```text
Study backend systems with me in /home/ubuntu/repo/learning-os.
Read AGENTS.md and follow its routing. Don't ask me to restate anything it already covers.
```

Swap the topic or goal for whatever you are studying, and replace the path if your checkout lives elsewhere. The checkout and your intent are the only facts the prompt needs to carry, because they are the things the repository cannot tell the agent about itself.

## Entry cascade

The prompt is a trigger, not a contract. Each layer loads only what the next one needs:

```text
2-line prompt
-> AGENTS.md            routing table + core invariants + authority
-> SKILL.md             pre-teaching gate, turn routing, assessment truth, resume rules
-> protocol section     only the one procedure the current turn needs
-> reference playbook   only when the episode phase calls for it
```

What each layer owns, so nothing is duplicated upward:

| Layer | Owns | Must not contain |
| --- | --- | --- |
| Prompt | Intent, topic/goal focus, checkout | Kernel commands, profile IDs, exposure rules, evidence schemas |
| `AGENTS.md` | Situation → file routing, core invariants, authority order | Step-by-step procedure |
| `SKILL.md` | Pre-teaching gate, turn classification, assessment and resume rules | Full lifecycle prose |
| Protocol | One named procedure per section | Routing decisions |
| References | One playbook per episode phase or capability | Cross-phase policy |

Consequences worth knowing:

- At each new teacher instance, the agent reads the source skill from the repository (`skills/learning-os-teacher/SKILL.md`), so a separately installed copy cannot drift from current contracts.
- For tracked study, the agent resolves the profile and goal itself (`npm run tutor -- profile list`, then `getStudyContinuation`). Do not hardcode internal IDs in the prompt; they go stale and defeat discovery.
- For ad-hoc conceptual questions with no tracked episode, `AGENTS.md` routes directly to teaching without creating learner state or loading full protocol docs.
- `npm run -s check:entry` enforces the shape: the starter prompt stays at three lines or fewer, names `AGENTS.md`, and does not re-inline internal contracts.

## What a good first turn looks like

1. For tracked study, the session verifies the authoritative workstation/Git checkout, follows `AGENTS.md` → `skills/learning-os-teacher/SKILL.md`, and verifies the public kernel boundary.
2. It resolves your profile (`npm run tutor -- profile list` if needed) and calls `getStudyContinuation`.
3. It does one thing: resume the pending question, ask for your goal if you are new, or recommend the next step and wait for you to accept.

If you asked for tracked study and the first reply is a long study plan with no tool calls, the session is not using Learning OS. Ask it to start again from the starter prompt.

## Continuing later

New day, new chat, or a different model or provider:

```text
Continue my Learning OS study in /home/ubuntu/repo/learning-os.
Read AGENTS.md and follow its routing.
```

You do not need to paste earlier chat. Pending questions, shown material, and unfinished attempts are in durable state. Use one teacher session at a time against the same profile, because two sessions writing at once can conflict.

Things you can say mid-session:

| You say | What should happen |
| --- | --- |
| Just type your answer | It is recorded verbatim against the pending question and then assessed |
| "continue" / "next" | The session follows whatever the next-step decision returns |
| "keep going" | Standing permission: it presents the next item after each one without asking |
| "three questions" / "clear my due reviews" | Only that count or scope, then it stops and asks |
| "give me a hint" / "just tell me" | Help is recorded first, so the attempt is shown as assisted |
| "where were we?" (after a dropped connection) | It resumes the saved question; if instruction was recorded it says so, says the attempt is assisted, and asks whether you saw it |
| "no thanks" / "I don't want another explanation" | The feedback step is closed with no extra exercise; the assessed gap stays and comes back through normal review |
| "give me a minute" | A short pause inside the same step |
| "why am I not ready on X?" | It explains the recorded evidence and your current status, not a guess |
| "make me a revision note" | A compact note is built from recorded state |
| "I only have 15 minutes" | Study is sized to that without changing review math |

## What the session should not do

- Claim mastery, progress, or a schedule it did not read from Learning OS.
- Write to the database directly, or commit or push learner state unless you ask. Canonical profile files are versioned deliberately; use the checkpoint command first.
- Show hints or explanations before recording them, or count assisted answers as independent.
- Ask extra questions after a sufficient answer, or press you to write code when you declined practical work.
- Treat curated worked examples as a required lesson sequence. They are optional help.

## Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| "I can't access your files" | No repo or shell connector in this chat. Enable it, then rerun the smoke test |
| Confident progress claims with no tool calls | The session is working from chat memory. Restart with the starter prompt |
| Profile not found | Ask it to run `npm run tutor -- profile list` and `profile show`; pick one with `--profile <id>` |
| Two chats giving different answers | Close one. Use a single active teacher per profile |
| It re-explains something you already saw after a disconnect | It should disclose and ask once instead; remind it of the resume rule above |
| Commands fail after updating the repo | Run `npm ci` and `npm run build` in the repository |

## Related

- [Getting started](getting-started.md), [teacher-agent protocol](teacher-agent-protocol.md), [scaffold pilot contract](scaffold-fading-pilot.md), [revision-friction checklist](revision-friction-checklist.md).
- Reviewing a live teacher session: [teacher-evaluation.md](teacher-evaluation.md).
