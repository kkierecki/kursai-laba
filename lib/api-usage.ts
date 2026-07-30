import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRequestSupabaseClient, getRequestUser } from "./request-user";

const DEFAULT_DAILY_TOKEN_LIMIT = 10_000;

export type UsageDatabase = SupabaseClient;

function dailyTokenLimit() {
  const value = Number(process.env.DAILY_TOKEN_LIMIT ?? DEFAULT_DAILY_TOKEN_LIMIT);
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_DAILY_TOKEN_LIMIT;
}

function warsawDayStart() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "longOffset",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  const offset = part("timeZoneName").replace("GMT", "") || "+00:00";
  return `${part("year")}-${part("month")}-${part("day")}T00:00:00${offset}`;
}

export async function enforceDailyTokenLimit(database: UsageDatabase, userId: string) {
  const { data, error } = await database
    .from("api_usage")
    .select("tokens_input,tokens_output")
    .eq("user_id", userId)
    .gte("created_at", warsawDayStart());
  if (error) throw new Error(`Nie udało się sprawdzić budżetu API: ${error.message}`);

  const used = (data ?? []).reduce(
    (sum, row) => sum + Math.max(0, row.tokens_input ?? 0) + Math.max(0, row.tokens_output ?? 0),
    0,
  );
  return used < dailyTokenLimit();
}

export async function getLlmRequestContext(request: Request): Promise<
  | { user: User; database: UsageDatabase }
  | { error: Response }
> {
  const user = await getRequestUser(request);
  const database = getRequestSupabaseClient(request);
  if (!user || !database) {
    return { error: Response.json({ error: "Wymagane logowanie." }, { status: 401 }) };
  }

  if (!(await enforceDailyTokenLimit(database, user.id))) {
    return {
      error: Response.json(
        { error: `Dzienny limit tokenów (${dailyTokenLimit().toLocaleString("pl-PL")}) został wyczerpany. Wróć jutro!` },
        { status: 429 },
      ),
    };
  }

  return { user, database };
}

function tokenCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export async function recordApiUsage(
  database: UsageDatabase,
  userId: string,
  usage: unknown,
  model: string,
  endpoint: string,
) {
  const raw = usage as Record<string, unknown> | undefined;
  const tokensInput = tokenCount(raw?.inputTokens ?? raw?.promptTokens);
  const tokensOutput = tokenCount(raw?.outputTokens ?? raw?.completionTokens);
  const { error } = await database.from("api_usage").insert({
    user_id: userId,
    tokens_input: tokensInput,
    tokens_output: tokensOutput,
    model,
    endpoint,
  });
  if (error) throw new Error(`Nie udało się zapisać zużycia API: ${error.message}`);
}
