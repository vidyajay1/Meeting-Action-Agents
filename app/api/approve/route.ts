import { applyApproval } from "@/lib/harness/run-meeting-turn";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const toolCallId = typeof body.toolCallId === "string" ? body.toolCallId : "";
    const status = body.status === "allow" || body.status === "deny" ? body.status : null;
    const followUpEmail =
      body.followUpEmail &&
      typeof body.followUpEmail.subject === "string" &&
      typeof body.followUpEmail.body === "string"
        ? body.followUpEmail
        : undefined;

    if (!sessionId || !toolCallId || !status) {
      return Response.json(
        { error: "sessionId, toolCallId, and status (allow|deny) are required." },
        { status: 400 },
      );
    }

    const result = applyApproval({ sessionId, toolCallId, status, followUpEmail });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
