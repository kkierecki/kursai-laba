import { supabase } from "./supabase";

export type RacePlanInput = {
  eventName: string;
  eventDate: string;
  officialUrl: string;
  planMarkdown: string;
  distanceKm?: number;
  location?: string;
  eventDetails?: Record<string, unknown>;
};

export async function getActiveRacePlans(userId: string) {
  const { data, error } = await supabase
    .from("race_plans")
    .select("id,event_name,event_date,distance_km,location,official_url,event_details,plan_markdown,updated_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("event_date", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function saveRacePlan(userId: string, input: RacePlanInput) {
  const { data: existing, error: findError } = await supabase
    .from("race_plans").select("id").eq("user_id", userId)
    .eq("event_name", input.eventName.trim()).eq("event_date", input.eventDate)
    .eq("status", "active").maybeSingle();
  if (findError) throw findError;
  const record = {
    user_id: userId, event_name: input.eventName.trim(), event_date: input.eventDate,
    distance_km: input.distanceKm, location: input.location?.trim(), official_url: input.officialUrl,
    event_details: input.eventDetails ?? {}, plan_markdown: input.planMarkdown.trim(), updated_at: new Date().toISOString(),
  };
  const query = existing ? supabase.from("race_plans").update(record).eq("id", existing.id) : supabase.from("race_plans").insert(record);
  const { data, error } = await query.select("id,event_name,event_date,updated_at").single();
  if (error) throw error;
  return { saved: true, plan: data, updated: Boolean(existing) };
}
