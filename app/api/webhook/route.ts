import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { createSupabaseAdminClient } from "../../../lib/supabase-admin";
import { beginTechnicalRequest, logTechnical } from "../../../lib/technical-logger";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const eventTypes = ["workout", "recovery", "race_interest"] as const;
type WebhookEventType = typeof eventTypes[number];

type WebhookPayload = {
  eventId: string;
  source: string;
  type: WebhookEventType;
  userId: string;
  data: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePayload(value: unknown): WebhookPayload | null {
  if (!isRecord(value) || !isRecord(value.data)) return null;
  const { eventId, source, type, userId } = value;
  if (
    typeof eventId !== "string" || !eventId.trim() || eventId.length > 160 ||
    typeof source !== "string" || !source.trim() || source.length > 80 ||
    typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
    typeof type !== "string" || !eventTypes.includes(type as WebhookEventType)
  ) return null;
  return { eventId: eventId.trim(), source: source.trim(), type: type as WebhookEventType, userId, data: value.data };
}

function analysisPrompt(payload: WebhookPayload) {
  const purpose: Record<WebhookEventType, string> = {
    workout: "Opisz wyłącznie przekazane dane treningu oraz wskaż, które wartości są obecne, a których brakuje.",
    recovery: "Opisz wyłącznie przekazane dane regeneracji oraz zaznacz ewentualne sygnały wymagające ostrożności bez diagnozowania.",
    race_interest: "Podsumuj przekazane informacje o planowanym biegu oraz wskaż, jakie dane są potrzebne do przygotowania planu.",
  };
  return `Jesteś trenerem biegania. Analizujesz zdarzenie z integracji zewnętrznej po polsku.

${purpose[payload.type]}
- Nie wymyślaj metryk, dat, miejsc ani wniosków niewynikających wprost z danych.
- Nie diagnozuj urazów ani chorób.
- Nie zalecaj automatycznego zapisu danych do profilu lub historii treningów.
- Odpowiedz zwięźle, maksymalnie w trzech punktach.

Typ: ${payload.type}
Źródło: ${payload.source}
Dane: ${JSON.stringify(payload.data)}`;
}

export async function POST(request: Request) {
  const requestLog = beginTechnicalRequest(request, "/api/webhook");
  try {
    const secret = process.env.WEBHOOK_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      const response = Response.json({ error: "Unauthorized" }, { status: 401 });
      void requestLog.finish(401);
      return response;
    }

    const payload = parsePayload(await request.json());
    if (!payload) {
      const response = Response.json({ error: "Nieprawidłowy format zdarzenia." }, { status: 400 });
      void requestLog.finish(400);
      return response;
    }

    const admin = createSupabaseAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("webhook_events")
      .select("id,analysis,status")
      .eq("source", payload.source)
      .eq("external_event_id", payload.eventId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
      const response = Response.json({ success: true, duplicate: true, eventId: existing.id, analysis: existing.analysis, status: existing.status });
      void requestLog.finish(200, { source: payload.source, type: payload.type, duplicate: true });
      return response;
    }

    let analysis = "Analiza automatyczna jest tymczasowo niedostępna.";
    let status: "processed" | "analysis_failed" = "processed";
    try {
      const result = await generateText({
        model: google("gemini-3.1-flash-lite"),
        prompt: analysisPrompt(payload),
        maxOutputTokens: 500,
        temperature: 0.1,
      });
      analysis = result.text.trim() || analysis;
      if (!result.text.trim()) status = "analysis_failed";
    } catch (error) {
      status = "analysis_failed";
      void logTechnical("WARN", "webhook.analysis.failed", { requestId: requestLog.requestId, source: payload.source, type: payload.type, error });
    }

    const { data: saved, error: saveError } = await admin
      .from("webhook_events")
      .insert({ user_id: payload.userId, source: payload.source, external_event_id: payload.eventId, type: payload.type, data: payload.data, analysis, status })
      .select("id,created_at,status")
      .single();
    if (saveError) throw saveError;

    const response = Response.json({ success: true, duplicate: false, eventId: saved.id, status: saved.status, analysis });
    void requestLog.finish(200, { source: payload.source, type: payload.type, status: saved.status });
    return response;
  } catch (error) {
    await requestLog.fail(error);
    return Response.json({ error: "Nie udało się przetworzyć zdarzenia." }, { status: 500 });
  }
}
