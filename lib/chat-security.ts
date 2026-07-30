const MAX_MESSAGE_LENGTH = 2000;

const blockedInputPatterns = [
  /ignore\s+(all\s+)?previous/i,
  /ignore\s+instructions/i,
  /system\s+prompt/i,
  /reveal\b/i,
  /show\s+me\s+your/i,
  /translate\s+your\s+prompt/i,
  /(?:repeat|list|display|reveal|show|quote|summari[sz]e|paraphrase|rewrite|translate).{0,100}\b(?:your|own)\b.{0,100}\b(?:instruction|rule|prompt|guideline|policy|system)/i,
  /\b(?:everything\s+you\s+know|full\s+(?:prompt|instruction)|hidden\s+(?:prompt|instruction|rule))/i,
  /(?:powt[oó]rz|wypisz|wy[śs]wietl|ujawnij|pokaż|opisz|przytocz|zacytuj|streść|sparafrazuj|przeformułuj|przetłumacz).{0,120}\b(?:tw[oó]j|twoje|twoją|twoich|sw[oó]j|swoje|swoją|swoich)\w*\b.{0,120}\b(?:instrukcj|zasad|prompt|poleceń|polecen|wytyczn|reguł|system)/i,
  /\b(?:wszystko\s+co\s+wiesz|pełn[ya]\s+(?:prompt|instrukcj)|ukryt[ey]\s+(?:prompt|instrukcj|zasad))/i,
  /zignoruj\s+(wszystkie\s+)?poprzednie/i,
  /zignoruj\s+instrukcje/i,
  /pokaż\s+(mi\s+)?(?:swój|swoje)\s+(?:instrukcje|zasady|prompt)/i,
];

const blockedOutputPatterns = [
  /system\s+prompt/i,
  /(?:układ|struktura)\s+(?:każdej|odpowiedzi)[\s\S]{0,700}(?:kontekst|analiza)[\s\S]{0,700}(?:następny\s+krok|kolejny\s+ruch)/i,
  /nie\s+(?:rozpoznaję|diagnozuję)[\s\S]{0,250}\b(?:kontuzj|chor[oó]b)[\s\S]{0,500}\b(?:lekarz|fizjoterapeut|rehabilitant)/i,
  /(?:przed|zanim)\s+zaproponuj(?:ę|e)[\s\S]{0,500}\b(?:aktualn[ąa]\s+dat|ostatni\s+trening)[\s\S]{0,500}\bregeneracj/i,
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
  | { allowed: false; text: string; reason: "message_too_long" | "suspicious_instruction" | "unsafe_active_content" };

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

  if (containsUnsafeActiveContent(normalized) || containsSuspiciousSqlInjection(normalized)) {
    return { allowed: false, text: normalized, reason: "unsafe_active_content" };
  }

  return { allowed: true, text: normalized };
}

export function containsSensitiveOutput(text: string) {
  const normalized = normalizeSecurityText(text);
  return containsUnsafeActiveContent(normalized) || blockedOutputPatterns.some((pattern) => pattern.test(normalized));
}
import {
  containsSuspiciousSqlInjection,
  containsUnsafeActiveContent,
} from "./content-security";
