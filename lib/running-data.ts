import { supabase } from "./supabase";
import { saveUserPreference } from "./user-profile";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export type WorkoutUpdateInput = Partial<Omit<WorkoutInput, "performedOn" | "source">> & {
  performedOn?: string;
  source?: WorkoutInput["source"];
};

type RecoveryInput = {
  loggedOn: string;
  sleepHours?: number;
  sleepQuality?: number;
  sleepQualityScale?: number;
  restingHr?: number;
  hrvMs?: number;
  fatigue?: number;
  soreness?: number;
  painDescription?: string;
  stress?: number;
  notes?: string;
};

type AthleteProfileInput = {
  birthYear?: number;
  sex?: "female" | "male" | "nonbinary" | "undisclosed";
  weightKg?: number;
  heightCm?: number;
  hrMax?: number;
  lactateThresholdHr?: number;
  lactateThresholdPaceSeconds?: number;
  vo2max?: number;
  typicalCadenceSpm?: number;
  weeklyAvailability?: string;
  injuryLimitations?: string;
  notes?: string;
  observedOn?: string;
  confirmed?: boolean;
};

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function normalizeSex(value: AthleteProfileInput["sex"] | string | undefined) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["male", "m", "man", "mężczyzna", "mezczyzna"].includes(normalized)) return "male" as const;
  if (["female", "f", "k", "woman", "kobieta"].includes(normalized)) return "female" as const;
  if (["nonbinary", "non-binary", "niebinarna", "niebinarny"].includes(normalized)) return "nonbinary" as const;
  if (["undisclosed", "nie podano", "brak"].includes(normalized)) return "undisclosed" as const;
  return undefined;
}

export async function getRunnerContext(userId: string, database: SupabaseClient = supabase) {
  const [profile, goals, workout, recovery, conversation] = await Promise.all([
    database.from("athlete_profiles").select("*").eq("user_id", userId).maybeSingle(),
    database.from("running_goals").select("title,description,target_metric,target_value,target_unit,target_date,priority").eq("user_id", userId).eq("status", "active").order("priority", { ascending: true }),
    database.from("workouts").select("performed_on,summary,training_type,distance_m,duration_seconds,average_hr,average_pace_seconds,average_cadence_spm,unstructured_notes,extraction_confidence").eq("user_id", userId).order("performed_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    database.from("recovery_logs").select("logged_on,sleep_hours,sleep_quality,sleep_quality_scale,resting_hr,hrv_ms,fatigue,soreness,pain_description,stress,notes").eq("user_id", userId).order("logged_on", { ascending: false }).limit(1).maybeSingle(),
    database.from("conversations").select("updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
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

export async function getHistoricalTrainingMemory(userId: string, database: SupabaseClient = supabase) {
  const { data, error } = await database
    .from("messages")
    .select("created_at,role,content,conversations!inner(user_id)")
    .eq("conversations.user_id", userId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? [])
    .reverse()
    .map((message) => ({
      createdAt: message.created_at,
      role: message.role,
      content: message.content.slice(0, 3000),
    }));
}

export async function backfillScreenVerifiedWorkout(userId: string, database: SupabaseClient = supabase) {
  const history = await getHistoricalTrainingMemory(userId, database);
  const screenSummary = [...history].reverse().find((message) =>
    message.role === "assistant"
    && /wykonałeś.*\d+[,.]\d+\s*km/i.test(message.content)
    && /czas\s*\d{1,2}:\d{2}/i.test(message.content),
  );
  if (!screenSummary) return { saved: false, reason: "not_found" as const };

  const match = screenSummary.content.match(/\((\d{1,2})\.(\d{1,2})\)[\s\S]*?(\d+[,.]\d+)\s*km,\s*czas\s*(\d{1,2}):(\d{2}),\s*średnie tętno\s*(\d+)\s*bpm[\s\S]*?tempo\s*(\d{1,2}):(\d{2})/i);
  if (!match) return { saved: false, reason: "incomplete" as const };

  const [, day, month, distance, minutes, seconds, averageHr, paceMinutes, paceSeconds] = match;
  const now = new Date();
  let year = now.getFullYear();
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const todayMonth = now.getMonth() + 1;
  const todayDay = now.getDate();
  if (monthNumber > todayMonth || (monthNumber === todayMonth && dayNumber > todayDay)) year -= 1;
  const performedOn = `${year}-${String(monthNumber).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
  const distanceM = Math.round(Number(distance.replace(",", ".")) * 1000);
  const durationSeconds = Number(minutes) * 60 + Number(seconds);

  const { data: existing, error: existingError } = await database
    .from("workouts")
    .select("id,performed_on")
    .eq("user_id", userId)
    .eq("performed_on", performedOn)
    .eq("distance_m", distanceM)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return { saved: true, alreadySaved: true, id: existing.id, performedOn };

  return saveWorkout(userId, {
    performedOn,
    summary: `Bieg ${distance.replace(",", ".")} km`,
    source: "screenshot",
    trainingType: "easy",
    distanceM,
    durationSeconds,
    averagePaceSeconds: Number(paceMinutes) * 60 + Number(paceSeconds),
    averageHr: Number(averageHr),
    unstructuredNotes: "Zapis automatyczny z historycznej analizy screena.",
    extractionConfidence: "screen_verified",
  }, database);
}

export async function saveRunningGoal(userId: string, input: RunningGoalInput, database: SupabaseClient = supabase) {
  const goal = compact({
    user_id: userId,
    title: input.title.trim(),
    description: input.description?.trim(),
    target_metric: input.targetMetric?.trim(),
    target_value: input.targetValue,
    target_unit: input.targetUnit?.trim(),
    target_date: input.targetDate,
  });
  const { data: existing, error: findError } = await database
    .from("running_goals")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .ilike("title", input.title.trim())
    .maybeSingle();
  if (findError) throw findError;

  const { data, error } = existing
    ? await database.from("running_goals").update({ ...goal, updated_at: new Date().toISOString() }).eq("id", existing.id).select("id,title").single()
    : await database.from("running_goals").insert(goal).select("id,title").single();
  if (error) throw error;
  return { saved: true, ...data };
}

export async function saveAthleteLocation(userId: string, homeLocation: string, database: SupabaseClient = supabase) {
  const { error } = await database.from("athlete_profiles").upsert({
    user_id: userId,
    home_location: homeLocation.trim(),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    // Starsza, używana już baza nie ma jeszcze kolumny home_location.
    // Lokalizacja pozostaje trwała w profilu użytkownika i dashboard ma
    // dla niej odczyt zapasowy, aż do uruchomienia migracji 003.
    if (error.message.includes("home_location")) {
      await saveUserPreference(userId, "home_location", homeLocation.trim(), database);
      return { saved: true, homeLocation: homeLocation.trim(), storage: "user_preferences" };
    }
    throw error;
  }
  return { saved: true, homeLocation: homeLocation.trim() };
}

export async function saveAthleteProfile(userId: string, input: AthleteProfileInput, database: SupabaseClient = supabase) {
  const hasProfileData = Object.entries(input).some(([key, value]) =>
    !["observedOn", "confirmed"].includes(key) && value !== undefined,
  );
  if (!hasProfileData) return { saved: false, error: "Brak parametrów profilu do zapisania." };
  const normalizedSex = normalizeSex(input.sex);
  const { data: existing, error: loadError } = await database
    .from("athlete_profiles")
    .select("birth_year,weight_kg,height_cm,hr_max,lactate_threshold_hr,lactate_threshold_pace_seconds,vo2max,typical_cadence_spm")
    .eq("user_id", userId)
    .maybeSingle();
  if (loadError) throw loadError;

  // Wdrożenia sprzed migracji 004 nadal zapisują profil; tracą jedynie
  // automatyczne porównanie obiektywnych dat pomiarów do czasu jej uruchomienia.
  const metricDates = await database
    .from("athlete_profiles")
    .select("metric_observed_at")
    .eq("user_id", userId)
    .maybeSingle();
  const supportsMetricDates = !metricDates.error;
  if (metricDates.error && !metricDates.error.message.includes("metric_observed_at")) throw metricDates.error;

  const metrics = [
    ["birth_year", input.birthYear], ["weight_kg", input.weightKg], ["height_cm", input.heightCm],
    ["hr_max", input.hrMax], ["lactate_threshold_hr", input.lactateThresholdHr],
    ["lactate_threshold_pace_seconds", input.lactateThresholdPaceSeconds], ["vo2max", input.vo2max],
    ["typical_cadence_spm", input.typicalCadenceSpm],
  ] as const;
  const observedAt = (metricDates.data?.metric_observed_at && typeof metricDates.data.metric_observed_at === "object"
    ? metricDates.data.metric_observed_at : {}) as Record<string, string>;
  const conflicts = metrics.flatMap(([key, nextValue]) => {
    const currentValue = existing?.[key];
    if (nextValue === undefined || currentValue === null || currentValue === undefined || Number(currentValue) === nextValue) return [];
    const previousDate = observedAt[key];
    const isObjectivelyNewer = Boolean(input.observedOn && previousDate && input.observedOn > previousDate);
    return input.confirmed || isObjectivelyNewer ? [] : [{ field: key, currentValue, proposedValue: nextValue, previousObservedOn: previousDate ?? null }];
  });
  const blockedFields = new Set<string>(conflicts.map((conflict) => conflict.field));
  const acceptedMetrics = metrics.filter(([key, value]) => value !== undefined && !blockedFields.has(key));

  const nextObservedAt = { ...observedAt };
  if (input.observedOn) {
    acceptedMetrics.forEach(([key]) => { nextObservedAt[key] = input.observedOn as string; });
  }
  const accepts = (field: string) => !blockedFields.has(field);
  const profile = compact({
    user_id: userId,
    birth_year: accepts("birth_year") ? input.birthYear : undefined,
    sex: normalizedSex,
    weight_kg: accepts("weight_kg") ? input.weightKg : undefined,
    height_cm: accepts("height_cm") ? input.heightCm : undefined,
    hr_max: accepts("hr_max") ? input.hrMax : undefined,
    lactate_threshold_hr: accepts("lactate_threshold_hr") ? input.lactateThresholdHr : undefined,
    lactate_threshold_pace_seconds: accepts("lactate_threshold_pace_seconds") ? input.lactateThresholdPaceSeconds : undefined,
    vo2max: accepts("vo2max") ? input.vo2max : undefined,
    typical_cadence_spm: accepts("typical_cadence_spm") ? input.typicalCadenceSpm : undefined,
    weekly_availability: input.weeklyAvailability?.trim(),
    injury_limitations: input.injuryLimitations?.trim(),
    notes: input.notes?.trim(),
    updated_at: new Date().toISOString(),
  });
  const savedFields = [
    ...acceptedMetrics.map(([key]) => key),
    ...(normalizedSex !== undefined ? ["sex"] : []),
    ...(input.weeklyAvailability !== undefined ? ["weekly_availability"] : []),
    ...(input.injuryLimitations !== undefined ? ["injury_limitations"] : []),
    ...(input.notes !== undefined ? ["notes"] : []),
  ];
  if (savedFields.length === 0) return { saved: false, requiresConfirmation: conflicts.length > 0, conflicts, savedFields };
  const { error } = await database.from("athlete_profiles").upsert(supportsMetricDates
    ? { ...profile, metric_observed_at: nextObservedAt }
    : profile);
  if (error) throw error;
  return { saved: true, savedFields, requiresConfirmation: conflicts.length > 0, conflicts };
}

export async function saveWorkout(userId: string, input: WorkoutInput, database: SupabaseClient = supabase) {
  const { data, error } = await database.from("workouts").insert(compact({
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

export async function updateWorkout(userId: string, workoutId: string, input: WorkoutUpdateInput, database: SupabaseClient = supabase) {
  const update = compact({
    performed_on: input.performedOn,
    summary: input.summary?.trim(),
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
    extraction_confidence: input.extractionConfidence,
    updated_at: new Date().toISOString(),
  });
  if (Object.keys(update).length === 1) return { saved: false, error: "Brak danych treningu do zmiany." };
  const { data, error } = await database.from("workouts")
    .update(update).eq("id", workoutId).eq("user_id", userId)
    .select("id,performed_on,summary").maybeSingle();
  if (error) throw error;
  if (!data) return { saved: false, error: "Nie znaleziono wskazanego treningu." };
  return { saved: true, ...data };
}

export async function deleteWorkout(userId: string, workoutId: string, database: SupabaseClient = supabase) {
  const { data, error } = await database.from("workouts")
    .delete().eq("id", workoutId).eq("user_id", userId).select("id").maybeSingle();
  if (error) throw error;
  return data ? { deleted: true, id: data.id } : { deleted: false, error: "Nie znaleziono wskazanego treningu." };
}

export async function saveRecoveryLog(userId: string, input: RecoveryInput, database: SupabaseClient = supabase) {
  const hasRecoveryData = Object.entries(input).some(([key, value]) => key !== "loggedOn" && value !== undefined);
  if (!hasRecoveryData) return { saved: false, error: "Brak danych regeneracji do zapisania." };
  if (input.sleepQuality !== undefined) {
    if (input.sleepQualityScale !== 5 && input.sleepQualityScale !== 100) {
      return { saved: false, error: "Podaj widoczną skalę jakości snu: 5 albo 100." };
    }
    if (input.sleepQuality < 1 || input.sleepQuality > input.sleepQualityScale) {
      return { saved: false, error: "Wynik jakości snu musi mieścić się w podanej skali." };
    }
  }
  const { data, error } = await database.from("recovery_logs").upsert(compact({
    user_id: userId,
    logged_on: input.loggedOn,
    sleep_hours: input.sleepHours,
    sleep_quality: input.sleepQuality,
    sleep_quality_scale: input.sleepQualityScale,
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
