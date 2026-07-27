"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Weather = { error: string } | { city: string; temperature: number; humidity: number; windSpeed: number; description: string };
type Profile = {
  home_location: string | null; birth_year: number | null; sex: "female" | "male" | "nonbinary" | "undisclosed" | null;
  height_cm: number | null; weight_kg: number | null; hr_max: number | null; lactate_threshold_hr: number | null;
  lactate_threshold_pace_seconds: number | null; vo2max: number | null; typical_cadence_spm: number | null;
  weekly_availability: string | null; injury_limitations: string | null; notes: string | null;
};
type HeartRateZone = { zone: number; lower_bpm: number; upper_bpm: number };
type Goal = { title: string; target_date: string | null; target_metric: string | null; target_value: number | null; target_unit: string | null };
type Workout = { performed_on: string; summary: string; distance_m: number | null; average_pace_seconds: number | null; average_hr: number | null };
type WorkoutForStats = { performed_on: string; distance_m: number | null; duration_seconds: number | null; average_hr: number | null };
type TrainingStats = { count: number; distanceM: number; durationSeconds: number; monitoredSince: string | null; last30DaysCount: number; last30DaysDistanceM: number; longestDistanceM: number | null; averagePaceSeconds: number | null; averageHr: number | null };
type Recovery = { logged_on: string; sleep_hours: number | null; fatigue: number | null; soreness: number | null };
type StoredPreferences = Record<string, string>;

function pace(seconds: number | null) {
  if (!seconds) return "brak danych";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

function profilePace(seconds: number | null) {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

function duration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function buildTrainingStats(workouts: WorkoutForStats[]): TrainingStats {
  const today = new Date();
  const last30DaysStart = new Date(today);
  last30DaysStart.setDate(today.getDate() - 29);
  const last30DaysStartKey = last30DaysStart.toISOString().slice(0, 10);
  const distanceM = workouts.reduce((total, workout) => total + (workout.distance_m ?? 0), 0);
  const durationSeconds = workouts.reduce((total, workout) => total + (workout.duration_seconds ?? 0), 0);
  const withDistanceAndDuration = workouts.filter((workout) => workout.distance_m && workout.duration_seconds);
  const paceDistanceM = withDistanceAndDuration.reduce((total, workout) => total + (workout.distance_m ?? 0), 0);
  const paceDurationSeconds = withDistanceAndDuration.reduce((total, workout) => total + (workout.duration_seconds ?? 0), 0);
  const heartRates = workouts.map((workout) => workout.average_hr).filter((value): value is number => value !== null);
  const recent = workouts.filter((workout) => workout.performed_on >= last30DaysStartKey);
  return {
    count: workouts.length,
    distanceM,
    durationSeconds,
    monitoredSince: workouts.map((workout) => workout.performed_on).sort()[0] ?? null,
    last30DaysCount: recent.length,
    last30DaysDistanceM: recent.reduce((total, workout) => total + (workout.distance_m ?? 0), 0),
    longestDistanceM: workouts.reduce<number | null>((longest, workout) => Math.max(longest ?? 0, workout.distance_m ?? 0) || null, null),
    averagePaceSeconds: paceDistanceM > 0 ? Math.round(paceDurationSeconds / (paceDistanceM / 1000)) : null,
    averageHr: heartRates.length > 0 ? Math.round(heartRates.reduce((total, value) => total + value, 0) / heartRates.length) : null,
  };
}

function preferenceNumber(preferences: StoredPreferences, ...keys: string[]) {
  const value = keys.map((key) => preferences[key]).find(Boolean);
  if (!value) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [heartRateZones, setHeartRateZones] = useState<HeartRateZone[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);
    const [profileResult, locationResult, heartRateZonesResult, goalResult, workoutResult, allWorkoutsResult, recoveryResult, userProfileResult] = await Promise.all([
      supabase.from("athlete_profiles").select("birth_year,sex,height_cm,weight_kg,hr_max,lactate_threshold_hr,lactate_threshold_pace_seconds,vo2max,typical_cadence_spm,weekly_availability,injury_limitations,notes").eq("user_id", user.id).maybeSingle(),
      // home_location was added in a later migration. Its absence must never
      // make the whole dashboard profile query fail.
      supabase.from("athlete_profiles").select("home_location").eq("user_id", user.id).maybeSingle(),
      supabase.from("athlete_hr_zones").select("zone,lower_bpm,upper_bpm").eq("user_id", user.id).order("zone"),
      supabase.from("running_goals").select("title,target_date,target_metric,target_value,target_unit").eq("user_id", user.id).eq("status", "active").order("priority").limit(1).maybeSingle(),
      supabase.from("workouts").select("performed_on,summary,distance_m,average_pace_seconds,average_hr").eq("user_id", user.id).order("performed_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workouts").select("performed_on,distance_m,duration_seconds,average_hr").eq("user_id", user.id),
      supabase.from("recovery_logs").select("logged_on,sleep_hours,fatigue,soreness").eq("user_id", user.id).order("logged_on", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("user_profiles").select("name,preferences").eq("id", user.id).maybeSingle(),
    ]);
    const preferences = (userProfileResult.data?.preferences ?? {}) as StoredPreferences;
    const savedProfile = profileResult.data;
    setProfile({
      home_location: locationResult.data?.home_location ?? preferences.home_location ?? preferences.location ?? null,
      birth_year: savedProfile?.birth_year ?? preferenceNumber(preferences, "birth_year"),
      sex: savedProfile?.sex ?? null,
      height_cm: savedProfile?.height_cm ?? preferenceNumber(preferences, "height_cm", "height"),
      weight_kg: savedProfile?.weight_kg ?? preferenceNumber(preferences, "weight_kg", "weight"),
      hr_max: savedProfile?.hr_max ?? preferenceNumber(preferences, "hr_max", "hrmax"),
      lactate_threshold_hr: savedProfile?.lactate_threshold_hr ?? preferenceNumber(preferences, "lactate_threshold_hr"),
      lactate_threshold_pace_seconds: savedProfile?.lactate_threshold_pace_seconds ?? preferenceNumber(preferences, "lactate_threshold_pace_seconds"),
      vo2max: savedProfile?.vo2max ?? preferenceNumber(preferences, "vo2max", "vo2_max"),
      typical_cadence_spm: savedProfile?.typical_cadence_spm ?? preferenceNumber(preferences, "cadence_spm", "cadence"),
      weekly_availability: savedProfile?.weekly_availability ?? preferences.weekly_availability ?? null,
      injury_limitations: savedProfile?.injury_limitations ?? preferences.injury_limitations ?? null,
      notes: savedProfile?.notes ?? null,
    });
    setHeartRateZones(heartRateZonesResult.data ?? []);
    setGoal(goalResult.data ?? (preferences.running_goal ? {
      title: preferences.running_goal,
      target_date: preferences.goal_date ?? null,
      target_metric: null,
      target_value: null,
      target_unit: null,
    } : null));
    setWorkout(workoutResult.data);
    setTrainingStats(buildTrainingStats(allWorkoutsResult.data ?? []));
    setRecovery(recoveryResult.data && [recoveryResult.data.sleep_hours, recoveryResult.data.fatigue, recoveryResult.data.soreness].some((value) => value !== null) ? recoveryResult.data : null);
    setUserName(userProfileResult.data?.name?.trim() || null);
    const city = locationResult.data?.home_location ?? preferences.home_location ?? preferences.location;
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
      <article className="dashboard-card metrics-card profile-card"><div className="card-heading"><h2>⚡ Profil biegacza</h2></div>{profile ? <><dl className="runner-metrics"><div><dt>Lokalizacja</dt><dd>{profile.home_location ?? "—"}</dd></div><div><dt>Rok urodzenia</dt><dd>{profile.birth_year ?? "—"}</dd></div><div><dt>Płeć</dt><dd>{{ female: "kobieta", male: "mężczyzna", nonbinary: "niebinarna", undisclosed: "nie podano" }[profile.sex ?? "undisclosed"]}</dd></div><div><dt>Wzrost</dt><dd>{profile.height_cm ?? "—"} {profile.height_cm && "cm"}</dd></div><div><dt>Masa</dt><dd>{profile.weight_kg ?? "—"} {profile.weight_kg && "kg"}</dd></div><div><dt>HRmax</dt><dd>{profile.hr_max ?? "—"} {profile.hr_max && "bpm"}</dd></div><div><dt>Próg mleczanowy</dt><dd>{profile.lactate_threshold_hr ?? "—"} {profile.lactate_threshold_hr && "bpm"}</dd></div><div><dt>Tempo progowe</dt><dd>{profilePace(profile.lactate_threshold_pace_seconds) ?? "—"}</dd></div><div><dt>VO₂max</dt><dd>{profile.vo2max ?? "—"}</dd></div><div><dt>Kadencja</dt><dd>{profile.typical_cadence_spm ?? "—"} {profile.typical_cadence_spm && "spm"}</dd></div></dl>{heartRateZones.length > 0 && <p className="profile-detail"><b>Strefy tętna:</b> {heartRateZones.map((zone) => `Z${zone.zone}: ${zone.lower_bpm}–${zone.upper_bpm} bpm`).join(" · ")}</p>}{profile.weekly_availability && <p className="profile-detail"><b>Dostępność:</b> {profile.weekly_availability}</p>}{profile.injury_limitations && <p className="profile-detail"><b>Ograniczenia zdrowotne:</b> {profile.injury_limitations}</p>}{profile.notes && <p className="profile-detail"><b>Notatki:</b> {profile.notes}</p>}</> : <p>Ładuję profil…</p>}</article>
      <article className="dashboard-card workout-card"><div className="card-heading"><h2>👟 Ostatni trening</h2></div>{workout ? <><strong>{workout.summary}</strong><p>{new Date(`${workout.performed_on}T00:00:00`).toLocaleDateString("pl-PL")}</p><dl><div><dt>Dystans</dt><dd>{workout.distance_m ? `${(workout.distance_m / 1000).toFixed(1)} km` : "—"}</dd></div><div><dt>Tempo</dt><dd>{pace(workout.average_pace_seconds)}</dd></div><div><dt>Śr. HR</dt><dd>{workout.average_hr ?? "—"}</dd></div></dl></> : <p>Brak zapisanego treningu.</p>}</article>
      <article className="dashboard-card training-stats-card"><div className="card-heading"><h2>📊 Historia treningów</h2></div>{trainingStats && trainingStats.count > 0 ? <><dl className="runner-metrics"><div><dt>Treningi łącznie</dt><dd>{trainingStats.count}</dd></div><div><dt>Suma kilometrów</dt><dd>{(trainingStats.distanceM / 1000).toFixed(1)} km</dd></div><div><dt>Suma czasu</dt><dd>{duration(trainingStats.durationSeconds)}</dd></div><div><dt>Monitoring od</dt><dd>{trainingStats.monitoredSince ? new Date(`${trainingStats.monitoredSince}T00:00:00`).toLocaleDateString("pl-PL") : "—"}</dd></div><div><dt>Ostatnie 30 dni</dt><dd>{trainingStats.last30DaysCount} · {(trainingStats.last30DaysDistanceM / 1000).toFixed(1)} km</dd></div><div><dt>Najdłuższy bieg</dt><dd>{trainingStats.longestDistanceM ? `${(trainingStats.longestDistanceM / 1000).toFixed(1)} km` : "—"}</dd></div><div><dt>Średnie tempo</dt><dd>{profilePace(trainingStats.averagePaceSeconds) ?? "—"}</dd></div><div><dt>Średnie HR</dt><dd>{trainingStats.averageHr ?? "—"} {trainingStats.averageHr && "bpm"}</dd></div></dl></> : <p>Dodaj pierwszy trening, aby rozpocząć monitorowanie historii.</p>}</article>
      <article className="dashboard-card recovery-card"><div className="card-heading"><h2>🛌 Regeneracja</h2></div>{recovery ? <><strong>{new Date(`${recovery.logged_on}T00:00:00`).toLocaleDateString("pl-PL")}</strong><dl><div><dt>Sen</dt><dd>{recovery.sleep_hours ?? "—"} h</dd></div><div><dt>Zmęczenie</dt><dd>{recovery.fatigue ?? "—"}/10</dd></div><div><dt>Bolesność</dt><dd>{recovery.soreness ?? "—"}/10</dd></div></dl></> : <p>Dodaj dzisiejszy sen i samopoczucie, zanim poprosisz o kolejny trening.</p>}</article>
      <article className="dashboard-card weather-card runner-weather"><div className="card-heading"><h2>🌦️ Warunki do biegu</h2></div>{!profile?.home_location ? <p>Podaj trenerowi miejscowość lub okolicę.</p> : !weather ? <p>Ładuję pogodę…</p> : "error" in weather ? <p className="card-error">{weather.error}</p> : <><strong>{weather.city} · {weather.temperature.toFixed(1)}°C</strong><p>{weather.description}</p><small>Wiatr {weather.windSpeed} km/h · wilgotność {weather.humidity}%</small></>}</article>
      <article className="dashboard-card actions-card"><div className="card-heading"><h2>🚀 Zacznij</h2></div><div className="quick-actions"><Link href="/chat">Dodaj trening</Link><Link href="/vision">Analizuj screenshot</Link><Link href="/chat">Ustaw cel</Link></div></article>
    </section>
  </main>;
}
