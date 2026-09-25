"use client";

import { useMemo, useState } from "react";
import { DEMO_TRANSCRIPT } from "@/lib/harness/demo-fixture";
import type { ActivityStep, AnalyzeStreamEvent, MeetingAnalysis } from "@/lib/types";

const ACTIVITY_STEPS: { id: ActivityStep; label: string }[] = [
  { id: "reading", label: "Reading transcript" },
  { id: "extracting", label: "Extracting decisions" },
  { id: "delegating", label: "Delegating action-item analysis" },
  { id: "researching", label: "Researching company with Bright Data" },  
  { id: "generating", label: "Generating follow-up" },
  { id: "approval", label: "Waiting for human approval" },
];

function displayValue(value: string) {
  return value?.trim() ? value : "Not specified";
}

function parseSseChunk(buffer: string): { events: AnalyzeStreamEvent[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: AnalyzeStreamEvent[] = [];
  for (const part of parts) {
    const line = part
      .split("\n")
      .find((row) => row.startsWith("data: "));
    if (!line) continue;
    events.push(JSON.parse(line.slice(6)) as AnalyzeStreamEvent);
  }
  return { events, rest };
}

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MeetingAnalysis | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [toolCallId, setToolCallId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ActivityStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<ActivityStep>>(new Set());
  const [approval, setApproval] = useState<"pending" | "approved" | "rejected" | null>(null);
  const [editing, setEditing] = useState(false);
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });
  const [confirmNote, setConfirmNote] = useState<string | null>(null);

  const canAnalyze = transcript.trim().length > 0 && !busy;

  const activityState = useMemo(() => {
    return ACTIVITY_STEPS.map((step) => {
      const done = completedSteps.has(step.id);
      const active = currentStep === step.id;
      return { ...step, done, active };
    });
  }, [completedSteps, currentStep]);

  async function analyzeMeeting() {
    setBusy(true);
    setError(null);
    setAnalysis(null);
    setSessionId(null);
    setToolCallId(null);
    setApproval(null);
    setEditing(false);
    setConfirmNote(null);
    setCompletedSteps(new Set());
    setCurrentStep("reading");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, companyUrl  }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Analyze Meeting failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let researched = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseChunk(buffer);
        buffer = parsed.rest;

                        for (const event of parsed.events) {
          if (event.type === "activity") {
            if (event.step === "researching") researched = true;
            const idx = ACTIVITY_STEPS.findIndex((step) => step.id === event.step);
            setCurrentStep(event.step);
            setCompletedSteps(
              new Set(
                ACTIVITY_STEPS.slice(0, Math.max(idx, 0))
                  .map((step) => step.id)
                  .filter((id) => id !== "researching" || researched),
              ),
            );
          }
          if (event.type === "result") {
            setAnalysis(event.analysis);
            setSessionId(event.sessionId);
            setEmailDraft(event.analysis.followUpEmail);
          }
          if (event.type === "tool.approval_required") {
            setToolCallId(event.toolCallId);
            setSessionId(event.sessionId);
            setApproval("pending");
            setCurrentStep("approval");
            setCompletedSteps(
              new Set(
                researched
                  ? ["reading", "extracting", "delegating", "researching", "generating"]
                  : ["reading", "extracting", "delegating", "generating"],
              ),
            );
          }
          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The agent could not complete this run.");
      setCurrentStep(null);
    } finally {
      setBusy(false);
    }
  }

  async function decide(status: "allow" | "deny") {
    if (!sessionId || !toolCallId) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          toolCallId,
          status,
          followUpEmail: emailDraft,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Approval failed.");
      }
      if (status === "allow") {
        setApproval("approved");
        setEditing(false);
        setConfirmNote(payload.message);
        setCompletedSteps((prev) => {
          const next = new Set(["reading", "extracting", "delegating", "generating", "approval"]);
          if (prev.has("researching")) next.add("researching");
          return next;
        });
        setCurrentStep(null);
      } else {
        setApproval("rejected");
        setConfirmNote(payload.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-indigo-600 uppercase">
            TrueForge harness
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Meeting Action Agent
          </h1>
          <p className="mt-2 max-w-2xl text-base text-slate-600 sm:text-lg">
            Turn messy meetings into clear next steps.
          </p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8">
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">
                Transcript
              </h2>
              <button
                type="button"
                onClick={() => setTranscript(DEMO_TRANSCRIPT)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Load Demo Transcript
              </button>
            </div>
            <input
  		type="url"
  		value={companyUrl}
  		onChange={(event) => setCompanyUrl(event.target.value)}
  		placeholder="Company website (e.g. https://www.airbnb.com)"
  		className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none ring-indigo-500 placeholder:text-slate-400 focus:bg-white focus:ring-2"
	    />
	    <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Paste your meeting transcript here..."
              className="min-h-56 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none ring-indigo-500 placeholder:text-slate-400 focus:bg-white focus:ring-2"
            />
            <button
              type="button"
              disabled={!canAnalyze}
              onClick={analyzeMeeting}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {busy && !analysis ? "Analyzing…" : "Analyze Meeting"}
            </button>
            {error ? (
              <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-semibold tracking-wide text-slate-800 uppercase">
              Agent Activity
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Root agent delegates to subagents, then pauses at the approval gate.
            </p>
            <ol className="mt-5 space-y-3">
              {activityState.map((step) => {
                const icon = step.done
                  ? "✓"
                  : step.id === "approval" && (step.active || approval === "pending")
                    ? "⚠"
                    : step.active
                      ? "…"
                      : "○";
                const tone = step.done
                  ? "text-emerald-700"
                  : step.id === "approval" && (step.active || approval === "pending")
                    ? "text-amber-700"
                    : step.active
                      ? "text-indigo-700"
                      : "text-slate-400";
                return (
                  <li key={step.id} className={`flex items-start gap-3 text-sm ${tone}`}>
                    <span className="mt-0.5 w-4 font-semibold">{icon}</span>
                    <span className={step.active && !step.done ? "font-medium" : ""}>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </aside>
        </section>

        {busy && !analysis ? (
          <section className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center text-sm text-slate-500">
            The agent is working — Meeting Analyst and Follow-up Writer are running as isolated subagents.
          </section>
        ) : null}

        {analysis ? (
          <section className="grid gap-5 md:grid-cols-2">
            {analysis.companyError ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 md:col-span-2">
                Company research failed. {analysis.companyError}
              </p>
            ) : null}
            {analysis.company ? (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
                <h3 className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                  Company
                </h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Name</dt>
                    <dd className="mt-1 text-slate-800">{displayValue(analysis.company.name)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Industry</dt>
                    <dd className="mt-1 text-slate-800">{displayValue(analysis.company.industry)}</dd>
                  </div>
                </dl>
              </article>
            ) : null}
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Decisions
              </h3>
              {analysis.decisions.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-800">
                  {analysis.decisions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No decisions were identified.</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
              <h3 className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Action Items
              </h3>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-4 font-medium">Task</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 font-medium">Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.actionItems.length ? (
                      analysis.actionItems.map((item) => (
                        <tr key={`${item.task}-${item.owner}`} className="border-b border-slate-100">
                          <td className="py-2.5 pr-4 text-slate-800">{item.task}</td>
                          <td className="py-2.5 pr-4 text-slate-700">{displayValue(item.owner)}</td>
                          <td className="py-2.5 text-slate-700">{displayValue(item.deadline)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-3 text-slate-500">
                          No action items were identified.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Open Questions
              </h3>
              {analysis.openQuestions.length ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-800">
                  {analysis.openQuestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">No open questions were identified.</p>
              )}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
              <h3 className="text-xs font-semibold tracking-[0.16em] text-slate-500 uppercase">
                Follow-up Email
              </h3>
              {editing ? (
                <div className="mt-3 space-y-3">
                  <input
                    value={emailDraft.subject}
                    onChange={(event) =>
                      setEmailDraft((prev) => ({ ...prev, subject: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <textarea
                    value={emailDraft.body}
                    onChange={(event) =>
                      setEmailDraft((prev) => ({ ...prev, body: event.target.value }))
                    }
                    className="min-h-48 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Subject: {emailDraft.subject || analysis.followUpEmail.subject}
                  </p>
                  <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
                    {emailDraft.body || analysis.followUpEmail.body}
                  </pre>
                </div>
              )}

              <div className="mt-5 border-t border-slawte-200 pt-5">
                <h4 className="text-sm font-semibold text-slate-900">Human Approval Required</h4>
                {approval === "approved" ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-800">✓ Follow-up approved</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      {confirmNote ??
                        "The agent is ready for the next external action. No email was sent."}
                    </p>
                  </div>
                ) : approval === "rejected" ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Follow-up rejected. The gated tool did not run.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => decide("allow")}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
                    >
                      Approve Follow-up
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditing((value) => !value)}
                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => decide("deny")}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </article>
          </section>
        ) : null}
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-5 py-4 text-sm text-slate-500 sm:px-8">
          Built with TrueForge
        </div>
      </footer>
    </div>
  );
}
