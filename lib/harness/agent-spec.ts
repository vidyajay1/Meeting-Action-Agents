/**
 * TrueForge AgentSpec equivalent for this MVP.
 *
 * On a live TrueForge server (`npx @truefoundry/trueforge`), this is the spec
 * you would pass to `client.sessions.create({ agent: { spec } })`.
 *
 * The in-process harness in `run-meeting-turn.ts` executes the same contract:
 * sessions, turns, dynamic subagents, and a gated tool that pauses for
 * `tool.approval_required` / `user.tool_approval`.
 */
export const meetingActionAgentSpec = {
  model: {
    name: "openai/gpt-4o-mini",
    params: { temperature: 0.2, max_tokens: 2048 },
  },
  instructions: `You are Meeting Action Agent. Given a messy meeting transcript:
1. Delegate extraction of decisions, action items, owners, deadlines, and open questions to the Meeting Analyst subagent.
2. Delegate a concise professional follow-up email to the Follow-up Writer subagent.
3. Call queue_follow_up_email with the draft. This tool requires human approval and must not send mail by itself.`,
  config: {
    dynamic_sub_agents: { enabled: true },
    iteration_limit: 12,
  },
  mcp_servers: [
    {
      name: "meeting-actions",
      enable_tools: ["queue_follow_up_email"],
      require_approval_for_tools: ["queue_follow_up_email"],
    },
  ],
} as const;
