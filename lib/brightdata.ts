const BRIGHTDATA_ENDPOINT = "https://api.brightdata.com/request";

export async function scrapeWithBrightData(url: string): Promise<string> {
  const apiKey = process.env.BRIGHTDATA_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing BRIGHTDATA_API_KEY. Add it to .env.local to research a company URL.",
    );
  }

  const zone = process.env.BRIGHTDATA_ZONE?.trim() || "web_unlocker1";
  const target = url.trim();
  if (!target) {
    throw new Error("Company URL is empty.");
  }

  const response = await fetch(BRIGHTDATA_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      zone,
      url: target,
      format: "raw",
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Bright Data request failed (${response.status}): ${body.slice(0, 300)}`,
    );
  }
  if (!body.trim()) {
    throw new Error("Bright Data returned an empty page.");
  }

  return body;
}
