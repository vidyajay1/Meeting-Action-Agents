import { createSession, getSession, updateSession } from "../session-store";
import type { AnalyzeStreamEvent, MeetingAnalysis } from "../types";
import { runFollowUpWriter, runMeetingAnalyst } from "./subagents";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function emit(
  onEvent: (event: AnalyzeStreamEvent) => void,
  event: AnalyzeStreamEvent,
) {
  onEvent(event);
  await sleep(280);
}

export async function runAnalyzeTurn(
  transcript: string,
  onEvent: (event: AnalyzeStreamEvent) => void,
) {
  const session = createSession(transcript);

  await emit(onEvent, {
    type: "activity",
    step: "reading",
    label: "Reading transcript",
  });

  await emit(onEvent, {
    type: "activity",
    step: "extracting",
    label: "Extracting decisions",
  });

  const analystThreadId = crypto.randomUUID();
  await emit(onEvent, {
    type: "thread.created",
    threadId: analystThreadId,
    title: "Meeting Analyst",
  });

  await emit(onEvent, {
    type: "activity",
    step: "delegating",
    label: "Delegating action-item analysis",
  });

  const extracted = await runMeetingAnalyst(transcript);

  await emit(onEvent, {
    type: "thread.done",
    threadId: analystThreadId,
    title: "Meeting Analyst",
  });

  await emit(onEvent, {
    type: "activity",
    step: "generating",
    label: "Generating follow-up",
  });

  const writerThreadId = crypto.randomUUID();
  await emit(onEvent, {
    type: "thread.created",
    threadId: writerThreadId,
    title: "Follow-up Writer",
  });

  const followUpEmail = await runFollowUpWriter(transcript, extracted);

  await emit(onEvent, {
    type: "thread.done",
    threadId: writerThreadId,
    title: "Follow-up Writer",
  });

  const analysis: MeetingAnalysis = {
    ...extracted,
    followUpEmail,
  };

  const toolCallId = crypto.randomUUID();
  updateSession(session.id, {
    analysis,
    toolCallId,
    lastTurnStatus: "paused",
    approvalStatus: "pending",
  });

  onEvent({ type: "result", sessionId: session.id, analysis });

  await emit(onEvent, {
    type: "activity",
    step: "approval",
    label: "Waiting for human approval",
  });

  onEvent({
    type: "tool.approval_required",
    sessionId: session.id,
    toolCallId,
    tool: "queue_follow_up_email",
  });
}

export function applyApproval(input: {
  sessionId: string;
  toolCallId: string;
  status: "allow" | "deny";
  followUpEmail?: MeetingAnalysis["followUpEmail"];
}) {
  const session = getSession(input.sessionId);
  if (!session) {
    throw new Error("Session not found. Analyze the meeting again.");
  }
  if (session.toolCallId !== input.toolCallId) {
    throw new Error("This approval does not match the paused tool call.");
  }
  if (session.approvalStatus !== "pending") {
    throw new Error("This follow-up has already been decided.");
  }

  const nextAnalysis =
    input.followUpEmail && session.analysis
      ? { ...session.analysis, followUpEmail: input.followUpEmail }
      : session.analysis;

  const updated = updateSession(session.id, {
    analysis: nextAnalysis,
    approvalStatus: input.status === "allow" ? "approved" : "rejected",
    lastTurnStatus: "done",
  });

  return {
    sessionId: session.id,
    approvalStatus: updated!.approvalStatus,
    tool: "queue_follow_up_email",
    executed: false,
    message:
      input.status === "allow"
        ? "Follow-up approved. The agent is ready for the next external action. No email was sent."
        : "Follow-up rejected. The gated send tool was not executed.",
  };
}
