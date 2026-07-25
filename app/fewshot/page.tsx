"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const exampleTerms = [
  "Takielunek stały",
  "Takielunek ruchomy",
  "Wachta",
  "Zwrot przez sztag",
  "Bukszpryt",
  "Kapitanat portu",
];

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default function FewshotPage() {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/fewshot" }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || isLoading) {
      return;
    }

    setInput("");
    await sendMessage({ text });
  }

  return (
    <main className="chat-shell">
      <section className="chat-panel" aria-label="Słownik AI">
        <header className="chat-header">
          <h1>📚 Słownik AI</h1>
          <p>Wyjaśniam trudne pojęcia prostym językiem</p>
          <div className="example-questions" aria-label="Przykładowe pojęcia">
            {exampleTerms.map((term) => (
              <button
                disabled={isLoading}
                key={term}
                onClick={() => setInput(term)}
                type="button"
              >
                {term}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="empty-state">
              Wpisz pojęcie, a dostaniesz krótkie wyjaśnienie w stałym
              formacie.
            </p>
          ) : (
            messages.map((message) => {
              const text = getMessageText(message);

              return (
                <div
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className="message-bubble">{text}</div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="message-row assistant">
              <div className="message-bubble loading">Myślę...</div>
            </div>
          )}

          {error && (
            <div className="message-row assistant">
              <div className="message-bubble">
                Nie udało się pobrać odpowiedzi. Spróbuj ponownie.
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <input
            aria-label="Pojęcie do wyjaśnienia"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wpisz pojęcie do wyjaśnienia..."
            value={input}
          />
          <button disabled={isLoading || input.trim().length === 0} type="submit">
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}
