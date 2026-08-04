import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRequestSupabaseClient, getRequestUser } from "./request-user";

const DEFAULT_DAILY_TOKEN_LIMIT = 100_000;
const DEFAULT_MONTHLY_TOKEN_LIMIT = 2_000_000;

export type UsageDatabase = SupabaseClient;

function configuredLimit(name: "DAILY_TOKEN_LIMIT" | "MONTHLY_TOKEN_LIMIT", fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function warsawPeriodStart(period: "day" | "month") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    ...(period === "day" ? { day: "2-digit" } : {}),
    timeZoneName: "longOffset",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const offset = part("timeZoneName").replace("GMT", "") || "+00:00";
  const day = period === "day" ? part("day") : "01";
  return `${part("year")}-${part("month")}-${day}T00:00:00${offset}`;
}

export type TokenLimitCheck = {
  allowed: boolean;
  exceeded?: "daily" | "monthly";
  dailyLimit: number;
  monthlyLimit: number;
};

export async function enforceTokenLimits(database: UsageDatabase, userId: string): Promise<TokenLimitCheck> {
  const [{ data: limits, error: limitsError }, { data: usage, error: usageError }] = await Promise.all([
    database.from("user_usage_limits").select("daily_token_limit,monthly_token_limit").eq("user_id", userId).maybeSingle(),
    database.from("api_usage").select("created_at,tokens_input,tokens_output").eq("user_id", userId).gte("created_at", warsawPeriodStart("month")),
  ]);
  if (limitsError && limitsError.code !== "PGRST205") throw new Error(`Nie udało się odczytać limitów API: ${limitsError.message}`);
  if (usageError) throw new Error(`Nie udało się sprawdzić budżetu API: ${usageError.message}`);

  const dailyLimit = (limitsError ? null : limits)?.daily_token_limit ?? configuredLimit("DAILY_TOKEN_LIMIT", DEFAULT_DAILY_TOKEN_LIMIT);
  const monthlyLimit = (limitsError ? null : limits)?.monthly_token_limit ?? configuredLimit("MONTHLY_TOKEN_LIMIT", DEFAULT_MONTHLY_TOKEN_LIMIT);
  const todayStart = new Date(warsawPeriodStart("day"));
  let todayUsed = 0;
  let monthUsed = 0;
  for (const row of usage ?? []) {
    const tokens = Math.max(0, row.tokens_input ?? 0) + Math.max(0, row.tokens_output ?? 0);
    monthUsed += tokens;
    if (new Date(row.created_at) >= todayStart) todayUsed += tokens;
  }

  if (todayUsed >= dailyLimit) return { allowed: false, exceeded: "daily", dailyLimit, monthlyLimit };
  if (monthUsed >= monthlyLimit) return { allowed: false, exceeded: "monthly", dailyLimit, monthlyLimit };
  return { allowed: true, dailyLimit, monthlyLimit };
}

export function tokenLimitMessage(check: TokenLimitCheck) {
  const isMonthly = check.exceeded === "monthly";
  const limit = isMonthly ? check.monthlyLimit : check.dailyLimit;
  return `${isMonthly ? "Miesięczny" : "Dzienny"} limit tokenów (${limit.toLocaleString("pl-PL")}) został wyczerpany.`;
}

export async function enforceDailyTokenLimit(database: UsageDatabase, userId: string) {
  return (await enforceTokenLimits(database, userId)).allowed;
}

export async function getLlmRequestContext(request: Request): Promise<{ user: User; database: UsageDatabase } | { error: Response }> {
  const user = await getRequestUser(request);
  const database = getRequestSupabaseClient(request);
  if (!user || !database) return { error: Response.json({ error: "Wymagane logowanie." }, { status: 401 }) };

  const check = await enforceTokenLimits(database, user.id);
  if (!check.allowed) return { error: Response.json({ error: tokenLimitMessage(check) }, { status: 429 }) };
  return { user, database };
}

function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export async function recordApiUsage(database: UsageDatabase, userId: string, usage: unknown, model: string, endpoint: string) {
  const raw = usage as Record<string, unknown> | undefined;
  const tokensInput = tokenCount(raw?.inputTokens ?? raw?.promptTokens);
  const tokensOutput = tokenCount(raw?.outputTokens ?? raw?.completionTokens);
  const { error } = await database.from("api_usage").insert({ user_id: userId, tokens_input: tokensInput, tokens_output: tokensOutput, model, endpoint });
  if (error) throw new Error(`Nie udało się zapisać zużycia API: ${error.message}`);
}
