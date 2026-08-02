import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const GROQ_API_URL = process.env.AI_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.AI_API_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const PROVIDER_TIMEOUT_MS = 30_000;
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);

type ScoreResponse = {
  overallScore: number;
  hardSkillsScore: number;
  softSkillsScore: number;
  experienceScore: number;
  educationScore: number;
  formatScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  skillGaps: string[];
  strengths: string[];
  recommendations: string[];
};

type ScoreProvider = {
  name: "Groq" | "Gemini" | "Cerebras";
  url: string;
  apiKey: string;
  model: string;
  kind: "openai" | "gemini";
};

/** Calls Groq, Gemini, then Cerebras with the exact same scoring prompt. */
async function scoreCandidateWithFallback(
  candidateName: string,
  resumeText: string,
  candidateSkills: string[],
  experienceYears: number,
  education: string | null,
  jobTitle: string,
  jobDescription: string | null,
  jobRequirements: string | null,
  requiredSkills: string[],
  experienceMin: number,
  educationLevel: string | null,
): Promise<ScoreResponse> {
  const systemPrompt = `You are an expert ATS (Applicant Tracking System) AI scorer. Your job is to evaluate how well a candidate matches a job vacancy. You must respond with ONLY valid JSON — no markdown, no explanation, no code fences.`;

  const userPrompt = `Analyse the following candidate against the job vacancy and provide a detailed scoring breakdown.

## Job Vacancy
- Title: ${jobTitle}
- Description: ${jobDescription ?? "N/A"}
- Requirements: ${jobRequirements ?? "N/A"}
- Required Skills: ${requiredSkills.join(", ") || "N/A"}
- Minimum Experience: ${experienceMin} years
- Education Level: ${educationLevel ?? "N/A"}

## Candidate
- Name: ${candidateName}
- Resume/Profile Text: ${(resumeText ?? "").slice(0, 4000)}
- Skills: ${candidateSkills.join(", ") || "N/A"}
- Experience Years: ${experienceYears}
- Education: ${education ?? "N/A"}

## Instructions
Score each category from 0-100 based on how well the candidate matches the vacancy requirements:
- overallScore: Weighted overall match score (0-100)
- hardSkillsScore: How well candidate's skills match required skills (0-100)
- softSkillsScore: Assessment of soft skills from resume (0-100)
- experienceScore: How candidate's experience meets minimum requirements (0-100)
- educationScore: How candidate's education meets requirements (0-100)
- formatScore: Resume quality, formatting, clarity (0-100)
- matchedKeywords: Array of skills/keywords that match the job requirements
- missingKeywords: Array of required skills/keywords the candidate is missing
- skillGaps: Array of specific skill gap descriptions
- strengths: Array of 2-3 candidate strengths
- recommendations: Array of 2-3 actionable recommendations

Respond with ONLY a JSON object matching this structure:
{"overallScore":0,"hardSkillsScore":0,"softSkillsScore":0,"experienceScore":0,"educationScore":0,"formatScore":0,"matchedKeywords":[],"missingKeywords":[],"skillGaps":[],"strengths":[],"recommendations":[]}`;

  const providers: ScoreProvider[] = [
    {
      name: "Groq",
      url: GROQ_API_URL,
      apiKey: GROQ_API_KEY,
      model: GROQ_MODEL,
      kind: "openai",
    },
    {
      name: "Gemini",
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY ?? ""}`,
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: "gemini-2.5-flash",
      kind: "gemini",
    },
    {
      name: "Cerebras",
      url: process.env.CEREBRAS_API_URL ?? "https://api.cerebras.ai/v1/chat/completions",
      apiKey: process.env.CEREBRAS_API_KEY ?? "",
      model: process.env.CEREBRAS_MODEL ?? "gemma-4-31b",
      kind: "openai",
    },
  ];

  const errors: string[] = [];
  for (const provider of providers) {
    if (!provider.apiKey) {
      errors.push(`${provider.name}: API key is not configured`);
      continue;
    }

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
        const isGemini = provider.kind === "gemini";
        let response: Response;
        try {
          response = await fetch(provider.url, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              ...(isGemini ? {} : { Authorization: `Bearer ${provider.apiKey}` }),
            },
            body: JSON.stringify(
              isGemini
                ? {
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                    generationConfig: {
                      temperature: 0.3,
                      maxOutputTokens: 2000,
                      responseMimeType: "application/json",
                    },
                  }
                : {
                    model: provider.model,
                    messages: [
                      { role: "system", content: systemPrompt },
                      { role: "user", content: userPrompt },
                    ],
                    temperature: 0.3,
                    max_tokens: 2000,
                    response_format: { type: "json_object" },
                  },
            ),
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const detail = (await response.text()).slice(0, 500);
          const message = `${provider.name} API error (${response.status}): ${detail}`;
          if (TRANSIENT_STATUSES.has(response.status) && attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
            continue;
          }
          throw new Error(message);
        }

        const data = await response.json();
        const content: string = isGemini
          ? (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "")
          : (data.choices?.[0]?.message?.content ?? "");
        if (!content) throw new Error(`${provider.name} returned an empty response`);
        const parsed = JSON.parse(content) as ScoreResponse;
        const clamp = (value: number) =>
          Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        console.info(`AI score completed via ${provider.name}`);
        return {
          overallScore: clamp(parsed.overallScore),
          hardSkillsScore: clamp(parsed.hardSkillsScore),
          softSkillsScore: clamp(parsed.softSkillsScore),
          experienceScore: clamp(parsed.experienceScore),
          educationScore: clamp(parsed.educationScore),
          formatScore: clamp(parsed.formatScore),
          matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
          missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
          skillGaps: Array.isArray(parsed.skillGaps) ? parsed.skillGaps : [],
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt < 2 && /abort|timeout|fetch failed|network/i.test(message)) {
          await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
          continue;
        }
        errors.push(`${provider.name}: ${message}`);
        break;
      }
    }
  }

  throw new Error(`All AI scoring providers failed. ${errors.join(" | ")}`);
}

/**
 * Scores a single application by fetching candidate + vacancy data,
 * calling Groq, and upserting the CandidateScore record.
 */
async function scoreApplication(applicationId: string): Promise<ScoreResponse> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      candidate: true,
      vacancy: { include: { department: true } },
      candidateScore: true,
    },
  });

  if (!application) {
    throw new Error("Application not found");
  }

  // Fetch candidate profile (resume text, skills, etc.)
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId: application.candidateId },
  });

  const resumeText =
    profile?.resumeText ??
    profile?.summary ??
    profile?.headline ??
    "";
  const candidateSkills = profile?.skills ?? [];
  const experienceYears = profile?.experienceYears ?? 0;
  const education = profile?.education ?? null;

  const vacancy = application.vacancy;

  const scores = await scoreCandidateWithFallback(
    application.candidate.name,
    resumeText,
    candidateSkills,
    experienceYears,
    education,
    vacancy.title,
    vacancy.description,
    vacancy.requirements,
    vacancy.skills,
    vacancy.experienceMin,
    vacancy.educationLevel,
  );

  // Upsert the CandidateScore record
  if (application.candidateScore) {
    await prisma.candidateScore.update({
      where: { applicationId: application.id },
      data: {
        overallScore: scores.overallScore,
        hardSkillsScore: scores.hardSkillsScore,
        softSkillsScore: scores.softSkillsScore,
        experienceScore: scores.experienceScore,
        educationScore: scores.educationScore,
        formatScore: scores.formatScore,
        matchedKeywords: scores.matchedKeywords,
        missingKeywords: scores.missingKeywords,
        skillGaps: scores.skillGaps,
        strengths: scores.strengths,
        recommendations: scores.recommendations,
        scoredAt: new Date(),
      },
    });
  } else {
    await prisma.candidateScore.create({
      data: {
        applicationId: application.id,
        overallScore: scores.overallScore,
        hardSkillsScore: scores.hardSkillsScore,
        softSkillsScore: scores.softSkillsScore,
        experienceScore: scores.experienceScore,
        educationScore: scores.educationScore,
        formatScore: scores.formatScore,
        matchedKeywords: scores.matchedKeywords,
        missingKeywords: scores.missingKeywords,
        skillGaps: scores.skillGaps,
        strengths: scores.strengths,
        recommendations: scores.recommendations,
      },
    });
  }

  return scores;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { applicationId, applicationIds, scanAll, vacancyId, cursor } = body as {
      applicationId?: string;
      applicationIds?: string[];
      scanAll?: boolean;
      vacancyId?: string;
      cursor?: string;
    };

    if (scanAll || vacancyId || applicationIds?.length) {
      const normalizedIds = Array.isArray(applicationIds)
        ? applicationIds.filter((id): id is string => typeof id === "string").slice(0, 25)
        : [];
      const baseWhere = {
        deletedAt: null,
        ...(vacancyId ? { vacancyId } : {}),
      };
      const [batch, total] = await Promise.all([
        prisma.application.findMany({
          where: {
            ...baseWhere,
            ...(normalizedIds.length
              ? { id: { in: normalizedIds } }
              : cursor
                ? { id: { gt: cursor } }
                : {}),
          },
          take: normalizedIds.length || 5,
          orderBy: { id: "asc" },
          select: { id: true },
        }),
        normalizedIds.length
          ? Promise.resolve(normalizedIds.length)
          : prisma.application.count({ where: baseWhere }),
      ]);

      // Three concurrent candidates balances throughput against provider quotas.
      // Each result is isolated, so partial successes are always persisted.
      const results: { id: string; success: boolean; error?: string }[] = [];
      for (let index = 0; index < batch.length; index += 3) {
        const chunkResults = await Promise.all(
          batch.slice(index, index + 3).map(async (app) => {
            try {
              await scoreApplication(app.id);
              return { id: app.id, success: true };
            } catch (err) {
              return {
                id: app.id,
                success: false,
                error: err instanceof Error ? err.message : "Unknown error",
              };
            }
          }),
        );
        results.push(...chunkResults);
        if (index + 3 < batch.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      const nextCursor = batch.at(-1)?.id ?? null;
      const hasMore = normalizedIds.length === 0 && nextCursor
        ? await prisma.application.count({
            where: { ...baseWhere, id: { gt: nextCursor } },
          }).then((count) => count > 0)
        : false;
      revalidatePath("/ai-scoring");
      if (vacancyId) revalidatePath(`/jobs/${vacancyId}/candidates`);
      return NextResponse.json({
        scanned: results.length,
        successCount: results.filter((result) => result.success).length,
        failureCount: results.filter((result) => !result.success).length,
        failedIds: results.filter((result) => !result.success).map((result) => result.id),
        hasMore,
        nextCursor,
        total,
        results,
        success: true,
      });
    }

    if (!applicationId) {
      return NextResponse.json(
        { error: "applicationId is required (or set scanAll: true or vacancyId)" },
        { status: 400 },
      );
    }

    const scores = await scoreApplication(applicationId);
    revalidatePath("/ai-scoring");
    revalidatePath(`/candidates/${applicationId}`);

    return NextResponse.json({ scores, success: true });
  } catch (error) {
    console.error("AI scoring error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to score candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
