import OpenAI from "openai";

export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Copy .env.example to .env.local and add your key.",
    );
  }
  return new OpenAI({ apiKey });
}

export const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
