"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ReactMessageContent } from "../components/react-message-content";
import { DiagnosticsPanel } from "../components/diagnostics-panel";

const scenarios = [
  "Użyj getWeather dla Warszawy i zaproponuj bezpieczne dostosowanie treningu do warunków.",
  "Użyj calculator, saveNote oraz getNotes: oblicz tempo dla półmaratonu w 1:50 i zapisz plan tempa.",
  "Użyj getWeather dla Warszawy, Krakowa i Gdańska. Wskaż miasto z najlepszymi warunkami na długi bieg.",
  "Użyj currentDateTime i getHolidays: oblicz, ile dni zostało do startu 11 listopada i rozplanuj tapering.",
  "Użyj readWebPage i wypisz trzy najważniejsze zasady organizatora wskazanego biegu.",
  "Użyj searchKnowledge: ile kosztuje pakiet Premium i jakie obejmuje warunki? Podaj źródło.",
];

function getToolCount(message: UIMessage | undefined) {
  return (
    message?.parts.filter(
      (part) => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
    ).length ?? 0
  );
}

export default function ReactAgentPage() {
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const wasLoadingRef = useRef(false);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/react" }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const toolCount = getToolCount(lastAssistant);
  const progress = Math.min(toolCount, 5);

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
    <main className="react-shell">
      <section className="chat-panel react-panel" aria-label="Agent ReAct">
        <header className="chat-header">
          <h1>🔄 Agent ReAct — Autonomiczne rozumowanie</h1>
          <p>Opisz cel → agent sam planuje i realizuje</p>
          <div className="example-questions">
            {scenarios.map((scenario) => (
              <button disabled={isLoading} key={scenario} onClick={() => sendText(scenario)} type="button">
                {scenario}
              </button>
            ))}
          </div>
        </header>

        {(isLoading || lastAssistant) && (
          <div className="react-progress" aria-label={`Krok ${progress} z 5`}>
            <div><span>Krok {progress} z 5</span><span>{isLoading ? "W trakcie..." : "Ukończone"}</span></div>
            <progress max={5} value={progress} />
          </div>
        )}

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="empty-state">Wybierz scenariusz albo opisz własny cel.</p>
          ) : (
            messages.map((message) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                <div className="message-bubble">
                  {message.role === "assistant" ? (
                    <ReactMessageContent message={message} />
                  ) : (
                    message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && <div className="message-row assistant"><div className="message-bubble loading">Agent planuje kolejny krok...</div></div>}
          {error && <div className="message-row assistant"><div className="message-bubble">Nie udało się wykonać zadania: {error.message}</div></div>}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input aria-label="Cel dla agenta" disabled={isLoading} onChange={(event) => setInput(event.target.value)} placeholder="Opisz co chcesz osiągnąć..." value={input} />
          <button disabled={isLoading || !input.trim()} type="submit">Realizuj</button>
        </form>
        <DiagnosticsPanel duration={duration} isLoading={isLoading} messages={messages} />
      </section>
    </main>
  );
}
