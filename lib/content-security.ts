const activeMarkupPattern = /<\s*\/?\s*[a-z][a-z0-9:-]*(?:\s+[^<>]*)?\/?\s*>/i;
const executableContentPattern = /(?:javascript\s*:|\bon[a-z]+\s*=|@import\s+(?:url|['"]|\()|expression\s*\()/i;
const commonSqlInjectionPattern = /(?:\bunion\s+(?:all\s+)?select\b|\bdrop\s+table\b|\binformation_schema\b|\bpg_catalog\b|;\s*(?:drop|delete|insert|update|alter|create)\b)/i;

export function containsUnsafeActiveContent(value: string) {
  return activeMarkupPattern.test(value) || executableContentPattern.test(value);
}

export function containsSuspiciousSqlInjection(value: string) {
  return commonSqlInjectionPattern.test(value);
}

export function containsUnsafeJsonContent(value: unknown): boolean {
  if (typeof value === "string") return containsUnsafeActiveContent(value);
  if (Array.isArray(value)) return value.some(containsUnsafeJsonContent);
  if (!value || typeof value !== "object") return false;

  return Object.values(value).some(containsUnsafeJsonContent);
}
