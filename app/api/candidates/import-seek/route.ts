import { NextRequest, NextResponse } from "next/server";
import {
  createCandidateFromUpload,
  findOrCreateGeneralVacancy,
  type ParsedCandidate,
} from "@/lib/data-access";
import { prisma } from "@/lib/prisma";
import {
  extractAllFromQuestions,
  parseSalaryToNumber,
  type ApplicationQuestionLike,
} from "@/lib/salary-experience-parser";

/**
 * POST /api/candidates/import-seek
 *
 * Receives a batch of candidates scraped from SEEK Employer and imports them
 * into the ATS. This is the counterpart to the seek-scraper's
 * `postCandidateBatch()` function.
 *
 * Auth: `x-api-key: nuanu-seek-secret-2026` header (same key as the legacy
 * backend on hr-ats.nuanu.site).
 *
 * Request body:
 *   { candidates: SeekCandidate[] }
 *
 * Each SeekCandidate has the shape produced by `buildApiCandidatePayload()`
 * in scraper.js:
 *   {
 *     name, email, phone, appliedRole, mostRecentRole, seekStatus,
 *     appliedAt, profileUrl, source, location, domicile,
 *     seekProfileId, expectedSalaryRaw, salaryExpectation,
 *     careerHistory: [{ title, company, dates, startDate, endDate, description }],
 *     education: [{ degree, institution, status, yearCompleted, description }],
 *     licencesAndCertifications: [{ name, organization, issuingOrganisation, dates, description }],
 *     applicationQuestions: [{ question, answer }],
 *     skills: string[],
 *     resumeUrl: string | null,
 *   }
 *
 * Deduplication: `createCandidateFromUpload()` upserts the User by email and
 * the CandidateProfile by userId, so re-importing the same candidate is safe
 * (idempotent). The Application (vacancy+candidate) is also unique.
 *
 * Response:
 *   { success: true, results: { imported, skipped, errors, details: string[] } }
 */
const SEEK_API_KEY = process.env.SEEK_API_KEY || "nuanu-seek-secret-2026";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "SEEK import endpoint is live",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== SEEK_API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized: invalid or missing x-api-key header" },
      { status: 401 },
    );
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const candidates = (body as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json(
      { error: "No candidates provided" },
      { status: 400 },
    );
  }

  // ── Import each candidate ─────────────────────────────────────────────
  const details: string[] = [];
  let imported = 0;
  // `skipped` is always 0 here — re-imports are upserts (idempotent), so the
  // same candidate is updated in place rather than skipped. Kept in the
  // response for backward-compat with the scraper's expected payload shape.
  const skipped = 0;
  let errors = 0;

  // Resolve the general vacancy once for the whole batch (fallback when no
  // matching vacancy is found for a candidate's appliedRole).
  let generalVacancyId: string;
  try {
    generalVacancyId = await findOrCreateGeneralVacancy();
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "No vacancy found and none could be auto-created",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  // Cache for vacancy lookups by title (case-insensitive) to avoid repeated DB
  // queries when multiple candidates share the same appliedRole.
  const vacancyCache = new Map<string, string | null>();

  for (const raw of candidates) {
    const c = raw as Record<string, unknown>;
    const name = String(c.name ?? "Unknown");
    try {
      // Skip if missing both email and phone — no stable identity.
      const email = c.email ? String(c.email) : null;
      const phone = c.phone ? String(c.phone) : null;
      if (!email && !phone) {
        errors += 1;
        details.push(`ERROR: ${name} — missing both email and phone`);
        continue;
      }

      // Map the SEEK scraper payload to ParsedCandidate shape expected by
      // createCandidateFromUpload().
      // Helper: coerce an unknown value to string | null.
      const toStr = (v: unknown): string | null =>
        v == null ? null : typeof v === "string" ? v : String(v);

      // ── Parse application questions for salary, experience, and notice period ──
      // SEEK application_questions are in Indonesian (e.g. "Gaji bulanan yang
      // diinginkan" → "Rp 8 Jt", "Pengalaman sebagai Admin Hukum" → "2 tahun").
      // We extract these into the numeric fields that the UI reads.
      const seekAppQuestions: ApplicationQuestionLike[] = Array.isArray(
        c.applicationQuestions,
      )
        ? (c.applicationQuestions as Array<Record<string, unknown>>).map(
            (e) => ({
              question: toStr(e.question ?? e.label ?? e.fieldName),
              answer: toStr(e.answer ?? e.value ?? e.response),
            }),
          )
        : [];

      const extracted = extractAllFromQuestions(seekAppQuestions);

      // Parse the raw salaryExpectation string (e.g. "IDR 8.000.000 / month")
      // into a numeric value. Prefer the application_questions answer if both
      // are available, as it's usually more specific.
      const salaryFromExpectation = parseSalaryToNumber(
        c.salaryExpectation ? String(c.salaryExpectation) : null,
      );
      const numericExpectedSalary =
        extracted.salary ?? salaryFromExpectation ?? null;

      const parsed: ParsedCandidate = {
        name,
        email: email || `seek-${c.seekProfileId || Date.now()}@no-email.local`,
        phone: phone ?? null,
        currentTitle: c.mostRecentRole ? String(c.mostRecentRole) : null,
        currentCompany: null,
        location: c.location ? String(c.location) : null,
        // Experience years: parsed from application_questions (e.g. "2 tahun")
        experienceYears: extracted.experienceYears,
        education: null,
        skills: Array.isArray(c.skills) ? (c.skills as string[]) : [],
        summary: null,
        linkedinUrl: null,
        // Career history → experience (ATS parser reads title/company/startDate/endDate)
        experience: Array.isArray(c.careerHistory)
          ? (c.careerHistory as Array<Record<string, unknown>>).map((e) => ({
              title: toStr(e.title ?? e.roleTitle ?? e.role),
              company: toStr(e.company ?? e.organisation ?? e.employer),
              startDate: toStr(e.startDate),
              endDate: toStr(e.endDate),
              description: toStr(e.description),
            }))
          : [],
        // Education → educationEntries (ATS parser reads degree/institution/yearCompleted)
        educationEntries: Array.isArray(c.education)
          ? (c.education as Array<Record<string, unknown>>).map((e) => ({
              degree: toStr(e.degree ?? e.qualification ?? e.course),
              institution: toStr(e.institution ?? e.organisation ?? e.school),
              year: toStr(e.yearCompleted),
            }))
          : [],
        // Licences → licencesCertifications (ATS parser reads name/issuingBody)
        licencesCertifications: Array.isArray(c.licencesAndCertifications)
          ? (c.licencesAndCertifications as Array<Record<string, unknown>>).map((e) => ({
              name: toStr(e.name ?? e.title ?? e.licenceName),
              issuingBody: toStr(
                e.issuingOrganisation ??
                  e.issuingBody ??
                  e.organisation ??
                  e.organization ??
                  e.issuer,
              ),
              startDate: toStr(e.startDate),
              endDate: toStr(e.endDate),
              expiryDate: toStr(e.expiryDate),
            }))
          : [],
        // Application questions (ATS parser reads question/answer)
        applicationQuestions: seekAppQuestions,
        // Store the raw string in expectedSalary (ParsedCandidate type) —
        // createCandidateFromUpload() will store it in salaryExpectation column.
        expectedSalary: c.salaryExpectation ? String(c.salaryExpectation) : null,
        noticePeriod: extracted.noticePeriod,
        languages: [],
        // Preserve the real application timestamp captured by the scraper
        // (absolute ISO derived from SEEK's relative "X hours ago" text).
        // Without this, createCandidateFromUpload() falls back to now().
        appliedAt: c.appliedAt ? String(c.appliedAt) : undefined,
      };

      const resumeUrl = c.resumeUrl ? String(c.resumeUrl) : "";

      // ── Vacancy matching: try to find a vacancy whose title matches the
      // SEEK appliedRole (case-insensitive). This links the candidate to the
      // correct vacancy (with proper department) instead of always falling
      // back to "General Application".
      const appliedRole = c.appliedRole ? String(c.appliedRole) : null;
      let vacancyId = generalVacancyId;
      if (appliedRole) {
        const cacheKey = appliedRole.toLowerCase().trim();
        if (!vacancyCache.has(cacheKey)) {
          const matched = await prisma.vacancy.findFirst({
            where: {
              title: { equals: appliedRole, mode: "insensitive" },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          vacancyCache.set(cacheKey, matched?.id ?? null);
        }
        const matchedId = vacancyCache.get(cacheKey);
        if (matchedId) {
          vacancyId = matchedId;
        }
      }

      // ── Source: use the source from the scraper payload, default to "SEEK".
      // Warn if source is missing so we can catch scraper bugs early.
      const source = c.source ? String(c.source) : "SEEK";
      if (!c.source) {
        console.warn(
          `[import-seek] Candidate "${name}" missing source field — defaulting to "SEEK"`,
        );
      }

      const result = await createCandidateFromUpload(
        parsed,
        vacancyId,
        resumeUrl,
        "", // resumeText — SEEK scraper doesn't extract raw text
        appliedRole,
        source,
      );

      // ── Write SEEK-specific fields that createCandidateFromUpload() doesn't set ──
      // seekProfileId, emailSeek, locationSeek, domicile are stored directly on
      // CandidateProfile for dedup and SEEK-source attribution.
      // We also write the numeric expectedSalary and experienceYears fields
      // parsed from application_questions / salaryExpectation, since
      // createCandidateFromUpload() only stores the raw string in
      // salaryExpectation (not the numeric expectedSalary column).
      const seekUser = await prisma.user.findUnique({
        where: { email: result.candidateEmail },
        select: { id: true },
      });
      if (seekUser) {
        await prisma.candidateProfile
          .update({
            where: { userId: seekUser.id },
            data: {
              seekProfileId: c.seekProfileId
                ? String(c.seekProfileId)
                : undefined,
              emailSeek: result.candidateEmail,
              locationSeek: c.location ? String(c.location) : undefined,
              domicile: c.domicile ? String(c.domicile) : undefined,
              // Numeric salary parsed from application_questions or
              // salaryExpectation string (e.g. "IDR 8.000.000 / month" → 8000000).
              expectedSalary: numericExpectedSalary ?? undefined,
              // Experience years parsed from application_questions
              // (e.g. "2 tahun" → 2).
              experienceYears: extracted.experienceYears ?? undefined,
              // Notice period parsed from application_questions
              // (e.g. "1 bulan" → "1 bulan").
              noticePeriod: extracted.noticePeriod ?? undefined,
            },
          })
          .catch(() => {});
      }

      imported += 1;
      details.push(
        `IMPORTED: ${result.candidateName} — ${result.candidateEmail} (app: ${result.applicationId})`,
      );
    } catch (err) {
      errors += 1;
      details.push(
        `ERROR: ${name} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return NextResponse.json({
    success: true,
    message: `Import complete: ${imported} imported, ${skipped} skipped, ${errors} errors`,
    results: { imported, skipped, errors, details },
  });
}
