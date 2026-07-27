"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Weather = { error: string } | { city: string; temperature: number; humidity: number; windSpeed: number; description: string };
type Profile = { home_location: string | null; hr_max: number | null; vo2max: number | null; typical_cadence_spm: number | null };
type Goal = { title: string; target_date: string | null; target_metric: string | null; target_value: number | null; target_unit: string | null };
type Workout = { performed_on: string; summary: string; distance_m: number | null; average_pace_seconds: number | null; average_hr: number | null };
type Recovery = { logged_on: string; sleep_hours: number | null; fatigue: number | null; soreness: number | null };

function pace(seconds: number | null) {
  if (!seconds) return "brak danych";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);
    const [profileResult, goalResult, workoutResult, recoveryResult, userProfileResult] = await Promise.all([
      supabase.from("athlete_profiles").select("home_location,hr_max,vo2max,typical_cadence_spm").eq("user_id", user.id).maybeSingle(),
      supabase.from("running_goals").select("title,target_date,target_metric,target_value,target_unit").eq("user_id", user.id).eq("status", "active").order("priority").limit(1).maybeSingle(),
      supabase.from("workouts").select("performed_on,summary,distance_m,average_pace_seconds,average_hr").eq("user_id", user.id).order("performed_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("recovery_logs").select("logged_on,sleep_hours,fatigue,soreness").eq("user_id", user.id).order("logged_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("user_profiles").select("name").eq("id", user.id).maybeSingle(),
    ]);
    setProfile(profileResult.data);
    setGoal(goalResult.data);
    setWorkout(workoutResult.data);
    setRecovery(recoveryResult.data);
    setUserName(userProfileResult.data?.name?.trim() || null);
    const city = profileResult.data?.home_location;
    if (city) {
      const response = await fetch(`/api/dashboard?section=weather&city=${encodeURIComponent(city)}`, { cache: "no-store" });
      if (response.ok) setWeather((await response.json() as { weather: Weather }).weather);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <main className="dashboard-shell runner-dashboard">
    <header className="dashboard-hero runner-hero"><div><p>🏃 {userName ? `Cześć, ${userName}!` : "Cześć!"}</p><h1>Twój bieg w jednym miejscu</h1><span>{profile?.home_location ? `📍 ${profile.home_location}` : "Dodaj lokalizację w czacie, aby dopasować pogodę i teren."}</span></div><button disabled={loading} onClick={() => void load()} type="button">↻ Odśwież</button></header>
    <section className="dashboard-grid" aria-label="Podsumowanie biegacza">
      <article className="dashboard-card goal-card"><div className="card-heading"><h2>🎯 Najbliższy cel</h2></div>{goal ? <><strong className="goal-title">{goal.title}</strong>{goal.target_value !== null && <p>{goal.target_metric}: {goal.target_value} {goal.target_unit}</p>}{goal.target_date && <small>Termin: {new Date(`${goal.target_date}T00:00:00`).toLocaleDateString("pl-PL")}</small>}</> : <p>Nie masz aktywnego celu. Opisz go trenerowi w czacie.</p>}</article>
      <article className="dashboard-card metrics-card"><div className="card-heading"><h2>⚡ Metryki</h2></div><dl className="runner-metrics"><div><dt>HRmax</dt><dd>{profile?.hr_max ?? "—"} {profile?.hr_max && "bpm"}</dd></div><div><dt>VO₂max</dt><dd>{profile?.vo2max ?? "—"}</dd></div><div><dt>Kadencja</dt><dd>{profile?.typical_cadence_spm ?? "—"} {profile?.typical_cadence_spm && "spm"}</dd></div></dl></article>
      <article className="dashboard-card workout-card"><div className="card-heading"><h2>👟 Ostatni trening</h2></div>{workout ? <><strong>{workout.summary}</strong><p>{new Date(`${workout.performed_on}T00:00:00`).toLocaleDateString("pl-PL")}</p><dl><div><dt>Dystans</dt><dd>{workout.distance_m ? `${(workout.distance_m / 1000).toFixed(1)} km` : "—"}</dd></div><div><dt>Tempo</dt><dd>{pace(workout.average_pace_seconds)}</dd></div><div><dt>Śr. HR</dt><dd>{workout.average_hr ?? "—"}</dd></div></dl></> : <p>Brak zapisanego treningu.</p>}</article>
      <article className="dashboard-card recovery-card"><div className="card-heading"><h2>🛌 Regeneracja</h2></div>{recovery ? <><strong>{new Date(`${recovery.logged_on}T00:00:00`).toLocaleDateString("pl-PL")}</strong><dl><div><dt>Sen</dt><dd>{recovery.sleep_hours ?? "—"} h</dd></div><div><dt>Zmęczenie</dt><dd>{recovery.fatigue ?? "—"}/10</dd></div><div><dt>Bolesność</dt><dd>{recovery.soreness ?? "—"}/10</dd></div></dl></> : <p>Dodaj dzisiejszy sen i samopoczucie, zanim poprosisz o kolejny trening.</p>}</article>
      <article className="dashboard-card weather-card runner-weather"><div className="card-heading"><h2>🌦️ Warunki do biegu</h2></div>{!profile?.home_location ? <p>Podaj trenerowi miejscowość lub okolicę.</p> : !weather ? <p>Ładuję pogodę…</p> : "error" in weather ? <p className="card-error">{weather.error}</p> : <><strong>{weather.city} · {weather.temperature.toFixed(1)}°C</strong><p>{weather.description}</p><small>Wiatr {weather.windSpeed} km/h · wilgotność {weather.humidity}%</small></>}</article>
      <article className="dashboard-card actions-card"><div className="card-heading"><h2>🚀 Zacznij</h2></div><div className="quick-actions"><Link href="/chat">Dodaj trening</Link><Link href="/vision">Analizuj screenshot</Link><Link href="/chat">Ustaw cel</Link></div></article>
    </section>
  </main>;
}
