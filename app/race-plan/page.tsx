"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DiagnosticsPanel } from "../components/diagnostics-panel";
import { MessageContent } from "../components/message-content";
import { supabase } from "../../lib/supabase";

export default function RacePlanPage() {
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const hasLoadedRacesRef = useRef(false);
  const accessTokenRef = useRef<string | null>(null);
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
        body: { ...body, id, messages, messageId, trigger },
      };
    },
  }), []);
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, status]);
  useEffect(() => {
    if (isLoading) { wasLoadingRef.current = true; return; }
    if (wasLoadingRef.current && startedAt !== null) { setDuration((Date.now() - startedAt) / 1000); setStartedAt(null); wasLoadingRef.current = false; }
  }, [isLoading, startedAt]);
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
  useEffect(() => {
    if (!accessToken || hasLoadedRacesRef.current || status !== "ready") return;
    hasLoadedRacesRef.current = true;
    setStartedAt(Date.now());
    void sendMessage({ text: "Znajdź i pokaż najbliższe oficjalne biegi w Polsce. Jeśli mam zapisaną lokalizację, zacznij od jej okolic." });
  }, [accessToken, sendMessage, status]);
  async function sendText(text: string) {
    if (!text.trim() || isLoading) return;
    setStartedAt(Date.now()); setDuration(null); setInput("");
    await sendMessage({ text: text.trim() });
  }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); await sendText(input); }
  return <main className="travel-shell">
    <section className="chat-panel travel-panel" aria-label="Plan przygotowań do zawodów">
      <header className="chat-header travel-header">
        <h1>🏁 Plan na zawody</h1>
        <p>Najbliższe oficjalne biegi pobierają się automatycznie. Wybierz wydarzenie albo wpisz nazwę biegu, aby przygotować plan.</p>
      </header>
      <div className="messages" aria-live="polite">
        {messages.length === 0 ? <p className="empty-state">Szukam najbliższych oficjalnych biegów…</p> : messages.map((message) => <div className={`message-row ${message.role}`} key={message.id}><div className="message-bubble">{message.role === "assistant" ? <MessageContent message={message} showTimeline /> : message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")}</div></div>)}
        {isLoading && <div className="message-row assistant"><div className="message-bubble loading">Sprawdzam oficjalne wydarzenie i dane treningowe…</div></div>}
        {error && <div className="message-row assistant"><div className="message-bubble">Nie udało się przygotować planu: {error.message}</div></div>}
        <div ref={endRef} />
      </div>
      <form className="composer" onSubmit={submit}><input aria-label="Zawody lub aktualizacja planu" disabled={isLoading} onChange={(event) => setInput(event.target.value)} placeholder="Np. Półmaraton Warszawski — przygotuj plan" value={input} /><button disabled={isLoading || !input.trim()} type="submit">Przygotuj</button></form>
      <DiagnosticsPanel duration={duration} isLoading={isLoading} messages={messages} />
    </section>
  </main>;
}
