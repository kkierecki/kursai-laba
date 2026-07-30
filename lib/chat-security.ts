const MAX_MESSAGE_LENGTH = 2000;

const blockedInputPatterns = [
  /ignore\s+(all\s+)?previous/i,
  /ignore\s+instructions/i,
  /system\s+prompt/i,
  /reveal\b/i,
  /show\s+me\s+your/i,
  /translate\s+your\s+prompt/i,
  /zignoruj\s+(wszystkie\s+)?poprzednie/i,
  /zignoruj\s+instrukcje/i,
  /pokaż\s+(mi\s+)?(?:swój|swoje)\s+(?:instrukcje|zasady|prompt)/i,
];

const blockedOutputPatterns = [
  /system\s+prompt/i,
  /(?:api[_\s-]?key|supabase[_\s-]?url|service[_\s-]?role|next[_\s-]?public[_\s-]?supabase)/i,
  /\b(?:user_profiles|message_logs|api_usage|conversations|athlete_profiles)\b/i,
  /AIza[\w-]{20,}/,
  /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
];

export const SECURITY_BLOCKED_MESSAGE =
  "Ta wiadomość została zablokowana z powodów bezpieczeństwa.";
export const SECURITY_OUTPUT_MESSAGE =
  "Przepraszam, nie mogę udostępnić tych informacji.";

export type InputValidationResult =
  | { allowed: true; text: string }
  | { allowed: false; text: string; reason: "message_too_long" | "suspicious_instruction" };

export function normalizeSecurityText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateChatInput(text: string): InputValidationResult {
  const normalized = normalizeSecurityText(text);

  if (normalized.length > MAX_MESSAGE_LENGTH) {
    return { allowed: false, text: normalized, reason: "message_too_long" };
  }

  if (blockedInputPatterns.some((pattern) => pattern.test(normalized))) {
    return { allowed: false, text: normalized, reason: "suspicious_instruction" };
  }

  return { allowed: true, text: normalized };
}

export function containsSensitiveOutput(text: string) {
  const normalized = normalizeSecurityText(text);
  return blockedOutputPatterns.some((pattern) => pattern.test(normalized));
}
