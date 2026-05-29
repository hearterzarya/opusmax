# OpusMax CLI (`opusmaxx`)

Official CLI for setting up OpusMax API keys with Claude Code, Claude Desktop, and Anthropic-compatible tools.

## Install

```bash
npx opusmaxx setup
```

Or install globally:

```bash
npm install -g opusmaxx
opusmaxx setup
```

## Quick Start

```bash
npx opusmaxx setup
npx opusmaxx status --verify
npx opusmaxx test
npx opusmaxx models
```

## Commands

| Command | Description |
|---------|-------------|
| `opusmaxx` | Interactive setup (same as `setup`) |
| `opusmaxx setup` | Paste API key → pick IDEs (VS Code, Cursor, Claude Code, …) |
| `opusmaxx status` | Show local config |
| `opusmaxx test` | Send a test message |
| `opusmaxx models` | List gateway models |
| `opusmaxx doctor` | Run diagnostics |
| `opusmaxx logout` | Remove saved API key |

## Setup flow

1. Paste your `sk-ant-ox-…` key (verified against the gateway).
2. Choose tools: Claude Code, Claude Desktop, VS Code, **Cursor**, **Windsurf**, Cline, Roo Code, or terminal `.env`.
3. Optional quick test message.

Default gateway base URL:

```text
https://opusxmax.vercel.app/api
```

Check usage in the browser:

```text
https://opusxmax.vercel.app/api/key-status?key=YOUR_API_KEY
```

## Claude Code

```bash
export ANTHROPIC_BASE_URL=https://opusxmax.vercel.app/api
export ANTHROPIC_API_KEY=sk-ant-ox-your-key
```

Add to `~/.claude/settings.json` under `env` (see `opusmaxx setup`).

## Publish (maintainers)

```bash
cd packages/cli
pnpm build
npm publish --access public --otp=YOUR_CODE
```

## Development (monorepo)

```bash
pnpm install
pnpm cli:build
pnpm cli:link
opusmaxx setup
```
