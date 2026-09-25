# Meeting Action Agent

Turn messy meetings into clear next steps. Paste a transcript, optionally add a company website, run **Analyze Meeting**, review structured output, then approve or reject the follow-up before any external action.

## Run locally

```bash
cp .env.example .env.local
```

Fill in `.env.local`, then restart the dev server after any change to that file:

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | For live transcripts | Runs Meeting Analyst and Follow-up Writer. If it is empty, **Load Demo Transcript** still runs the canned fixture in `lib/harness/demo-fixture.ts` through the same subagent and approval workflow. |
| `OPENAI_MODEL` | No | Model for both subagents. Defaults to `gpt-4o-mini`. |
| `BRIGHTDATA_API_KEY` | Only if you fill in a company website | Direct API access key for the Bright Data Web Unlocker zone. |
| `BRIGHTDATA_ZONE` | No | Web Unlocker zone name. Defaults to `web_unlocker1`. |

```
OPENAI_API_KEY=sk-...
BRIGHTDATA_API_KEY=...
BRIGHTDATA_ZONE=web_unlocker1
```

Then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Load Demo Transcript**, then **Analyze Meeting**. Leave the company website blank to skip scraping. Real keys stay in `.env.local`, which is gitignored.

## Agents

The root **Meeting Action Agent** is the orchestrator in `lib/harness/run-meeting-turn.ts`. It does not send a planner prompt to a model. Every **Analyze Meeting** click runs the same turn: create a session, call the subagents in order, optionally scrape a company page, then pause for approval.

`lib/harness/agent-spec.ts` is the AgentSpec you would pass to a live TrueForge server (`dynamic_sub_agents`, MCP tool `queue_follow_up_email` with `require_approval_for_tools`). This Next.js app does not send those root instructions to a model.

### Meeting Analyst

Isolated OpenAI call in `lib/harness/subagents.ts` (`gpt-4o-mini`, temperature 0.1). It sees only the transcript and returns JSON:

- decisions
- action items, each with `task`, `owner`, and `deadline`
- open questions

It extracts only what is in the transcript. Missing owners and deadlines display as **Not specified**.

### Follow-up Writer

Second isolated OpenAI call (temperature 0.3). It drafts a short professional email (`subject` and `body`) from the analyst JSON and the transcript. It is instructed not to invent facts.

When a company scrape succeeds, the page is reduced to a company name and industry. Those two fields appear in the results and in the follow-up opening. The analyst still sees only the transcript.

### Approval gate

`queue_follow_up_email` is a gated tool, not an agent. The turn pauses on `tool.approval_required` until the user sends an explicit allow or deny. **Edit** can change the subject and body first; that draft is saved with the decision on `POST /api/approve`.

Approving does not send email. It only marks the session ready for a later external action (`executed` stays false).

## Orchestration

1. Create an in-memory session (`lib/session-store.ts`). Sessions are lost when the server restarts.
2. Open a Meeting Analyst thread and extract decisions, action items, and open questions from the transcript.
3. If the company website field is filled in, scrape it with Bright Data (see below). A missing key or a failed scrape is logged, and the turn continues without company research.
4. Open a Follow-up Writer thread and draft the follow-up email.
5. Stream the result, then pause on `queue_follow_up_email`.

`POST /api/analyze` streams server-sent events: `activity`, `thread.created`, `thread.done`, `result`, and `tool.approval_required`.

## Bright Data company scrape

Company research is optional and runs only when the company website field is set. `lib/brightdata.ts` calls the Web Unlocker Direct API over HTTPS:

`POST https://api.brightdata.com/request`

```json
{
  "zone": "web_unlocker1",
  "url": "https://example.com",
  "format": "raw"
}
```

The request uses `Authorization: Bearer` with `BRIGHTDATA_API_KEY`. The `url` is the company website from the form, not Bright Data’s sample URL. The response body is raw page text. A short follow-up model call turns that text into a company name and an industry.

This path uses the HTTPS Web Unlocker API. It does not open a Scraping Browser WebSocket (`wss://`).

## Where TrueForge is used

TrueForge is the [open-source agent harness](https://trueforge.dev/introduction) this MVP is built around: **Agent → Session → Turn → Events**, plus subagents and **tool approval**.

This demo is meant to run with `npm run dev` only (no second server, no database). The Next.js app therefore hosts an in-process harness that implements the same primitives the TrueForge SDK would drive against `npx @truefoundry/trueforge`:

| TrueForge primitive | In this app |
| --- | --- |
| `sessions.create` + session memory | `lib/session-store.ts` (in-memory, no DB) |
| Turn + SSE events | `POST /api/analyze` streams activity, `thread.created` / `thread.done`, then `tool.approval_required` |
| Subagents | `lib/harness/subagents.ts` — Meeting Analyst and Follow-up Writer with separate prompts and context |
| `require_approval_for_tools` | Gated `queue_follow_up_email`; stream ends in a pause |
| `user.tool_approval` | `POST /api/approve` with `allow` or `deny` |

On a full TrueForge server you would instead:

1. Run `npx @truefoundry/trueforge` (default `http://localhost:8790`).
2. Configure an OpenAI model provider.
3. Use `@truefoundry/trueforge-sdk`: `sessions.create({ agent: { spec } })` then `createTurnStream`, handle `thread.created` for subagents, and resume with `user.tool_approval` after `tool.approval_required`.

That extra process is optional. The hackathon MVP keeps the same workflow and approval contract inside Next.js so a judge can demo with one command and `OPENAI_API_KEY`.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- OpenAI API (`gpt-4o-mini` by default; override with `OPENAI_MODEL`)
- Bright Data Web Unlocker over HTTPS, only when a company URL is provided
- No auth, no database, no email send
