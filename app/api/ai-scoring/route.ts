import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const GROQ_API_URL = process.env.AI_API_URL || "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.AI_API_KEY || "";
const GROQ_MODEL = "llama-3.3-70b-versatile";

type GroqScoreResponse = {
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

/**
 * Calls the Groq API to analyse a candidate's resume/profile against a
 * vacancy's requirements and returns structured scoring data.
 */
async function scoreCandidateWithGroq(
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
): Promise<GroqScoreResponse> {
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

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Groq API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Groq API returned empty response");
  }

  const parsed = JSON.parse(content) as GroqScoreResponse;

  // Clamp all scores to 0-100
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
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
}

/**
 * Scores a single application by fetching candidate + vacancy data,
 * calling Groq, and upserting the CandidateScore record.
 */
async function scoreApplication(applicationId: string): Promise<GroqScoreResponse> {
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

  const scores = await scoreCandidateWithGroq(
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
    const { applicationId, scanAll } = body as {
      applicationId?: string;
      scanAll?: boolean;
    };

    if (scanAll) {
      // Score all applications that don't have a score yet (limit to 10 per batch)
      const unscored = await prisma.application.findMany({
        where: {
          deletedAt: null,
          candidateScore: null,
        },
        take: 10,
        orderBy: { appliedAt: "desc" },
        select: { id: true },
      });

      const results: { id: string; success: boolean; error?: string }[] = [];
      for (const app of unscored) {
        try {
          await scoreApplication(app.id);
          results.push({ id: app.id, success: true });
        } catch (err) {
          results.push({
            id: app.id,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      revalidatePath("/ai-scoring");
      return NextResponse.json({
        scanned: results.length,
        results,
        success: true,
      });
    }

    if (!applicationId) {
      return NextResponse.json(
        { error: "applicationId is required (or set scanAll: true)" },
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
