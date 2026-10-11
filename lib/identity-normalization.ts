export function normalizeEmail(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function normalizePhone(value?: string | null): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\D+/g, "");
  if (!digits) return null;

  const normalized = digits.startsWith("62")
    ? digits.replace(/^62/, "0")
    : digits;

  return normalized.startsWith("0") ? normalized : `0${normalized}`;
}

export function findIdentityMatch(email?: string | null, phone?: string | null) {
  return {
    normalizedEmail: normalizeEmail(email),
    normalizedPhone: normalizePhone(phone),
  };
}
