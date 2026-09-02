import { prisma } from "@/lib/prisma";
import { sanitizeForPostgres } from "@/lib/sanitize";

/**
 * AI summarization for interview transcripts.
 *
 * Reuses the same three-provider fallback chain as CV parsing
 * (lib/cv-parser.ts): Groq (primary) → Google Gemini → Cerebras.
 * No new AI service or API key is introduced.
 *
 * Called by POST /api/interview-transcripts/complete when the Chrome
 * extension signals that a Meet session has ended.
 */

type TranscriptLine = {
  speaker: string;
  text: string;
  timestamp: number;
};

const SUMMARY_SYSTEM_PROMPT =
  "You are an expert HR interview analyst. You write concise, factual, well-structured interview summaries in markdown. You never invent information that is not in the transcript.";

function buildSummaryPrompt(candidateName: string, transcriptText: string): string {
  return `Summarize the following interview transcript for candidate "${candidateName}".

Produce a markdown summary with EXACTLY these sections:

## Key Points
- 3-6 bullet points covering the main topics discussed and important facts established (experience, skills, motivations, logistics like salary/notice period if mentioned).

## Notable Candidate Responses
- 2-5 bullets quoting or closely paraphrasing the candidate's most significant answers (strengths, achievements, red flags, concerns). Attribute to the candidate, not the interviewer.

## Overall Impression Cues
- 2-4 bullets with observable signals (communication style, confidence, technical depth, culture-fit hints). Stay factual — these are cues for the HR reviewer, not a verdict.

Rules:
- Use ONLY information present in the transcript. Do not speculate.
- If the transcript is very short or mostly small talk, say so plainly in Key Points.
- Keep the whole summary under 400 words.

Transcript:
${transcriptText.slice(0, 60000)}`;
}

/** Renders stored JSON lines into "Speaker (hh:mm:ss): text" plain text. */
export function renderTranscriptText(lines: TranscriptLine[]): string {
  return lines
    .map((line) => {
      const totalSeconds = Math.floor(line.timestamp / 1000);
      const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
      const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
      const ss = String(totalSeconds % 60).padStart(2, "0");
      return `${line.speaker} (${hh}:${mm}:${ss}): ${line.text}`;
    })
    .join("\n");
}

/**
 * Fetch with an abort-based timeout so a hung AI provider (rate-limited or
 * overloaded) cannot block the summarization request forever. The AbortError
 * is caught by each provider's try/catch, which returns null so the
 * orchestrator moves on to the next provider.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const AI_PROVIDER_TIMEOUT_MS = 45_000;

// ── Provider 1: Groq (OpenAI-compatible) ─────────────────────────────────────

async function summarizeWithGroq(
  candidateName: string,
  transcriptText: string,
): Promise<string | null> {
  const apiUrl = process.env.AI_API_URL;
  const apiKey = process.env.AI_API_KEY;
  if (!apiUrl || !apiKey) {
    console.error("[transcript-ai] Missing AI_API_URL or AI_API_KEY");
    return null;
  }

  try {
    const res = await fetchWithTimeout(
      apiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: SUMMARY_SYSTEM_PROMPT },
            {
              role: "user",
              content: buildSummaryPrompt(candidateName, transcriptText),
            },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      },
      AI_PROVIDER_TIMEOUT_MS,
    );

    if (!res.ok) {
      console.error(
        `[transcript-ai] Groq error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
      return null;
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    return content.trim() || null;
  } catch (err) {
    console.error("[transcript-ai] Groq fetch failed:", err);
    return null;
  }
}

// ── Provider 2: Google Gemini ────────────────────────────────────────────────

async function summarizeWithGemini(
  candidateName: string,
  transcriptText: string,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[transcript-ai] Missing GEMINI_API_KEY");
    return null;
  }

  try {
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SUMMARY_SYSTEM_PROMPT }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: buildSummaryPrompt(candidateName, transcriptText) }],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      },
      AI_PROVIDER_TIMEOUT_MS,
    );

    if (!res.ok) {
      console.error(
        `[transcript-ai] Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
      return null;
    }

    const data = await res.json();
    const content: string =
      data.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("\n")
        .trim() ?? "";
    return content || null;
  } catch (err) {
    console.error("[transcript-ai] Gemini fetch failed:", err);
    return null;
  }
}

// ── Provider 3: Cerebras (OpenAI-compatible) ─────────────────────────────────

async function summarizeWithCerebras(
  candidateName: string,
  transcriptText: string,
): Promise<string | null> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) {
    console.error("[transcript-ai] Missing CEREBRAS_API_KEY");
    return null;
  }

  const apiUrl =
    process.env.CEREBRAS_API_URL ?? "https://api.cerebras.ai/v1/chat/completions";
  const model = process.env.CEREBRAS_MODEL ?? "gemma-4-31b";

  try {
    const res = await fetchWithTimeout(
      apiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SUMMARY_SYSTEM_PROMPT },
            {
              role: "user",
              content: buildSummaryPrompt(candidateName, transcriptText),
            },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
      },
      AI_PROVIDER_TIMEOUT_MS,
    );

    if (!res.ok) {
      console.error(
        `[transcript-ai] Cerebras error ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
      return null;
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    return content.trim() || null;
  } catch (err) {
    console.error("[transcript-ai] Cerebras fetch failed:", err);
    return null;
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

/**
 * Generates and persists the AI summary for a completed transcript.
 * Tries Groq → Gemini → Cerebras in order; on total failure records the
 * error on the row (aiError) so the UI can offer a manual retry.
 *
 * @returns the provider that succeeded, or null if all failed.
 */
export async function summarizeInterviewTranscript(
  transcriptId: string,
): Promise<string | null> {
  const transcript = await prisma.interviewTranscript.findUnique({
    where: { id: transcriptId },
    include: { application: { include: { candidate: true } } },
  });
  if (!transcript) {
    console.error("[transcript-ai] Transcript not found:", transcriptId);
    return null;
  }

  const lines = (transcript.lines as TranscriptLine[]) ?? [];
  if (lines.length === 0) {
    await prisma.interviewTranscript.update({
      where: { id: transcriptId },
      data: { aiError: "No transcript lines captured — nothing to summarize." },
    });
    return null;
  }

  const candidateName = transcript.application.candidate.name;
  const transcriptText = renderTranscriptText(lines);

  const providers: Array<[string, () => Promise<string | null>]> = [
    ["groq", () => summarizeWithGroq(candidateName, transcriptText)],
    ["gemini", () => summarizeWithGemini(candidateName, transcriptText)],
    ["cerebras", () => summarizeWithCerebras(candidateName, transcriptText)],
  ];

  for (const [provider, run] of providers) {
    const summary = await run();
    if (summary) {
      // Strip null bytes / invalid control characters before the Prisma
      // write — Postgres text columns reject them (error 22021).
      const cleanSummary = sanitizeForPostgres(summary);
      await prisma.interviewTranscript.update({
        where: { id: transcriptId },
        data: { aiSummary: cleanSummary, aiProvider: provider, aiError: null },
      });
      console.log(`[transcript-ai] Summarized transcript ${transcriptId} via ${provider}`);
      return provider;
    }
    console.log(`[transcript-ai] ${provider} failed, trying next provider...`);
  }

  await prisma.interviewTranscript.update({
    where: { id: transcriptId },
    data: { aiError: "All AI providers failed to summarize this transcript." },
  });
  return null;
}
