"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiagnosticsPanel } from "../components/diagnostics-panel";
import { RacePlanMessageContent } from "../components/race-plan-message-content";
import { supabase } from "../../lib/supabase";

type SavedPlan = { id: string; event_name: string; event_date: string; distance_km: number | null; location: string | null; plan_markdown: string; updated_at: string };

export default function RacePlanPage() {
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState("");
  const [raceDate, setRaceDate] = useState("");
  const [targetPace, setTargetPace] = useState("");
  const [planFormError, setPlanFormError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [savedPlan, setSavedPlan] = useState<SavedPlan | null>(null);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [planActionError, setPlanActionError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLFormElement>(null);
  const targetPaceRef = useRef<HTMLInputElement>(null);
  const wasLoadingRef = useRef(false);
  const hasLoadedRacesRef = useRef(false);
  const accessTokenRef = useRef<string | null>(null);
  const selectedPlanIdRef = useRef<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/race-plan",
    prepareSendMessagesRequest: async ({ api, body, id, messages, messageId, trigger }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = accessTokenRef.current ?? session?.access_token;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      return {
        api,
        headers,
        body: { ...body, id, messages, messageId, trigger, selectedPlanId: selectedPlanIdRef.current },
      };
    },
  }), []);
  const { messages, sendMessage, status, error, stop, setMessages } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);
  useEffect(() => {
    if (isLoading) { wasLoadingRef.current = true; return; }
    if (wasLoadingRef.current && startedAt !== null) { setDuration((Date.now() - startedAt) / 1000); setStartedAt(null); wasLoadingRef.current = false; }
  }, [isLoading, startedAt]);
  useEffect(() => {
    if (!isLoading) return;
    const timeout = window.setTimeout(() => { void stop(); setTimedOut(true); }, 75000);
    return () => window.clearTimeout(timeout);
  }, [isLoading, stop]);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      accessTokenRef.current = session?.access_token ?? null;
      if (active) setAccessToken(accessTokenRef.current);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
      if (active) setAccessToken(accessTokenRef.current);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const loadSavedPlan = useCallback(async () => {
    const token = accessTokenRef.current;
    try {
      const response = await fetch("/api/race-plans", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const payload = await response.json() as { plans?: SavedPlan[] };
      const plan = payload.plans?.[0] ?? null;
      selectedPlanIdRef.current = plan?.id ?? null;
      setSavedPlan(plan);
    } catch { setSavedPlan(null); }
    finally { setPlansLoaded(true); }
  }, []);
  useEffect(() => { if (accessToken) void loadSavedPlan(); else setPlansLoaded(true); }, [accessToken, loadSavedPlan]);
  useEffect(() => {
    if (!accessToken || !plansLoaded || savedPlan || hasLoadedRacesRef.current || status !== "ready") return;
    hasLoadedRacesRef.current = true;
    setStartedAt(Date.now());
    void sendMessage({ text: "Znajdź i pokaż najbliższe oficjalne biegi w Polsce. Jeśli mam zapisaną lokalizację, zacznij od jej okolic." });
  }, [accessToken, plansLoaded, savedPlan, sendMessage, status]);
  useEffect(() => {
    if (status === "ready" && messages.some((message) => message.role === "assistant")) void loadSavedPlan();
  }, [loadSavedPlan, messages, status]);
  async function sendText(text: string) {
    if (!text.trim() || isLoading) return;
    setStartedAt(Date.now()); setDuration(null); setTimedOut(false); setInput("");
    await sendMessage({ text: text.trim() });
  }
  const targetPaceValid = /^\d{1,2}:\d{2}(?:\s*\/?\s*km)?$/.test(targetPace.trim());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !distanceKm || !raceDate || !targetPaceValid) { setPlanFormError("Uzupełnij nazwę biegu, dystans, datę i docelowe tempo (np. 5:30/km)."); targetPaceRef.current?.focus(); return; }
    setPlanFormError(null);
    await sendText(`Przygotuj pełny plan treningowy. Bieg: ${input.trim()}. Dystans: ${distanceKm} km. Data: ${raceDate}. Docelowe tempo wyłącznie na te zawody: ${targetPace.trim()}. Nie zmieniaj celu w moim profilu.`);
  }
  async function submitPlanChat(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await sendText(input); }
  function selectDistance(race: { name: string; date: string; location: string; officialUrl: string }, distanceKm: number) {
    setInput(`Przygotuj pełny plan treningowy na ${distanceKm} km podczas ${race.name}, ${race.date}, ${race.location}. Oficjalna strona: ${race.officialUrl}.`);
    setDistanceKm(String(distanceKm));
    setRaceDate(race.date);
    setTargetPace("");
    setPlanFormError(null);
    window.requestAnimationFrame(() => { composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); targetPaceRef.current?.focus(); });
  }
  async function updatePlan() {
    if (!savedPlan) return;
    await sendText(`Zaktualizuj wybrany plan na ${savedPlan.event_name} (${savedPlan.distance_km ?? "?"} km, ${savedPlan.event_date}) na podstawie nowych treningów, regeneracji i bieżącej daty. Zapisz zaktualizowaną wersję planu.`);
  }
  async function createNewPlan() {
    if (!savedPlan || !window.confirm(`Usunąć plan „${savedPlan.event_name}” i rozpocząć nowy? Tej operacji nie można cofnąć.`)) return;
    setPlanActionError(null);
    const token = accessTokenRef.current;
    try {
      const response = await fetch("/api/race-plans", { method: "DELETE", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ planId: savedPlan.id }) });
      if (!response.ok) throw new Error();
      selectedPlanIdRef.current = null;
      setSavedPlan(null);
      setMessages([]);
      hasLoadedRacesRef.current = true;
    } catch { setPlanActionError("Nie udało się usunąć planu. Spróbuj ponownie."); }
  }
  return <main className="travel-shell">
    <section className="chat-panel travel-panel" aria-label="Plan przygotowań do zawodów">
      <header className="chat-header travel-header">
        <h1>🏁 Plan na zawody</h1>
        <p>{savedPlan ? `Aktywny plan: ${savedPlan.event_name}` : "Najbliższe biegi pobierają się automatycznie. Wybierz wydarzenie albo wpisz własne dane."}</p>
      </header>
      {savedPlan && <section className="active-race-plan" aria-label="Aktywny plan">
        <div><span>AKTYWNY PLAN</span><h2>{savedPlan.event_name}</h2><p>{[savedPlan.distance_km ? `${savedPlan.distance_km} km` : null, savedPlan.event_date, savedPlan.location].filter(Boolean).join(" · ")}</p></div>
        <div className="active-race-plan-actions"><button disabled={isLoading} onClick={() => void updatePlan()} type="button">Aktualizuj plan</button><button disabled={isLoading} onClick={() => void createNewPlan()} type="button">Nowy plan</button></div>
        <pre>{savedPlan.plan_markdown}</pre>
      </section>}
      <div className="messages" aria-live="polite">
        {messages.length === 0 ? <p className="empty-state">Szukam najbliższych oficjalnych biegów…</p> : messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}><div className="message-bubble">{message.role === "assistant" ? <RacePlanMessageContent message={message} onSelectDistance={selectDistance} /> : message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")}</div></div>)}
        {isLoading && <div className="message-row assistant"><div className="message-bubble loading">Sprawdzam oficjalne wydarzenie i dane treningowe…</div></div>}
        {error && <div className="message-row assistant"><div className="message-bubble">Nie udało się przygotować planu: {error.message}</div></div>}
        <div ref={endRef} />
      </div>
      {!savedPlan ? <form className="race-composer" onSubmit={submit} ref={composerRef}>
        <input aria-label="Nazwa biegu" disabled={isLoading} onChange={(event) => setInput(event.target.value)} placeholder="Bieg*: np. Półmaraton Warszawski" value={input} />
        <input aria-label="Dystans w kilometrach" disabled={isLoading} inputMode="decimal" min="0.1" onChange={(event) => setDistanceKm(event.target.value)} placeholder="Dystans*: km" step="0.1" type="number" value={distanceKm} />
        <input aria-label="Data biegu" disabled={isLoading} onChange={(event) => setRaceDate(event.target.value)} required type="date" value={raceDate} />
        <input aria-describedby={planFormError ? "plan-form-error" : undefined} aria-label="Obowiązkowe docelowe tempo" disabled={isLoading} onChange={(event) => { setTargetPace(event.target.value); setPlanFormError(null); }} placeholder="Tempo*: 5:30/km" ref={targetPaceRef} required value={targetPace} />
        <button disabled={isLoading || !input.trim() || !distanceKm || !raceDate || !targetPaceValid} type="submit">Przygotuj</button>
      </form> : <form className="composer race-plan-chat" onSubmit={submitPlanChat}>
        <input aria-label="Wiadomość o wybranym planie" disabled={isLoading} onChange={(event) => setInput(event.target.value)} placeholder="Zapytaj o ten plan lub opisz zmianę…" value={input} />
        <button disabled={isLoading || !input.trim()} type="submit">Wyślij</button>
      </form>}
      {planFormError && <p className="race-time-error" id="plan-form-error" role="alert">{planFormError}</p>}
      {planActionError && <p className="race-time-error" role="alert">{planActionError}</p>}
      {timedOut && <p className="race-timeout" role="alert">Odpowiedź trwała zbyt długo i została zatrzymana. Spróbuj ponownie.</p>}
      <DiagnosticsPanel duration={duration} isLoading={isLoading} messages={messages} />
    </section>
  </main>;
}
