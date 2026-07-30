import { supabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export type UserProfile = {
  id: string;
  name: string | null;
  preferences: Record<string, string>;
};

type UserProfileRow = {
  id: string;
  name: string | null;
  preferences: unknown;
};

function normalizePreferences(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, item]) =>
        Boolean(key) && typeof item === "string" && item.trim().length > 0,
    ),
  );
}

function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    name: row.name?.trim() || null,
    preferences: normalizePreferences(row.preferences),
  };
}

export async function ensureUserProfile(userId: string, database: SupabaseClient = supabase) {
  const { data, error } = await database
    .from("user_profiles")
    .select("id,name,preferences")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return toUserProfile(data as UserProfileRow);
  }

  const { data: created, error: createError } = await database
    .from("user_profiles")
    .insert({ id: userId, preferences: {} })
    .select("id,name,preferences")
    .single();

  if (createError) {
    throw createError;
  }

  return toUserProfile(created as UserProfileRow);
}

export async function saveUserName(userId: string, name: string, database: SupabaseClient = supabase) {
  const normalizedName = name.trim().replace(/\s+/g, " ").slice(0, 80);

  if (!normalizedName) {
    return { saved: false, error: "Imię nie może być puste." };
  }

  const { error } = await database
    .from("user_profiles")
    .update({ name: normalizedName })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  return { saved: true, name: normalizedName };
}

export async function saveUserPreference(
  userId: string,
  key: string,
  value: string,
  database: SupabaseClient = supabase,
) {
  const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 50);
  const normalizedValue = value.trim().slice(0, 200);

  if (!/^[a-z0-9_-]+$/.test(normalizedKey)) {
    return {
      saved: false,
      error: "Klucz preferencji może zawierać litery, cyfry, myślnik i podkreślenie.",
    };
  }

  if (!normalizedValue) {
    return { saved: false, error: "Wartość preferencji nie może być pusta." };
  }

  const profile = await ensureUserProfile(userId, database);
  const preferences = {
    ...profile.preferences,
    [normalizedKey]: normalizedValue,
  };

  const { error } = await database
    .from("user_profiles")
    .update({ preferences })
    .eq("id", userId);

  if (error) {
    throw error;
  }

  return { saved: true, key: normalizedKey, value: normalizedValue };
}
