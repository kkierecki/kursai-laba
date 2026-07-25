"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ErrorResult = { error: string };
type Weather = ErrorResult | { city: string; temperature: number; humidity: number; windSpeed: number; description: string };
type Rate = ErrorResult | { currency: string; rate: number; date: string; source: string };
type Holiday = { date: string; localName: string; name: string };

const quickActions = [
  { href: "/travel", label: "🌍 Zaplanuj podróż" },
  { href: "/react", label: "🔄 Agent ReAct" },
  { href: "/chat", label: "💬 Chat z agentem" },
  { href: "/think", label: "🧠 Tryb myślenia" },
  { href: "/generate", label: "🎨 Generator grafik" },
  { href: "/fewshot", label: "📚 Słownik AI" },
];

function timeLabel(date: Date | null) {
  return date?.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) ?? "—";
}

function Skeleton() {
  return <div className="dashboard-skeleton" aria-label="Ładowanie danych"><span /><span /><span /></div>;
}

export default function DashboardPage() {
  const [currentDateTime, setCurrentDateTime] = useState<{ dateTime: string; dayOfWeek: string; timestamp: string } | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [currencies, setCurrencies] = useState<{ eur: Rate; usd: Rate } | null>(null);
  const [holidays, setHolidays] = useState<Holiday[] | ErrorResult | null>(null);
  const [weatherUpdated, setWeatherUpdated] = useState<Date | null>(null);
  const [currenciesUpdated, setCurrenciesUpdated] = useState<Date | null>(null);
  const [holidaysUpdated, setHolidaysUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const now = useMemo(() => new Date(), [weatherUpdated, currenciesUpdated, holidaysUpdated]);

  const loadWeather = useCallback(async () => {
    const response = await fetch("/api/dashboard?section=weather", { cache: "no-store" });
    if (!response.ok) throw new Error(`Pogoda: HTTP ${response.status}`);
    const data = (await response.json()) as {
      currentDateTime: { dateTime: string; dayOfWeek: string; timestamp: string };
      weather: Weather;
    };
    setWeather(data.weather);
    setCurrentDateTime(data.currentDateTime);
    setWeatherUpdated(new Date());
  }, []);

  const loadCurrencies = useCallback(async () => {
    const response = await fetch("/api/dashboard?section=currencies", { cache: "no-store" });
    if (!response.ok) throw new Error(`Waluty: HTTP ${response.status}`);
    const data = (await response.json()) as { currencies: { eur: Rate; usd: Rate } };
    setCurrencies(data.currencies);
    setCurrenciesUpdated(new Date());
  }, []);

  const loadHolidays = useCallback(async () => {
    const response = await fetch("/api/dashboard?section=holidays", { cache: "no-store" });
    if (!response.ok) throw new Error(`Święta: HTTP ${response.status}`);
    const data = (await response.json()) as { holidays: Holiday[] | ErrorResult };
    setHolidays(data.holidays);
    setHolidaysUpdated(new Date());
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadWeather(), loadCurrencies(), loadHolidays()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadCurrencies, loadHolidays, loadWeather]);

  useEffect(() => {
    void refreshAll();
    const weatherInterval = window.setInterval(() => void loadWeather(), 15 * 60 * 1000);
    const currencyInterval = window.setInterval(() => void loadCurrencies(), 60 * 60 * 1000);
    return () => {
      window.clearInterval(weatherInterval);
      window.clearInterval(currencyInterval);
    };
  }, [loadCurrencies, loadWeather, refreshAll]);

  const upcoming = Array.isArray(holidays)
    ? holidays.filter((holiday) => new Date(`${holiday.date}T23:59:59`) >= now).slice(0, 4)
    : [];
  const nextHolidayDays = upcoming[0]
    ? Math.ceil((new Date(`${upcoming[0].date}T00:00:00`).getTime() - now.getTime()) / 86_400_000)
    : null;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-hero">
        <div>
          <p>🌅 Dzień dobry!</p>
          <h1>{currentDateTime?.dateTime ?? now.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
        </div>
        <button aria-label="Odśwież wszystkie dane" disabled={refreshing} onClick={() => void refreshAll()} type="button">
          🔄 {refreshing ? "Odświeżam..." : "Odśwież"}
        </button>
      </header>

      <section className="dashboard-grid" aria-label="Dane na żywo">
        <article className="dashboard-card weather-card">
          <div className="card-heading"><h2>🌤️ Pogoda</h2><small>Aktualizacja: {timeLabel(weatherUpdated)}</small></div>
          {!weather ? <Skeleton /> : "error" in weather ? <p className="card-error">{weather.error}</p> : (
            <div className="weather-content">
              <strong>{weather.city}</strong>
              <span className="dashboard-value">{weather.temperature.toFixed(1)}°C</span>
              <p>{weather.description}</p>
              <dl><div><dt>Wiatr</dt><dd>{weather.windSpeed} km/h</dd></div><div><dt>Wilgotność</dt><dd>{weather.humidity}%</dd></div></dl>
            </div>
          )}
        </article>

        <article className="dashboard-card currency-card">
          <div className="card-heading"><h2>💶 Kursy walut</h2><small>Aktualizacja: {timeLabel(currenciesUpdated)}</small></div>
          {!currencies ? <Skeleton /> : (
            <div className="currency-list">
              {([currencies.eur, currencies.usd] as Rate[]).map((rate, index) =>
                "error" in rate ? <p className="card-error" key={index}>{rate.error}</p> : (
                  <div key={rate.currency}><strong>{rate.currency}</strong><span>{rate.rate.toFixed(4)} PLN</span><small>NBP: {rate.date}</small></div>
                ),
              )}
            </div>
          )}
        </article>

        <article className="dashboard-card holiday-card">
          <div className="card-heading"><h2>📅 Nadchodzące święta</h2><small>Aktualizacja: {timeLabel(holidaysUpdated)}</small></div>
          {!holidays ? <Skeleton /> : !Array.isArray(holidays) ? <p className="card-error">{holidays.error}</p> : (
            <div className="holiday-list">
              {upcoming.map((holiday) => (
                <div key={holiday.date}><time>{new Date(`${holiday.date}T00:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}</time><span>{holiday.localName}</span></div>
              ))}
              {upcoming.length === 0 && <p>Brak kolejnych świąt w tym roku.</p>}
              {nextHolidayDays !== null && <strong>Następne za: {Math.max(0, nextHolidayDays)} dni</strong>}
            </div>
          )}
        </article>

        <article className="dashboard-card actions-card">
          <div className="card-heading"><h2>🤖 Szybkie akcje</h2></div>
          <div className="quick-actions">
            {quickActions.map((action) => <Link href={action.href} key={action.href}>{action.label}</Link>)}
          </div>
        </article>
      </section>
    </main>
  );
}
