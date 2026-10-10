# Agent / web session instructions

How to use Learning OS from a chat session (Claude web, ChatGPT, or any agent) and how to pick up where you left off. The chat is the interface; Learning OS keeps the learner state.

## What the session needs

Learning OS state is a SQLite profile in this repository (`data/profiles/<profile-id>/tutor.db`). A chat session can only use it if it can read the repository and run shell commands there, for example through a WSL, filesystem or shell connector. No dedicated Learning OS server is required.

Without that access the session can explain concepts, but it cannot select study, record evidence, schedule reviews or truthfully report progress. It should say so rather than pretend.

Smoke test, before you trust a session:

```bash
cd ~/repo/learning-os && npm run -s kernel -- methods
```

Ask the session to run it and tell you it worked. If it cannot, stop and fix the connection first.

Privacy: whatever the session reads or prints is visible to the chat provider. Learner state stays on your machine, but the session sees the parts it queries. Do not paste secrets into the chat.

## Starter prompt (first message of a new session)

Replace the path if your checkout lives elsewhere.

```text
Use Learning OS as my durable learning system. Repo: ~/repo/learning-os (WSL).
Read AGENTS.md, docs/teacher-agent-protocol.md and skills/learning-os-teacher/SKILL.md first.
Operate it only through its public kernel: npm run -s kernel -- <method> '<json>'. Never write SQLite directly.
If I have no learner profile, onboard me around my goal and wait for my confirmation before creating one.
Otherwise call getStudyContinuation for my goal and continue from the durable state.
Use Learning OS for sequencing, evidence, review timing and progress claims. Never infer mastery from chat history.
One question per message. Keep replies short. Hide internal IDs and labels unless I ask.
When a visual or interactive teaching aid would clarify the current mechanism, use verified native presentation tools first, then relevant installed skills or authorized connected tools. Pair graphs/diagrams with explanations and text alternatives. Don't scan tools every turn, install integrations, or compromise frozen questions/evidence.
If I decline more instruction, close that step instead of leaving it open.
If you cannot reach the repo, say so and do not claim any progress.
```

The skill file is read from the repository each time, so you do not need to install a copy. A separately installed copy can drift from the repository; if you install one anyway, the repository's `AGENTS.md` and `docs/teacher-agent-protocol.md` still take precedence.

## What a good first turn looks like

1. The session reads the three files and runs the kernel, not a made-up summary.
2. It resolves your profile (`npm run tutor -- profile list` if needed) and calls `getStudyContinuation`.
3. It does one thing: resume the pending question, ask for your goal if you are new, or recommend the next step and wait for you to accept.

If the first reply is a long study plan with no tool calls, the session is not using Learning OS. Ask it to start again from the starter prompt.

## Continuing later

New day, new chat, or a different model or provider: start a fresh session with the starter prompt, or this shorter one:

```text
Continue my Learning OS study. Repo: ~/repo/learning-os. Read AGENTS.md and skills/learning-os-teacher/SKILL.md, then call getStudyContinuation and resume.
```

You do not need to paste earlier chat. Pending questions, shown material and unfinished attempts are in durable state. Use one teacher session at a time against the same profile, because two sessions writing at once can conflict.

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

- Claim mastery, progress or a schedule it did not read from Learning OS.
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
