import { normalizeEmail, normalizePhone } from "./identity-normalization";

export type BlacklistState = {
  isBlacklisted: boolean;
  blacklistedAt: Date | string | null;
  currentStage: string;
};

export type CandidateIdentity = {
  id: string;
  email: string | null | undefined;
  phone: string | null | undefined;
};

export function isApplicationBlacklisted(application: BlacklistState): boolean {
  return (
    application.isBlacklisted ||
    (application.blacklistedAt !== null &&
      application.blacklistedAt !== undefined) ||
    application.currentStage.toLowerCase() === "blacklisted"
  );
}

export function effectiveApplicationStage(
  currentStage: string,
  personIsBlacklisted: boolean,
): string {
  return personIsBlacklisted ? "Blacklisted" : currentStage;
}

export function candidateIdentityKey(
  candidate: CandidateIdentity,
): string {
  const email = normalizeEmail(candidate.email);
  if (email && !email.endsWith("@no-email.local")) return `email:${email}`;

  const phone = normalizePhone(candidate.phone);
  return phone ? `phone:${phone}` : `user:${candidate.id}`;
}

export function isIdentityBlacklisted(
  candidate: CandidateIdentity,
  blacklistedIdentityKeys: ReadonlySet<string>,
): boolean {
  return blacklistedIdentityKeys.has(candidateIdentityKey(candidate));
}

export function resolveEffectiveStage(
  currentStage: string,
  personApplications: readonly BlacklistState[],
): string {
  const personIsBlacklisted = personApplications.some(
    isApplicationBlacklisted,
  );
  return effectiveApplicationStage(currentStage, personIsBlacklisted);
}

export function matchesEffectiveStage(
  effectiveStage: string,
  requestedStage: string | undefined,
): boolean {
  return (
    !requestedStage ||
    requestedStage === "All" ||
    requestedStage === effectiveStage
  );
}
