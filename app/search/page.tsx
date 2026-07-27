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

const starterQuestions = [
  "Wyszukaj oficjalny regulamin najbliższego półmaratonu w Warszawie i podaj źródło.",
  "Znajdź aktualne zalecenia dotyczące nawodnienia podczas długiego biegu.",
  "Przeczytaj stronę organizatora wybranego biegu i wypisz najważniejsze terminy.",
  "Wyszukaj wiarygodne źródła o treningu w wysokiej temperaturze.",
];

export default function SearchPage() {
  const [input, setInput] = useState("");
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
        prepareSendMessagesRequest: ({
          api,
          body,
          id,
          messages,
          messageId,
          trigger,
        }) => ({
          api,
          body: {
            ...body,
            id,
            image: pendingImageRef.current,
            messages,
            messageId,
            trigger,
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

  async function sendText(text: string) {
    if (!text || isLoading) {
      return;
    }

    pendingImageRef.current = attachedImage;
    setInput("");
    clearAttachedImage();
    await sendMessage({ text });
    pendingImageRef.current = null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input.trim());
  }

  return (
    <main
      className="chat-shell drop-shell"
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      <DropOverlay visible={isDraggingImage} />
      <section className="chat-panel" aria-label="Agent z wyszukiwarką">
        <header className="chat-header">
          <h1>🌐 Agent z wyszukiwarką</h1>
          <p>Przeszukuję prawdziwy internet i czytam strony</p>
          <div className="example-questions" aria-label="Pytania startowe">
            {starterQuestions.map((question) => (
              <button
                disabled={isLoading}
                key={question}
                onClick={() => sendText(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>
        </header>

        <HiddenImageInput fileInputRef={fileInputRef} onFiles={(files) => { for (const file of files) void attachFile(file); }} />

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="empty-state">
              Zapytaj o aktualne informacje albo podaj adres strony do
              przeczytania.
            </p>
          ) : (
            messages.map((message: UIMessage) => (
              <div className={`message-row ${message.role}`} key={message.id}>
                <div className="message-bubble">
                  <MessageContent message={message} />
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="message-row assistant">
              <div className="message-bubble loading">Szukam...</div>
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
            aria-label="Pytanie do agenta z wyszukiwarką"
            disabled={isLoading}
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            placeholder="Zapytaj o cokolwiek aktualnego..."
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
