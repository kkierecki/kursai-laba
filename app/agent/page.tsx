"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AttachmentPreview,
  DropOverlay,
  HiddenImageInput,
  type AttachedImage,
  useImageAttachment,
} from "../components/image-attachment";
import { MessageContent } from "../components/message-content";

const scenarios = [
  "Wyszukaj aktualne zalecenia dotyczące taperingu przed półmaratonem i podaj źródła.",
  "Przeanalizuj screenshot z Garmin Connect i wypisz tempo, tętno, kadencję oraz obciążenie.",
  "Użyj kalkulatora: policz tempo dla 10 km w 52 minuty oraz prognozę czasu na półmaraton.",
  "Wyszukaj oficjalne informacje o najbliższym biegu na 10 km w Warszawie.",
  "Porównaj trening progowy i interwały VO₂max dla celu: 10 km poniżej 50 minut.",
];

const tools = [
  "🧮 Kalkulator",
  "🕐 Data i czas",
  "🌐 Google Search",
  "📄 Czytanie stron",
  "🎨 Generowanie obrazów",
  "👁️ Analiza obrazów",
];

export default function AgentPage() {
  const [input, setInput] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pendingImageRef = useRef<AttachedImage | null>(null);
  const {
    attachedImage,
    attachFile,
    clearAttachedImage,
    fileInputRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handlePaste,
    imageError,
    isDraggingImage,
    openFilePicker,
  } = useImageAttachment();
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ api, body, id, messages, messageId, trigger }) => ({
          api,
          body: {
            ...body,
            id,
            image: pendingImageRef.current,
            messages,
            messageId,
            trigger,
            mode: "expert",
            model: "flash",
          },
        }),
      }),
    [],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (!isLoading && startedAt) {
      setLastDuration((Date.now() - startedAt) / 1000);
      setStartedAt(null);
    }
  }, [isLoading, startedAt]);

  async function sendText(text: string) {
    if (!text.trim() || isLoading) {
      return;
    }

    pendingImageRef.current = attachedImage;
    setStartedAt(Date.now());
    setInput("");
    clearAttachedImage();
    await sendMessage({ text: text.trim() });
    pendingImageRef.current = null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input);
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const toolCount =
    lastAssistant?.parts.filter(
      (part) => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
    ).length ?? 0;

  return (
    <main
      className="agent-shell drop-shell"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <DropOverlay visible={isDraggingImage} />
      <aside className="tool-sidebar">
        <h2>Moje narzędzia</h2>
        {tools.map((item) => (
          <div className="tool-pill" key={item}>
            <span>{item}</span>
            <strong>aktywny</strong>
          </div>
        ))}
      </aside>

      <section className="chat-panel agent-panel" aria-label="Agent AI Pełna moc">
        <header className="chat-header">
          <h1>🤖 Agent AI - Pełna moc</h1>
          <p>{tools.length} narzędzi • autonomiczne decyzje</p>
          <div className="example-questions" aria-label="Scenariusze">
            {scenarios.map((scenario) => (
              <button
                disabled={isLoading}
                key={scenario}
                onClick={() => sendText(scenario)}
                type="button"
              >
                {scenario}
              </button>
            ))}
          </div>
        </header>

        <HiddenImageInput fileInputRef={fileInputRef} onFile={attachFile} />

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="empty-state">Wybierz scenariusz albo wydaj własne polecenie.</p>
          ) : (
            messages.map((message: UIMessage) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                <div className="message-bubble">
                  <MessageContent message={message} showTimeline={message.role === "assistant"} />
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="message-row assistant">
              <div className="message-bubble loading">Agent wykonuje zadanie...</div>
            </div>
          )}
          {error && (
            <div className="message-row assistant">
              <div className="message-bubble">Nie udało się pobrać odpowiedzi.</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {lastAssistant && (
          <div className="tool-counter">
            Użyto {toolCount} narzędzi
            {lastDuration ? ` | ${lastDuration.toFixed(1)}s` : ""} | Model:
            gemini-3.1-flash-lite
          </div>
        )}

        {attachedImage && (
          <AttachmentPreview image={attachedImage} onRemove={clearAttachedImage} />
        )}
        {imageError && <p className="image-error">{imageError}</p>}

        <form className="composer" onSubmit={handleSubmit}>
          <button
            className="icon-button"
            disabled={isLoading}
            onClick={openFilePicker}
            title="Dodaj obraz"
            type="button"
          >
            📎
          </button>
          <input
            aria-label="Polecenie dla agenta"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            placeholder="Zleć zadanie agentowi..."
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
