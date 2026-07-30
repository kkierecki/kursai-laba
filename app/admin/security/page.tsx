"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Dashboard = {
  generatedAt: string;
  blockedMessages: Array<{ userId: string; email: string; message: string; reason: string; createdAt: string }>;
  topUsers: Array<{ userId: string; email: string; todayTokens: number; weekTokens: number; limitPercent: number }>;
  alerts: Array<{ type: "budget_limit"; email: string; percent: number } | { type: "high_message_rate"; email: string; count: number } | { type: "blocked_message"; email: string; reason: string; createdAt: string }>;
  stats: { todayTokens: number; weekTokens: number; blockedMessages: number; averageUsagePerUser: number };
};

const number = new Intl.NumberFormat("pl-PL");
const dateTime = new Intl.DateTimeFormat("pl-PL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Warsaw" });

function alertText(alert: Dashboard["alerts"][number]) {
  if (alert.type === "budget_limit") return `${alert.email} wykorzystał(a) ${alert.percent}% dziennego limitu.`;
  if (alert.type === "high_message_rate") return `${alert.email} wysłał(a) ${alert.count} wiadomości w ciągu 10 minut.`;
  return `${alert.email}: wiadomość została zablokowana (${alert.reason}).`;
}

export default function SecurityPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
        const response = await fetch("/api/admin/security", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
        const payload = await response.json() as Dashboard & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Nie udało się pobrać danych.");
        setDashboard(payload);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Nie udało się pobrać danych.");
      }
    }
    void load();
  }, []);

  if (error) return <main className="security-shell"><section className="security-panel"><h1>🛡️ Panel bezpieczeństwa</h1><p className="security-error">{error}</p></section></main>;
  if (!dashboard) return <main className="security-shell"><section className="security-panel"><h1>🛡️ Panel bezpieczeństwa</h1><p>Wczytywanie danych…</p></section></main>;

  return <main className="security-shell"><section className="security-panel">
    <header className="security-header"><div><h1>🛡️ Panel bezpieczeństwa</h1><p>Stan na {dateTime.format(new Date(dashboard.generatedAt))}</p></div></header>
    <section className="security-section"><h2>📈 Statystyki</h2><div className="security-stats"><article><span>Tokeny dziś</span><strong>{number.format(dashboard.stats.todayTokens)}</strong></article><article><span>Tokeny w tym tygodniu</span><strong>{number.format(dashboard.stats.weekTokens)}</strong></article><article><span>Zablokowane wiadomości</span><strong>{number.format(dashboard.stats.blockedMessages)}</strong></article><article><span>Średnie zużycie / użytkownika</span><strong>{number.format(dashboard.stats.averageUsagePerUser)}</strong></article></div></section>
    <section className="security-section"><h2>🔴 Alerty</h2>{dashboard.alerts.length ? <ul className="security-alerts">{dashboard.alerts.map((alert, index) => <li key={`${alert.type}-${index}`}>{alertText(alert)}</li>)}</ul> : <p className="security-empty">Brak aktywnych alertów.</p>}</section>
    <section className="security-section"><h2>📊 Top 5 użytkowników po zużyciu</h2>{dashboard.topUsers.length ? <div className="security-table-wrap"><table><thead><tr><th>Użytkownik</th><th>Tokeny dziś</th><th>Tokeny w tygodniu</th><th>Limit dzienny</th></tr></thead><tbody>{dashboard.topUsers.map((row) => <tr key={row.userId}><td>{row.email}</td><td>{number.format(row.todayTokens)}</td><td>{number.format(row.weekTokens)}</td><td>{row.limitPercent}%</td></tr>)}</tbody></table></div> : <p className="security-empty">Brak użycia API w tym tygodniu.</p>}</section>
    <section className="security-section"><h2>⚠️ Zablokowane wiadomości</h2>{dashboard.blockedMessages.length ? <div className="security-table-wrap"><table><thead><tr><th>Użytkownik</th><th>Wiadomość</th><th>Powód</th><th>Data</th></tr></thead><tbody>{dashboard.blockedMessages.map((row, index) => <tr key={`${row.userId}-${row.createdAt}-${index}`}><td>{row.email}</td><td>{row.message}</td><td>{row.reason}</td><td>{dateTime.format(new Date(row.createdAt))}</td></tr>)}</tbody></table></div> : <p className="security-empty">Nie zarejestrowano zablokowanych wiadomości.</p>}</section>
  </section></main>;
}
