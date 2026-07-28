"use client";

import Link from "next/link";
import { type ReactNode, useCallback, useEffect, useState } from "react";
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

type DashboardIconName = "goal" | "profile" | "workout" | "history" | "recovery" | "weather" | "start" | "calendar" | "distance" | "pace" | "heart" | "time";

function DashboardIcon({ name }: { name: DashboardIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 1.6 };
  const icons: Record<DashboardIconName, ReactNode> = {
    goal: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
    profile: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.9-3.2 3.1-5 7-5s6.1 1.8 7 5" /></>,
    workout: <><path d="M3 12h4l2.4-6 4.2 12 2.4-6H21" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
    recovery: <><path d="M4 14c2-4 4.6-6 8-6 2.4 0 4.5 1 6.5 3" /><path d="M5 18h14M7 14v4M17 11v7" /></>,
    weather: <><path d="M7 18h10a4 4 0 0 0 .7-7.9A5.8 5.8 0 0 0 6.6 11.7 3.2 3.2 0 0 0 7 18Z" /><path d="M12 3v2M4.4 6.4l1.4 1.4M19.6 6.4l-1.4 1.4" /></>,
    start: <><path d="m5 19 14-7L5 5v14Z" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    distance: <><path d="M5 18 10 6l5 12" /><path d="M7.2 13h5.6" /><path d="M16 18h3" /></>,
    pace: <><circle cx="12" cy="12" r="8" /><path d="m12 7 3 5-5 3" /></>,
    heart: <><path d="M20 9.5C20 14 12 19 12 19S4 14 4 9.5A3.5 3.5 0 0 1 10.2 7L12 8.8 13.8 7A3.5 3.5 0 0 1 20 9.5Z" /></>,
    time: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
  };
  return <svg aria-hidden="true" className="dashboard-icon" viewBox="0 0 24 24" {...common}>{icons[name]}</svg>;
}

function DashboardHeading({ icon, label }: { icon: DashboardIconName; label: string }) {
  return <div className="card-heading"><span className="dashboard-heading-icon"><DashboardIcon name={icon} /></span><h2>{label}</h2></div>;
}

function DashboardMetric({ icon, label, value }: { icon: DashboardIconName; label: string; value: ReactNode }) {
  return <div className="dashboard-metric"><DashboardIcon name={icon} /><div><dt>{label}</dt><dd>{value}</dd></div></div>;
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
  const [briefingState, setBriefingState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [briefingMessage, setBriefingMessage] = useState("");

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

  async function generateMorningBriefing() {
    setBriefingState("loading");
    setBriefingMessage("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
      const response = await fetch("/api/cron/morning", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const payload = await response.json() as { content?: string; error?: string; warning?: string };
      if (!response.ok || !payload.content) throw new Error(payload.error ?? "Nie udało się wygenerować briefingu.");
      setBriefingState("ready");
      setBriefingMessage(`${payload.content}${payload.warning ? `\n\n⚠️ ${payload.warning}` : ""}`);
    } catch (error) {
      setBriefingState("error");
      setBriefingMessage(error instanceof Error ? error.message : "Nie udało się wygenerować briefingu.");
    }
  }

  const goalDetail = goal && profile?.notes && profile.notes.toLocaleLowerCase().includes(goal.title.toLocaleLowerCase()) ? profile.notes : null;

  return <main className="dashboard-shell runner-dashboard">
    <header className="dashboard-hero runner-hero"><div><p>{userName ? `Cześć, ${userName}!` : "Cześć!"}</p><h1>Biegaj mądrzej. Docieraj dalej.</h1><span>{profile?.home_location ?? "Dodaj lokalizację w czacie, aby dopasować pogodę i teren."}</span></div><div className="quick-actions"><button disabled={briefingState === "loading"} onClick={() => void generateMorningBriefing()} type="button">{briefingState === "loading" ? "Ładuję briefing…" : "Dzisiejszy briefing"}</button><button disabled={loading} onClick={() => void load()} type="button">Odśwież</button></div></header>
    {briefingState !== "idle" && <section className="dashboard-card" aria-live="polite"><DashboardHeading icon="calendar" label="Dzisiejszy briefing" /><pre className={briefingState === "error" ? "card-error" : "briefing-content"}>{briefingMessage}</pre></section>}
    <section className="dashboard-grid" aria-label="Podsumowanie biegacza">
      <article className="dashboard-card goal-card"><DashboardHeading icon="goal" label="Najbliższy cel" />{goal ? <><strong className="goal-title">{goal.title}</strong><div className="goal-details">{goal.target_value !== null && <p><DashboardIcon name="pace" />{goal.target_metric}: {goal.target_value} {goal.target_unit}</p>}{goal.target_date && <p><DashboardIcon name="calendar" />Termin: {new Date(`${goal.target_date}T00:00:00`).toLocaleDateString("pl-PL")}</p>}{goalDetail && <p className="goal-description">{goalDetail}</p>}</div></> : <p>Nie masz aktywnego celu. Opisz go trenerowi w czacie.</p>}</article>
      <article className="dashboard-card metrics-card profile-card"><DashboardHeading icon="profile" label="Profil biegacza" />{profile ? <><dl className="runner-metrics"><div><dt>Lokalizacja</dt><dd>{profile.home_location ?? "—"}</dd></div><div><dt>Rok urodzenia</dt><dd>{profile.birth_year ?? "—"}</dd></div><div><dt>Płeć</dt><dd>{{ female: "kobieta", male: "mężczyzna", nonbinary: "niebinarna", undisclosed: "nie podano" }[profile.sex ?? "undisclosed"]}</dd></div><div><dt>Wzrost</dt><dd>{profile.height_cm ?? "—"} {profile.height_cm && "cm"}</dd></div><div><dt>Masa</dt><dd>{profile.weight_kg ?? "—"} {profile.weight_kg && "kg"}</dd></div><div><dt>HRmax</dt><dd>{profile.hr_max ?? "—"} {profile.hr_max && "bpm"}</dd></div><div><dt>Próg mleczanowy</dt><dd>{profile.lactate_threshold_hr ?? "—"} {profile.lactate_threshold_hr && "bpm"}</dd></div><div><dt>Tempo progowe</dt><dd>{profilePace(profile.lactate_threshold_pace_seconds) ?? "—"}</dd></div><div><dt>VO₂max</dt><dd>{profile.vo2max ?? "—"}</dd></div><div><dt>Kadencja</dt><dd>{profile.typical_cadence_spm ?? "—"} {profile.typical_cadence_spm && "spm"}</dd></div></dl>{heartRateZones.length > 0 && <p className="profile-detail"><b>Strefy tętna:</b> {heartRateZones.map((zone) => `Z${zone.zone}: ${zone.lower_bpm}–${zone.upper_bpm} bpm`).join(" · ")}</p>}{profile.weekly_availability && <p className="profile-detail"><b>Dostępność:</b> {profile.weekly_availability}</p>}{profile.injury_limitations && <p className="profile-detail"><b>Ograniczenia zdrowotne:</b> {profile.injury_limitations}</p>}{profile.notes && <p className="profile-detail"><b>Notatki:</b> {profile.notes}</p>}</> : <p>Ładuję profil…</p>}</article>
      <article className="dashboard-card workout-card"><DashboardHeading icon="workout" label="Ostatni trening" />{workout ? <><strong>{workout.summary}</strong><p className="workout-date"><DashboardIcon name="calendar" />{new Date(`${workout.performed_on}T00:00:00`).toLocaleDateString("pl-PL")}</p><dl className="workout-metrics"><DashboardMetric icon="distance" label="Dystans" value={workout.distance_m ? `${(workout.distance_m / 1000).toFixed(1)} km` : "—"} /><DashboardMetric icon="pace" label="Tempo" value={pace(workout.average_pace_seconds)} /><DashboardMetric icon="heart" label="Śr. HR" value={workout.average_hr ?? "—"} /></dl></> : <p>Brak zapisanego treningu.</p>}</article>
      <article className="dashboard-card training-stats-card"><DashboardHeading icon="history" label="Historia treningów" />{trainingStats && trainingStats.count > 0 ? <><dl className="runner-metrics stats-metrics"><DashboardMetric icon="workout" label="Treningi łącznie" value={trainingStats.count} /><DashboardMetric icon="distance" label="Suma kilometrów" value={`${(trainingStats.distanceM / 1000).toFixed(1)} km`} /><DashboardMetric icon="time" label="Suma czasu" value={duration(trainingStats.durationSeconds)} /><DashboardMetric icon="calendar" label="Monitoring od" value={trainingStats.monitoredSince ? new Date(`${trainingStats.monitoredSince}T00:00:00`).toLocaleDateString("pl-PL") : "—"} /><DashboardMetric icon="history" label="Ostatnie 30 dni" value={`${trainingStats.last30DaysCount} · ${(trainingStats.last30DaysDistanceM / 1000).toFixed(1)} km`} /><DashboardMetric icon="distance" label="Najdłuższy bieg" value={trainingStats.longestDistanceM ? `${(trainingStats.longestDistanceM / 1000).toFixed(1)} km` : "—"} /><DashboardMetric icon="pace" label="Średnie tempo" value={profilePace(trainingStats.averagePaceSeconds) ?? "—"} /><DashboardMetric icon="heart" label="Średnie HR" value={trainingStats.averageHr ? `${trainingStats.averageHr} bpm` : "—"} /></dl></> : <p>Dodaj pierwszy trening, aby rozpocząć monitorowanie historii.</p>}</article>
      <article className="dashboard-card recovery-card"><DashboardHeading icon="recovery" label="Regeneracja" />{recovery ? <><strong>{new Date(`${recovery.logged_on}T00:00:00`).toLocaleDateString("pl-PL")}</strong><dl><div><dt>Sen</dt><dd>{recovery.sleep_hours ?? "—"} h</dd></div><div><dt>Zmęczenie</dt><dd>{recovery.fatigue ?? "—"}/10</dd></div><div><dt>Bolesność</dt><dd>{recovery.soreness ?? "—"}/10</dd></div></dl></> : <p>Dodaj dzisiejszy sen i samopoczucie, zanim poprosisz o kolejny trening.</p>}</article>
      <article className="dashboard-card weather-card runner-weather"><DashboardHeading icon="weather" label="Warunki do biegu" />{!profile?.home_location ? <p>Podaj trenerowi miejscowość lub okolicę.</p> : !weather ? <p>Ładuję pogodę…</p> : "error" in weather ? <p className="card-error">{weather.error}</p> : <><strong>{weather.city} · {weather.temperature.toFixed(1)}°C</strong><p>{weather.description}</p><small>Wiatr {weather.windSpeed} km/h · wilgotność {weather.humidity}%</small></>}</article>
      <article className="dashboard-card actions-card"><DashboardHeading icon="start" label="Zacznij" /><div className="quick-actions"><Link href="/chat">Dodaj trening</Link><Link href="/vision">Analizuj screenshot</Link><Link href="/chat">Ustaw cel</Link></div></article>
    </section>
  </main>;
}
