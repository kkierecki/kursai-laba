"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Workout = {
  id: string;
  performed_on: string;
  summary: string;
  training_type: string | null;
  distance_m: number | null;
  duration_seconds: number | null;
  average_pace_seconds: number | null;
  average_hr: number | null;
};

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function formatPace(seconds: number | null) {
  if (!seconds) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}/km`;
}

export default function TrainingsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error: loadError } = await supabase.from("workouts")
      .select("id,performed_on,summary,training_type,distance_m,duration_seconds,average_pace_seconds,average_hr")
      .eq("user_id", user.id).order("performed_on", { ascending: false }).order("created_at", { ascending: false });
    if (loadError) setError("Nie udało się pobrać treningów. Spróbuj ponownie.");
    else setWorkouts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function remove(workout: Workout) {
    if (!window.confirm(`Usunąć trening „${workout.summary}” z ${workout.performed_on}? Tej operacji nie można cofnąć.`)) return;
    setDeletingId(workout.id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error: deleteError } = await supabase.from("workouts").delete().eq("id", workout.id).eq("user_id", user?.id);
    if (deleteError) setError("Nie udało się usunąć treningu. Spróbuj ponownie.");
    else setWorkouts((current) => current.filter((item) => item.id !== workout.id));
    setDeletingId(null);
  }

  return <main className="trainings-shell">
    <section className="trainings-panel" aria-label="Historia treningów">
      <header className="trainings-header">
        <div><h1>🏃 Historia treningów</h1><p>Edytuj wpis naturalnym językiem w czacie lub usuń go z listy.</p></div>
        <Link href="/chat" className="training-chat-link">+ Dodaj przez czat</Link>
      </header>
      {error && <p className="training-error" role="alert">{error}</p>}
      {loading ? <p className="training-state">Wczytywanie treningów…</p> : workouts.length === 0 ? <div className="training-empty"><p>Nie masz jeszcze zapisanych treningów.</p><Link href="/chat">Opisz pierwszy trening trenerowi</Link></div> : <div className="training-list">
        {workouts.map((workout) => <article className="training-card" key={workout.id}>
          <div className="training-card-content">
            <time dateTime={workout.performed_on}>{new Date(`${workout.performed_on}T00:00:00`).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}</time>
            <h2>{workout.summary}</h2>
            <p>{[workout.training_type, workout.distance_m !== null ? `${(workout.distance_m / 1000).toLocaleString("pl-PL")} km` : null, formatDuration(workout.duration_seconds), formatPace(workout.average_pace_seconds), workout.average_hr !== null ? `${workout.average_hr} bpm` : null].filter(Boolean).join(" · ") || "Brak dodatkowych metryk"}</p>
          </div>
          <div className="training-actions">
            <Link className="training-edit" href={`/chat?training=${workout.id}`}>Edytuj w czacie</Link>
            <button className="training-delete" disabled={deletingId === workout.id} onClick={() => void remove(workout)} type="button">{deletingId === workout.id ? "Usuwanie…" : "Usuń"}</button>
          </div>
        </article>)}
      </div>}
    </section>
  </main>;
}
