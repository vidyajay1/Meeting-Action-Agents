import { getOpenAI, MODEL } from "../openai";
import type { ActionItem, FollowUpEmail, MeetingAnalysis } from "../types";
import { DEMO_ANALYSIS, isDemoTranscript } from "./demo-fixture";

function asString(value: unknown, fallback = "Not specified"): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed) || /^none$/i.test(trimmed) || /^unknown$/i.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function parseJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  return JSON.parse(raw);
}

function useFixture(transcript: string) {
  return !process.env.OPENAI_API_KEY && isDemoTranscript(transcript);
}

export async function runMeetingAnalyst(transcript: string): Promise<{
  decisions: string[];
  actionItems: ActionItem[];
  openQuestions: string[];
}> {
  if (useFixture(transcript)) {
    const { decisions, actionItems, openQuestions } = DEMO_ANALYSIS;
    return { decisions, actionItems, openQuestions };
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Meeting Analyst subagent in a TrueForge-style harness.
Extract only what is present in the transcript. Do not invent owners or deadlines.
Return strict JSON:
{
  "decisions": ["..."],
  "actionItems": [{ "task": "...", "owner": "...", "deadline": "..." }],
  "openQuestions": ["..."]
}
If owner or deadline is missing, use "Not specified".`,
      },
      {
        role: "user",
        content: `Meeting transcript:\n\n${transcript}`,
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Meeting Analyst returned an empty response.");
  }

  const parsed = parseJson(content) as Record<string, unknown>;
  const actionItems = Array.isArray(parsed.actionItems)
    ? parsed.actionItems.map((item) => {
        const row = (item ?? {}) as Record<string, unknown>;
        return {
          task: asString(row.task, "Untitled task"),
          owner: asString(row.owner),
          deadline: asString(row.deadline),
        };
      })
    : [];

  return {
    decisions: asStringArray(parsed.decisions),
    actionItems,
    openQuestions: asStringArray(parsed.openQuestions),
  };
}

export async function runFollowUpWriter(
  transcript: string,
  analysis: Pick<MeetingAnalysis, "decisions" | "actionItems" | "openQuestions">,
): Promise<FollowUpEmail> {
  if (useFixture(transcript)) {
    return DEMO_ANALYSIS.followUpEmail;
  }

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are the Follow-up Writer subagent. Write a concise professional follow-up email from the structured analysis.
Return strict JSON:
{
  "subject": "...",
  "body": "..."
}
Keep the body short: greeting, decisions, action items with owners/dates, open questions, and a closing. Do not invent facts.`,
      },
      {
        role: "user",
        content: JSON.stringify({ transcript, analysis }, null, 2),
      },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Follow-up Writer returned an empty response.");
  }

  const parsed = parseJson(content) as Record<string, unknown>;
  return {
    subject: asString(parsed.subject, "Meeting follow-up"),
    body: asString(parsed.body, "Thanks for the discussion. We will follow up on next steps."),
  };
}
