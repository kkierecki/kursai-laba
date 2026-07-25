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

const visionQuestions = [
  "Przeanalizuj załączony obraz żaglowca: wskaż maszty, reje i żagle.",
  "Przeanalizuj załączony plan pokładu i wyciągnij cały widoczny tekst.",
  "Opisz załączoną scenę w 3 zdaniach jak wpis do dziennika bosmana.",
  "Na podstawie załączonego obrazu wskaż elementy takielunku oraz podaj ich funkcje.",
  "Na podstawie załączonego obrazu wygeneruj techniczny szkic tego żaglowca.",
];

export default function VisionPage() {
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
        prepareSendMessagesRequest: ({ api, body, id, messages, messageId, trigger }) => ({
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
    if (!text.trim() || !attachedImage || isLoading) {
      return;
    }

    pendingImageRef.current = attachedImage;
    setInput("");
    clearAttachedImage();
    await sendMessage({ text: text.trim() });
    pendingImageRef.current = null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input);
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
      <section className="chat-panel" aria-label="Agent Vision">
        <header className="chat-header">
          <h1>👁️ Agent Vision</h1>
          <p>Wklej screenshot, wrzuć plik lub przeciągnij obraz</p>
        </header>

        {!attachedImage && messages.length === 0 && (
          <button className="vision-drop-zone" onClick={openFilePicker} type="button">
            <span>📸 Ctrl+V - wklej screenshot</span>
            <span>📁 Kliknij - wybierz plik</span>
            <span>🖱️ Przeciągnij - upuść obraz</span>
          </button>
        )}

        <HiddenImageInput fileInputRef={fileInputRef} onFile={attachFile} />

        <div className="messages" aria-live="polite">
          {messages.map((message: UIMessage) => (
            <div className={`message-row ${message.role}`} key={message.id}>
              <div className="message-bubble">
                <MessageContent message={message} />
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message-row assistant">
              <div className="message-bubble loading">Analizuję...</div>
            </div>
          )}
          {error && (
            <div className="message-row assistant">
              <div className="message-bubble">Nie udało się przeanalizować obrazu.</div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="vision-composer">
          {attachedImage && (
            <>
              <AttachmentPreview image={attachedImage} onRemove={clearAttachedImage} />
              <div className="example-questions" aria-label="Pytania o obraz">
                {visionQuestions.map((question) => (
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
            </>
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
              aria-label="Pytanie o obraz"
              disabled={isLoading}
              onChange={(event) => setInput(event.target.value)}
              onPaste={handlePaste}
              placeholder="Zadaj pytanie o obraz..."
              value={input}
            />
            <button
              disabled={isLoading || !attachedImage || input.trim().length === 0}
              type="submit"
            >
              Wyślij
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
