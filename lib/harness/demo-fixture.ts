import type { MeetingAnalysis } from "../types";

export const DEMO_TRANSCRIPT =
  "Alex: We need to launch the new customer portal by September 15. Priya will own the frontend work and should have the first version ready by September 5. Marcus will handle the API migration and send the updated API documentation by Friday. We agreed that the beta will go to 20 customers first. We still need to decide who will monitor production after launch and whether we need a rollback plan. Let's regroup next Tuesday.";

export const DEMO_ANALYSIS: MeetingAnalysis = {
  decisions: [
    "Launch the new customer portal by September 15.",
    "Beta will go to 20 customers first.",
    "The team will regroup next Tuesday.",
  ],
  actionItems: [
    {
      task: "Own frontend work and deliver the first version of the customer portal",
      owner: "Priya",
      deadline: "September 5",
    },
    {
      task: "Handle the API migration",
      owner: "Marcus",
      deadline: "Not specified",
    },
    {
      task: "Send updated API documentation",
      owner: "Marcus",
      deadline: "Friday",
    },
  ],
  openQuestions: [
    "Who will monitor production after launch?",
    "Do we need a rollback plan?",
  ],
  company: null,
  companyError: null,
  followUpEmail: {
    subject: "Follow-up: Customer portal launch (Sept 15) and next Tuesday regroup",
    body: `Hi team,

Thanks for today's discussion. Capturing decisions and next steps below.

Decisions
- Launch the new customer portal by September 15.
- Beta release will go to 20 customers first.
- We will regroup next Tuesday.

Action items
- Priya: own frontend work, with a first version ready by September 5.
- Marcus: handle the API migration.
- Marcus: send updated API documentation by Friday.

Open questions
- Who will monitor production after launch?
- Do we need a rollback plan?

Please reply with any corrections before we proceed.

Thanks,
Meeting Action Agent`,
  },
};

export function isDemoTranscript(transcript: string) {
  return transcript.trim() === DEMO_TRANSCRIPT.trim();
}
