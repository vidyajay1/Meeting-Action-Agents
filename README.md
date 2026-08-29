# Meeting Action Agent

Turn messy meetings into clear next steps. Paste a transcript, run **Analyze Meeting**, review structured output, then approve or reject the follow-up before any external action.

## Run locally

```bash
cp .env.example .env.local
```

Add your OpenAI key to `.env.local` (required for live analysis of arbitrary transcripts). If the key is missing, **Load Demo Transcript** still runs a fixture through the same subagent + approval workflow so the UX can be demoed:

```
OPENAI_API_KEY=sk-...
```

Then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Load Demo Transcript**, then **Analyze Meeting**.

## What the agent does

The root **Meeting Action Agent** does not do the whole job in one prompt. It runs a TrueForge-style turn:

1. **Meeting Analyst** (subagent) — isolated extraction of decisions, action items (owner + deadline), and open questions.
2. **Follow-up Writer** (subagent) — isolated draft of a professional follow-up email from that structured analysis.
3. **Approval Gate** — the turn **pauses** on a gated tool (`queue_follow_up_email`) until the user sends an explicit allow/deny. Approving does **not** send email; it only marks the session ready for a later external action.

Missing owners or deadlines display as **Not specified**.

## Where TrueForge is used

TrueForge is the [open-source agent harness](https://trueforge.dev/introduction) this MVP is built around: **Agent → Session → Turn → Events**, plus **dynamic subagents** and **tool approval**.

This demo is meant to run with `npm run dev` only (no second server, no database). The Next.js app therefore **hosts an in-process harness** that implements the same primitives the TrueForge SDK would drive against `npx @truefoundry/trueforge`:

| TrueForge primitive | In this app |
| --- | --- |
| `sessions.create` + session memory | `lib/session-store.ts` (in-memory, no DB) |
| Turn + SSE events | `POST /api/analyze` streams activity, `thread.created` / `thread.done`, then `tool.approval_required` |
| Dynamic subagents | `lib/harness/subagents.ts` — Meeting Analyst and Follow-up Writer with separate prompts/context |
| `require_approval_for_tools` | Gated `queue_follow_up_email`; stream ends in a pause |
| `user.tool_approval` | `POST /api/approve` with `allow` or `deny` |

The AgentSpec you would pass to a live TrueForge server lives in `lib/harness/agent-spec.ts` (`dynamic_sub_agents`, MCP tool `queue_follow_up_email` with `require_approval_for_tools`).

On a full TrueForge server you would instead:

1. Run `npx @truefoundry/trueforge` (default `http://localhost:8790`).
2. Configure an OpenAI model provider.
3. Use `@truefoundry/trueforge-sdk`: `sessions.create({ agent: { spec } })` then `createTurnStream`, handle `thread.created` for subagents, and resume with `user.tool_approval` after `tool.approval_required`.

That extra process is optional. The hackathon MVP keeps the **same workflow and approval contract** inside Next.js so a judge can demo with one command and `OPENAI_API_KEY`.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- OpenAI API (`gpt-4o-mini` by default; override with `OPENAI_MODEL`)
- No auth, no database, no Gmail send
