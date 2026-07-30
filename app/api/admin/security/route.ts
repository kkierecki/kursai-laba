import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";

export const dynamic = "force-dynamic";

const DAILY_TOKEN_LIMIT = 10_000;
const MAX_USAGE_ROWS = 10_000;
const MAX_BLOCKED_MESSAGES = 100;
const MAX_RECENT_MESSAGES = 2_000;

type UsageRow = {
  user_id: string;
  created_at: string;
  tokens_input: number;
  tokens_output: number;
};

type MessageLogRow = {
  user_id: string;
  created_at: string;
  message_length: number;
  blocked: boolean;
  block_reason: string | null;
};

function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function startOfWarsawDay(daysAgo = 0) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZoneName: "longOffset",
  });
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  const parts = formatter.formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const offset = value("timeZoneName").replace("GMT", "") || "+01:00";
  return new Date(`${value("year")}-${value("month")}-${value("day")}T00:00:00${offset}`);
}

function tokenCount(row: UsageRow) {
  return row.tokens_input + row.tokens_output;
}

async function emailForUser(userId: string, cache: Map<string, string>, admin: ReturnType<typeof createSupabaseAdminClient>) {
  const cached = cache.get(userId);
  if (cached) return cached;
  const { data } = await admin.auth.admin.getUserById(userId);
  const email = data.user?.email ?? "Nieznany użytkownik";
  cache.set(userId, email);
  return email;
}

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });

  const adminEmails = getAdminEmails();
  if (adminEmails.size === 0) {
    return NextResponse.json({ error: "Panel nie jest skonfigurowany. Ustaw ADMIN_EMAILS po stronie serwera." }, { status: 503 });
  }
  if (!user.email || !adminEmails.has(user.email.toLowerCase())) {
    return NextResponse.json({ error: "Brak uprawnień administratora." }, { status: 403 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const now = new Date();
    const todayStart = startOfWarsawDay();
    const weekStart = startOfWarsawDay(6);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

    const [usageResult, blockedResult, recentMessagesResult] = await Promise.all([
      admin.from("api_usage").select("user_id,created_at,tokens_input,tokens_output").gte("created_at", weekStart.toISOString()).order("created_at", { ascending: false }).limit(MAX_USAGE_ROWS),
      admin.from("message_logs").select("user_id,created_at,message_length,blocked,block_reason").eq("blocked", true).order("created_at", { ascending: false }).limit(MAX_BLOCKED_MESSAGES),
      admin.from("message_logs").select("user_id,created_at,message_length,blocked,block_reason").gte("created_at", tenMinutesAgo).order("created_at", { ascending: false }).limit(MAX_RECENT_MESSAGES),
    ]);

    if (usageResult.error || blockedResult.error || recentMessagesResult.error) throw usageResult.error ?? blockedResult.error ?? recentMessagesResult.error;

    const usage = (usageResult.data ?? []) as UsageRow[];
    const blocked = (blockedResult.data ?? []) as MessageLogRow[];
    const recentMessages = (recentMessagesResult.data ?? []) as MessageLogRow[];
    const usageByUser = new Map<string, { today: number; week: number }>();
    for (const row of usage) {
      const entry = usageByUser.get(row.user_id) ?? { today: 0, week: 0 };
      const tokens = tokenCount(row);
      entry.week += tokens;
      if (new Date(row.created_at) >= todayStart) entry.today += tokens;
      usageByUser.set(row.user_id, entry);
    }

    const emailCache = new Map<string, string>();
    const topUsers = await Promise.all(
      [...usageByUser.entries()]
        .sort(([, left], [, right]) => right.week - left.week)
        .slice(0, 5)
        .map(async ([userId, totals]) => ({
          userId,
          email: await emailForUser(userId, emailCache, admin),
          todayTokens: totals.today,
          weekTokens: totals.week,
          limitPercent: Math.min(100, Math.round((totals.today / DAILY_TOKEN_LIMIT) * 100)),
        })),
    );

    const blockedMessages = await Promise.all(blocked.map(async (row) => ({
      userId: row.user_id,
      email: await emailForUser(row.user_id, emailCache, admin),
      message: `Wiadomość o długości ${row.message_length} znaków`,
      reason: row.block_reason ?? "filtr bezpieczeństwa",
      createdAt: row.created_at,
    })));

    const alertCandidates = new Map<string, number>();
    for (const row of recentMessages) alertCandidates.set(row.user_id, (alertCandidates.get(row.user_id) ?? 0) + 1);
    const rateAlerts = await Promise.all([...alertCandidates.entries()]
      .filter(([, count]) => count > 20)
      .map(async ([userId, count]) => ({ type: "high_message_rate" as const, email: await emailForUser(userId, emailCache, admin), count })));
    const budgetAlerts = topUsers.filter((row) => row.limitPercent >= 80).map((row) => ({ type: "budget_limit" as const, email: row.email, percent: row.limitPercent }));
    const blockedAlerts = blockedMessages.slice(0, 10).map((row) => ({ type: "blocked_message" as const, email: row.email, reason: row.reason, createdAt: row.createdAt }));

    const todayTokens = [...usageByUser.values()].reduce((sum, value) => sum + value.today, 0);
    const weekTokens = [...usageByUser.values()].reduce((sum, value) => sum + value.week, 0);
    return NextResponse.json({
      generatedAt: now.toISOString(),
      blockedMessages,
      topUsers,
      alerts: [...budgetAlerts, ...rateAlerts, ...blockedAlerts],
      stats: {
        todayTokens,
        weekTokens,
        blockedMessages: blocked.length,
        averageUsagePerUser: usageByUser.size ? Math.round(weekTokens / usageByUser.size) : 0,
      },
    });
  } catch (error) {
    console.error("security_dashboard_load_failed", error);
    return NextResponse.json({ error: "Nie udało się pobrać danych panelu bezpieczeństwa." }, { status: 500 });
  }
}
