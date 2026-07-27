"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

const exampleCommands = [
  "/tabela strefy tętna dla biegacza",
  "/porownanie STS Pogoria vs STS Kapitan Borchardt",
  "/lista 5 zasad bezpiecznego zwiększania kilometrażu",
  "/faq praca przy takielunku dla początkującej załogi",
  "/email prośba o zmianę pakietu startowego w biegu",
];

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    return part;
  });
}

function parseTable(lines: string[], startIndex: number) {
  const tableLines: string[] = [];
  let index = startIndex;

  while (index < lines.length && lines[index].trim().startsWith("|")) {
    tableLines.push(lines[index]);
    index += 1;
  }

  const rows = tableLines
    .filter((line) => !/^\|\s*-+\s*(\|\s*-+\s*)+\|?$/.test(line.trim()))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim()),
    );

  return { rows, nextIndex: index };
}

function MarkdownMessage({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("|")) {
      const { rows, nextIndex } = parseTable(lines, index);

      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table>
            {rows[0] && (
              <thead>
                <tr>
                  {rows[0].map((cell, cellIndex) => (
                    <th key={cellIndex}>{renderInline(cell)}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      index = nextIndex;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push(<h3 key={index}>{renderInline(line.slice(4))}</h3>);
      index += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h2 key={index}>{renderInline(line.slice(3))}</h2>);
      index += 1;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    blocks.push(<p key={index}>{renderInline(line)}</p>);
    index += 1;
  }

  return <div className="markdown-content">{blocks}</div>;
}

export default function FormatPage() {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/format" }),
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
      <section className="chat-panel" aria-label="Formatowanie odpowiedzi AI">
        <header className="chat-header">
          <h1>📐 Formatowanie</h1>
          <p>Agent odpowiada w tabeli, liście, porównaniu - na żądanie</p>
          <div className="example-questions" aria-label="Przykładowe komendy">
            {exampleCommands.map((command) => (
              <button
                disabled={isLoading}
                key={command}
                onClick={() => setInput(command)}
                type="button"
              >
                {command}
              </button>
            ))}
          </div>
        </header>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="empty-state">
              Wybierz komendę, dopisz własny temat i wyślij.
            </p>
          ) : (
            messages.map((message) => {
              const text = getMessageText(message);

              return (
                <div
                  className={`message-row ${message.role}`}
                  key={message.id}
                >
                  <div className="message-bubble">
                    {message.role === "assistant" ? (
                      <MarkdownMessage text={text} />
                    ) : (
                      text
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isLoading && (
            <div className="message-row assistant">
              <div className="message-bubble loading">Formatuję...</div>
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
            aria-label="Komenda formatowania"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Wpisz /tabela, /lista, /porownanie, /faq albo /email..."
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
