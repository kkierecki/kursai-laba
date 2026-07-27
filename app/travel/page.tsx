"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { TravelMessageContent } from "../components/travel-message-content";
import { DiagnosticsPanel } from "../components/diagnostics-panel";

const scenarios = [
  "Zaplanuj wyjazd na półmaraton do Kopenhagi. Budżet: 2000 PLN. Sprawdź pogodę, kurs DKK, święta i użyj kalkulatora.",
  "Zaplanuj wyjazd na maraton do Londynu w sierpniu. Uwzględnij pogodę, kurs GBP, święta i budżet.",
  "Przygotuj plan wyjazdu na bieg do Amsterdamu. Sprawdź pogodę, kurs EUR, święta, informacje o mieście i koszty.",
  "Zaplanuj wyjazd do Londynu na start w przyszłym tygodniu: dane pogodowe, walutowe, święta i checklistę.",
  "Porównaj Barcelonę i Lizbonę jako miejsce zimowego obozu biegowego, korzystając z pogody, kursu EUR, świąt, Wikipedii i kalkulatora.",
];

export default function TravelPage() {
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/travel" }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (isLoading) {
      wasLoadingRef.current = true;
      return;
    }

    if (wasLoadingRef.current && startedAt !== null) {
      setDuration((Date.now() - startedAt) / 1000);
      setStartedAt(null);
      wasLoadingRef.current = false;
    }
  }, [isLoading, startedAt]);

  async function sendText(text: string) {
    if (!text.trim() || isLoading) return;
    setStartedAt(Date.now());
    setDuration(null);
    setInput("");
    await sendMessage({ text: text.trim() });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input);
  }

  return (
    <main className="travel-shell">
      <section className="chat-panel travel-panel" aria-label="Asystent podróży AI">
        <header className="chat-header travel-header">
          <h1>✈️ Asystent podróży AI</h1>
          <p>Powiedz dokąd jedziesz — agent zaplanuje wszystko</p>
          <div className="example-questions">
            {scenarios.map((scenario) => (
              <button disabled={isLoading} key={scenario} onClick={() => sendText(scenario)} type="button">
                {scenario}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="empty-state">Wybierz scenariusz albo opisz planowany wyjazd.</p>
          ) : (
            messages.map((message) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                <div className="message-bubble">
                  {message.role === "assistant" ? (
                    <TravelMessageContent message={message} />
                  ) : (
                    message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && <div className="message-row assistant"><div className="message-bubble loading">Agent zbiera dane o podróży...</div></div>}
          {error && <div className="message-row assistant"><div className="message-bubble">Nie udało się przygotować planu: {error.message}</div></div>}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input aria-label="Planowana podróż" disabled={isLoading} onChange={(event) => setInput(event.target.value)} placeholder="Np. Lecę do Barcelony na weekend..." value={input} />
          <button disabled={isLoading || !input.trim()} type="submit">Zaplanuj</button>
        </form>
        <DiagnosticsPanel duration={duration} isLoading={isLoading} messages={messages} />
      </section>
    </main>
  );
}
