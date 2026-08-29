import type { AgentSession } from "./types";

const globalStore = globalThis as typeof globalThis & {
  meetingActionSessions?: Map<string, AgentSession>;
};

if (!globalStore.meetingActionSessions) {
  globalStore.meetingActionSessions = new Map();
}

export const sessionStore = globalStore.meetingActionSessions;

export function createSession(transcript: string): AgentSession {
  const session: AgentSession = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    transcript,
    analysis: null,
    approvalStatus: "pending",
    toolCallId: null,
    lastTurnStatus: "running",
  };
  sessionStore.set(session.id, session);
  return session;
}

export function getSession(id: string): AgentSession | undefined {
  return sessionStore.get(id);
}

export function updateSession(
  id: string,
  patch: Partial<AgentSession>,
): AgentSession | undefined {
  const current = sessionStore.get(id);
  if (!current) return undefined;
  const next = { ...current, ...patch };
  sessionStore.set(id, next);
  return next;
}
