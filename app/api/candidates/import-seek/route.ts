import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  createCandidateFromUpload,
  findOrCreateGeneralVacancy,
  type ParsedCandidate,
} from "@/lib/data-access";
import { prisma } from "@/lib/prisma";
import {
  findSeekVacancyAlias,
  isSeekAliasTargetValid,
} from "@/lib/seek-vacancy-matcher";
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
 * in scraper.js. Stable vacancy/listing references are used when available;
 * an unmapped listing is imported into General Application for manual assignment:
 *   {
 *     name, email, phone, vacancyId, vacancyCode, seekJobId, seekJobUrl,
 *     appliedRole, mostRecentRole, seekStatus,
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
 *   { success, message, results: { scraped, created, linked, unmatched, failedToCreate, imported, skipped, errors, details } }
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
  let linked = 0;
  let unmatched = 0;
  let errors = 0;
  const affectedVacancyIds = new Set<string>();

  // Application.vacancyId is currently non-nullable. General Application is
  // therefore the explicit holding queue for applicants whose SEEK listing
  // cannot be mapped confidently. Candidate creation must never depend on a
  // successful job match.
  let generalVacancyId: string;
  try {
    generalVacancyId = await findOrCreateGeneralVacancy();
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to resolve the unmatched-candidate holding vacancy",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }

  // Cache stable vacancy references to avoid repeated DB queries when a batch
  // contains many candidates for the same vacancy.
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
        // Secondary sort tie-breaker: original SEEK list row position.
        listPosition:
          typeof c.listPosition === "number"
            ? c.listPosition
            : typeof c.appliedAtSort === "number"
              ? c.appliedAtSort
              : null,
      };

      const resumeUrl = c.resumeUrl ? String(c.resumeUrl) : "";

      // Stable identifiers always take precedence. If an older scraper payload
      // has none, a narrowly reviewed role alias may be used after validating
      // the target vacancy's current title, department, and open status.
      // Generic substring/fuzzy title matching is intentionally prohibited.
      const appliedRole = c.appliedRole ? String(c.appliedRole) : null;
      const suppliedVacancyId = c.vacancyId ? String(c.vacancyId).trim() : "";
      const suppliedVacancyCode = c.vacancyCode ? String(c.vacancyCode).trim() : "";
      const suppliedExternalId = c.seekJobId ?? c.externalJobId ?? c.listingId;
      const suppliedExternalUrl = c.seekJobUrl ?? c.externalJobUrl ?? c.listingUrl;
      const externalId = suppliedExternalId ? String(suppliedExternalId).trim() : "";
      const externalUrl = suppliedExternalUrl ? String(suppliedExternalUrl).trim() : "";
      const cacheKey = suppliedVacancyId
        ? `id:${suppliedVacancyId}`
        : suppliedVacancyCode
          ? `code:${suppliedVacancyCode}`
          : externalId
            ? `seek-id:${externalId}`
            : externalUrl
              ? `seek-url:${externalUrl}`
              : "";

      if (cacheKey && !vacancyCache.has(cacheKey)) {
        const matched = suppliedVacancyId || suppliedVacancyCode
          ? await prisma.vacancy.findFirst({
              where: suppliedVacancyId
                ? { id: suppliedVacancyId, deletedAt: null }
                : { code: suppliedVacancyCode, deletedAt: null },
              select: { id: true },
            })
          : await prisma.jobPosting.findFirst({
              where: {
                channel: { in: ["seek", "jobstreet"], mode: "insensitive" },
                ...(externalId ? { externalId } : { externalUrl }),
                vacancy: { deletedAt: null },
              },
              select: { vacancyId: true },
            });
        vacancyCache.set(
          cacheKey,
          matched ? ("vacancyId" in matched ? matched.vacancyId : matched.id) : null,
        );
      }

      let matchedVacancyId = cacheKey ? vacancyCache.get(cacheKey) : null;
      let matchedBy: "stable-reference" | "reviewed-role-alias" | null =
        matchedVacancyId ? "stable-reference" : null;

      if (!matchedVacancyId && !cacheKey) {
        const alias = findSeekVacancyAlias(appliedRole);
        if (alias) {
          const aliasCacheKey = `alias:${alias.vacancyId}`;
          if (!vacancyCache.has(aliasCacheKey)) {
            const aliasVacancy = await prisma.vacancy.findUnique({
              where: { id: alias.vacancyId },
              select: {
                id: true,
                title: true,
                status: true,
                deletedAt: true,
                department: { select: { name: true } },
              },
            });
            vacancyCache.set(
              aliasCacheKey,
              isSeekAliasTargetValid(alias, aliasVacancy)
                ? aliasVacancy.id
                : null,
            );
          }
          matchedVacancyId = vacancyCache.get(aliasCacheKey) ?? null;
          if (matchedVacancyId) matchedBy = "reviewed-role-alias";
        }
      }

      const vacancyId = matchedVacancyId ?? generalVacancyId;
      const isUnmatched = !matchedVacancyId;

      if (isUnmatched) {
        const reason = cacheKey
          ? `no active vacancy mapping exists for ${cacheKey}`
          : "no validated stable reference or reviewed role alias was available";
        console.warn(
          `[import-seek] UNMATCHED_PENDING: ${name} — listing "${appliedRole ?? "unknown"}"; ${reason}; importing into General Application`,
        );
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
      if (isUnmatched) unmatched += 1;
      else linked += 1;
      affectedVacancyIds.add(vacancyId);
      details.push(
        `${isUnmatched ? "IMPORTED_UNMATCHED" : "IMPORTED_LINKED"}: ${result.candidateName} — ${result.candidateEmail} (app: ${result.applicationId}${matchedBy ? `; matchedBy: ${matchedBy}` : ""})`,
      );
    } catch (err) {
      errors += 1;
      details.push(
        `ERROR: ${name} — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (imported > 0) {
    revalidatePath("/candidates");
    revalidatePath("/jobs");
    for (const vacancyId of Array.from(affectedVacancyIds)) {
      revalidatePath(`/jobs/${vacancyId}`);
      revalidatePath(`/jobs/${vacancyId}/candidates`);
    }
  }

  const summary =
    `Scraped ${candidates.length} applicants — ${linked} linked automatically, ` +
    `${unmatched} unmatched, ${errors} failed to create`;
  console.info(`[import-seek] ${summary}`);

  return NextResponse.json({
    success: errors === 0,
    message: summary,
    results: {
      scraped: candidates.length,
      created: imported,
      linked,
      unmatched,
      failedToCreate: errors,
      // Backward-compatible counters consumed by existing scraper clients.
      imported,
      skipped: 0,
      errors,
      details,
    },
  });
}
