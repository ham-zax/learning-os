# Agent & Chat Session Quick Start

Connect Learning OS either through the **5-tool MCP server** (`node dist/mcp-server.js`) or by opening a local folder agent directly in `/home/ubuntu/repo/learning-os`.

- **Ordinary question:** ask directly (for example, *"Explain JavaScript closures"*). No profile lookup or saved state is needed.
- **Tracked study / resume:** start a fresh chat or resume later with:

## Starter prompt

```text
Study backend systems with me in /home/ubuntu/repo/learning-os.
Read AGENTS.md and follow its routing.
```

For MCP-only chat clients (like hosted ChatGPT), `initialize` delivers the packaged teacher contract automatically — just ask to continue your profile (e.g., *"Continue my backend-systems study"*). If neither the MCP connector nor repository access is connected, the session can still explain concepts, but cannot track evidence or schedule reviews.
