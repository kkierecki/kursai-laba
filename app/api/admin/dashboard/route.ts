import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";

export const dynamic = "force-dynamic";
const LIMIT = 10_000;

function day(value: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }).format(value); }
function isAdmin(email?: string) { return Boolean(email && (process.env.ADMIN_EMAILS ?? "").split(",").map((item) => item.trim().toLowerCase()).includes(email.toLowerCase())); }

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: "Wymagane jest zalogowanie." }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "Brak uprawnień administratora." }, { status: 403 });
  try {
    const admin = createSupabaseAdminClient();
    const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    const [usageResult, totalResult, usersResult, recentResult] = await Promise.all([
      admin.from("api_usage").select("created_at,tokens_input,tokens_output,endpoint").gte("created_at", start.toISOString()).order("created_at", { ascending: false }).limit(LIMIT),
      admin.from("conversations").select("id", { count: "exact", head: true }),
      admin.from("conversations").select("user_id").limit(LIMIT),
      admin.from("conversations").select("id,user_id,title,created_at").order("created_at", { ascending: false }).limit(10),
    ]);
    if (usageResult.error || totalResult.error || usersResult.error || recentResult.error) throw usageResult.error ?? totalResult.error ?? usersResult.error ?? recentResult.error;
    const recent = recentResult.data ?? [];
    const messageResult = recent.length ? await admin.from("messages").select("conversation_id").in("conversation_id", recent.map((item) => item.id)) : { data: [], error: null };
    if (messageResult.error) throw messageResult.error;
    const days = Array.from({ length: 7 }, (_, index) => { const value = new Date(); value.setDate(value.getDate() - 6 + index); return day(value); });
    const tokenDays = new Map(days.map((key) => [key, 0])); const endpoints = new Map<string, number>();
    for (const row of usageResult.data ?? []) { const tokens = row.tokens_input + row.tokens_output; const key = day(new Date(row.created_at)); tokenDays.set(key, (tokenDays.get(key) ?? 0) + tokens); endpoints.set(row.endpoint, (endpoints.get(row.endpoint) ?? 0) + tokens); }
    const conversationsByDay = new Map(days.map((key) => [key, 0]));
    for (const row of recent) { const key = day(new Date(row.created_at)); if (conversationsByDay.has(key)) conversationsByDay.set(key, (conversationsByDay.get(key) ?? 0) + 1); }
    const counts = new Map<string, number>(); for (const row of messageResult.data ?? []) counts.set(row.conversation_id, (counts.get(row.conversation_id) ?? 0) + 1);
    const emails = new Map<string, string>();
    async function emailFor(id: string) { if (emails.has(id)) return emails.get(id)!; const { data } = await admin.auth.admin.getUserById(id); const email = data.user?.email ?? "Nieznany użytkownik"; emails.set(id, email); return email; }
    const todayTokens = tokenDays.get(day(new Date())) ?? 0;
    return NextResponse.json({ generatedAt: new Date().toISOString(), stats: { users: new Set((usersResult.data ?? []).map((item) => item.user_id)).size, conversations: totalResult.count ?? 0, tokensToday: todayTokens, costTodayUsd: todayTokens / 1_000_000 * .15 }, tokenDays: days.map((key) => ({ day: key, tokens: tokenDays.get(key) ?? 0 })), conversationDays: days.map((key) => ({ day: key, conversations: conversationsByDay.get(key) ?? 0 })), endpointTokens: [...endpoints].sort((a, b) => b[1] - a[1]).map(([endpoint, tokens]) => ({ endpoint, tokens })), recentConversations: await Promise.all(recent.map(async (row) => ({ id: row.id, email: await emailFor(row.user_id), title: row.title ?? "Nowa rozmowa", createdAt: row.created_at, messageCount: counts.get(row.id) ?? 0 }))) });
  } catch (error) { console.error("admin_dashboard_load_failed", error); return NextResponse.json({ error: "Nie udało się pobrać danych dashboardu." }, { status: 500 }); }
}
