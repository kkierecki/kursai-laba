import { supabase } from "./supabase";

type RunningGoalInput = {
  title: string;
  description?: string;
  targetMetric?: string;
  targetValue?: number;
  targetUnit?: string;
  targetDate?: string;
};

type WorkoutInput = {
  performedOn: string;
  summary: string;
  source: "garmin" | "strava" | "screenshot" | "chat" | "manual" | "other";
  trainingType?: "easy" | "long" | "tempo" | "threshold" | "intervals" | "recovery" | "race" | "cross_training" | "other";
  distanceM?: number;
  durationSeconds?: number;
  averagePaceSeconds?: number;
  averageHr?: number;
  maxHr?: number;
  averageCadenceSpm?: number;
  elevationGainM?: number;
  rpe?: number;
  unstructuredNotes?: string;
  extractedData?: Record<string, string | number | boolean | null>;
  extractionConfidence?: "user_reported" | "screen_verified" | "partial_screen";
};

type RecoveryInput = {
  loggedOn: string;
  sleepHours?: number;
  sleepQuality?: number;
  restingHr?: number;
  hrvMs?: number;
  fatigue?: number;
  soreness?: number;
  painDescription?: string;
  stress?: number;
  notes?: string;
};

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

export async function getRunnerContext(userId: string) {
  const [profile, goals, workout, recovery, conversation] = await Promise.all([
    supabase.from("athlete_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("running_goals").select("title,description,target_metric,target_value,target_unit,target_date,priority").eq("user_id", userId).eq("status", "active").order("priority", { ascending: true }),
    supabase.from("workouts").select("performed_on,summary,training_type,distance_m,duration_seconds,average_hr,average_pace_seconds,average_cadence_spm,unstructured_notes,extraction_confidence").eq("user_id", userId).order("performed_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("recovery_logs").select("logged_on,sleep_hours,sleep_quality,resting_hr,hrv_ms,fatigue,soreness,pain_description,stress,notes").eq("user_id", userId).order("logged_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("conversations").select("updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const errors = [profile.error, goals.error, workout.error, recovery.error, conversation.error]
    .filter(Boolean)
    .map((error) => error?.message);

  return {
    profile: profile.data,
    goals: goals.data ?? [],
    lastWorkout: workout.data,
    lastRecovery: recovery.data,
    lastConversationAt: conversation.data?.updated_at ?? null,
    unavailable: errors.length > 0 ? errors : undefined,
  };
}

export async function saveRunningGoal(userId: string, input: RunningGoalInput) {
  const { data, error } = await supabase.from("running_goals").insert(compact({
    user_id: userId,
    title: input.title.trim(),
    description: input.description?.trim(),
    target_metric: input.targetMetric?.trim(),
    target_value: input.targetValue,
    target_unit: input.targetUnit?.trim(),
    target_date: input.targetDate,
  })).select("id,title").single();
  if (error) throw error;
  return { saved: true, ...data };
}

export async function saveAthleteLocation(userId: string, homeLocation: string) {
  const { error } = await supabase.from("athlete_profiles").upsert({
    user_id: userId,
    home_location: homeLocation.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { saved: true, homeLocation: homeLocation.trim() };
}

export async function saveWorkout(userId: string, input: WorkoutInput) {
  const { data, error } = await supabase.from("workouts").insert(compact({
    user_id: userId,
    performed_on: input.performedOn,
    summary: input.summary.trim(),
    source: input.source,
    training_type: input.trainingType,
    distance_m: input.distanceM,
    duration_seconds: input.durationSeconds,
    average_pace_seconds: input.averagePaceSeconds,
    average_hr: input.averageHr,
    max_hr: input.maxHr,
    average_cadence_spm: input.averageCadenceSpm,
    elevation_gain_m: input.elevationGainM,
    rpe: input.rpe,
    unstructured_notes: input.unstructuredNotes?.trim(),
    extracted_data: input.extractedData ?? {},
    extraction_confidence: input.extractionConfidence ?? "user_reported",
  })).select("id,performed_on").single();
  if (error) throw error;
  return { saved: true, ...data };
}

export async function saveRecoveryLog(userId: string, input: RecoveryInput) {
  const { data, error } = await supabase.from("recovery_logs").upsert(compact({
    user_id: userId,
    logged_on: input.loggedOn,
    sleep_hours: input.sleepHours,
    sleep_quality: input.sleepQuality,
    resting_hr: input.restingHr,
    hrv_ms: input.hrvMs,
    fatigue: input.fatigue,
    soreness: input.soreness,
    pain_description: input.painDescription?.trim(),
    stress: input.stress,
    notes: input.notes?.trim(),
  }), { onConflict: "user_id,logged_on" }).select("id,logged_on").single();
  if (error) throw error;
  return { saved: true, ...data };
}
