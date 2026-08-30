import { runAnalyzeTurn } from "@/lib/harness/run-meeting-turn";

import type { AnalyzeStreamEvent } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { transcript?: string; companyUrl?: string };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const transcript = body.transcript?.trim();
  const companyUrl = body.companyUrl?.trim();

  if (!transcript) {
    return Response.json(
      { error: "Paste a meeting transcript before analyzing." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AnalyzeStreamEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        await runAnalyzeTurn(transcript, send, companyUrl);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "The agent failed to analyze this meeting.";

        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}














