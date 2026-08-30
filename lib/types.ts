export type ActionItem = {
  task: string;
  owner: string;
  deadline: string;
};

export type FollowUpEmail = {
  subject: string;
  body: string;
};

export type MeetingAnalysis = {
  decisions: string[];
  actionItems: ActionItem[];
  openQuestions: string[];
  followUpEmail: FollowUpEmail;
};

export type ActivityStep =
  | "reading"
  | "extracting"
  | "delegating"
  | "researching"
  | "generating"
  | "approval";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type AgentSession = {
  id: string;
  createdAt: string;
  transcript: string;
  analysis: MeetingAnalysis | null;
  approvalStatus: ApprovalStatus;
  toolCallId: string | null;
  lastTurnStatus: "running" | "paused" | "done" | "error";
};

export type AnalyzeStreamEvent =
  | { type: "activity"; step: ActivityStep; label: string }
  | { type: "thread.created"; threadId: string; title: string }
  | { type: "thread.done"; threadId: string; title: string }
  | { type: "tool.approval_required"; sessionId: string; toolCallId: string; tool: string }
  | { type: "result"; sessionId: string; analysis: MeetingAnalysis }
  | { type: "error"; message: string };
