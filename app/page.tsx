"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { ensureUserProfile } from "../lib/user-profile";
import {
  AttachmentPreview,
  DropOverlay,
  HiddenImageInput,
  type AttachedImage,
  useImageAttachment,
} from "./components/image-attachment";
import DashboardPage from "./components/dashboard-page";

type ChatMode = "casual" | "expert" | "creative";
type AiModel = "flash" | "pro";

const modes: Array<{
  id: ChatMode;
  label: string;
  badge: string;
}> = [
  { id: "casual", label: "💬 Casual", badge: "💬 casual" },
  { id: "expert", label: "🎓 Ekspert", badge: "🎓 ekspert" },
  { id: "creative", label: "🎨 Kreatywny", badge: "🎨 kreatywny" },
];

const aiModels: Array<{
  id: AiModel;
  label: string;
  badge: string;
}> = [
  { id: "flash", label: "⚡ Flash", badge: "⚡ flash" },
  { id: "pro", label: "🧠 Pro", badge: "🧠 pro" },
];

const exampleQuestions = [
  "/trening 8 km spokojnie, średnie tętno 142, tempo 5:45/km",
  "/podsumowanie tygodnia: 3 treningi, 24 km, jeden interwał",
  "Ułóż mi następny trening po dzisiejszym biegu progowym.",
  "Przeanalizuj screenshot z Garmin Connect i wskaż, co poprawić.",
];

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function makeConversationTitle(text: string) {
  const trimmed = text.trim();

  if (trimmed.length <= 50) {
    return trimmed;
  }

  return `${trimmed.slice(0, 47).trimEnd()}...`;
}

type StoredMessage = {
  id: string;
  created_at: string;
  role: "user" | "assistant";
  content: string;
};

export function ChatHome() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<ChatMode>("casual");
  const [aiModel, setAiModel] = useState<AiModel>("flash");
  const [messageModes, setMessageModes] = useState<Record<string, ChatMode>>(
    {},
  );
  const [messageModels, setMessageModels] = useState<Record<string, AiModel>>(
    {},
  );
  const [contextOpen, setContextOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const pendingImageRef = useRef<AttachedImage[]>([]);
  const modeRef = useRef<ChatMode>("casual");
  const aiModelRef = useRef<AiModel>("flash");
  const pendingModeRef = useRef<ChatMode>("casual");
  const pendingAiModelRef = useRef<AiModel>("flash");
  const conversationIdRef = useRef<string | null>(null);
  const conversationTitleRef = useRef<string | null>(null);
  const conversationPromiseRef = useRef<Promise<string> | null>(null);
  const conversationGenerationRef = useRef(0);
  const persistedMessageIdsRef = useRef<Set<string>>(new Set());
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const userIdRef = useRef<string | null>(null);
  const {
    attachedImage,
    attachedImages,
    attachFile,
    attachFiles,
    clearAttachedImage,
    removeImage,
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
        prepareSendMessagesRequest: async ({
          api,
          body,
          id,
          messages,
          messageId,
          trigger,
        }) => {
          const { data: { session } } = await supabase.auth.getSession();
          const headers: Record<string, string> = session
            ? { Authorization: `Bearer ${session.access_token}` }
            : {};
          return {
            api,
            headers,
            body: {
              ...body,
              id,
              images: pendingImageRef.current,
              messages,
              messageId,
              trigger,
              mode: modeRef.current,
              model: aiModelRef.current,
              userId: userIdRef.current,
            },
          };
        },
      }),
    [],
  );
  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    setMessages,
    clearError,
  } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";
  const characterCount = messages.reduce(
    (total, message) => total + getMessageText(message).length,
    0,
  );
  const tokenEstimate = Math.ceil(characterCount / 4);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    let cancelled = false;

    async function initializeUserProfile() {
      setIsProfileLoading(true);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        if (!user) throw new Error("Brak aktywnej sesji użytkownika.");
        if (!session) throw new Error("Sesja użytkownika wygasła.");
        const userId = user.id;

        userIdRef.current = userId;
        setAuthUserId(userId);
        await ensureUserProfile(userId);
      } catch (profileError) {
        console.error("Nie udało się przygotować profilu użytkownika", profileError);
        if (!cancelled) {
          setPersistenceError("Nie udało się przygotować profilu użytkownika.");
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    void initializeUserProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreConversation() {
      if (!authUserId) return;
      setIsRestoring(true);
      setPersistenceError(null);

      try {
        const requestedConversationId = new URLSearchParams(
          window.location.search,
        ).get("conversation");
        const conversationRequest = requestedConversationId
          ? supabase
              .from("conversations")
              .select("id,title")
              .eq("id", requestedConversationId)
              .eq("user_id", authUserId)
              .maybeSingle()
          : supabase
              .from("conversations")
              .select("id,title")
              .eq("user_id", authUserId)
              .order("updated_at", { ascending: false })
              .limit(1)
              .maybeSingle();
        const { data: conversation, error: conversationError } =
          await conversationRequest;

        if (conversationError) {
          throw conversationError;
        }

        if (cancelled) {
          return;
        }

        if (!conversation) {
          conversationIdRef.current = null;
          conversationTitleRef.current = null;
          persistedMessageIdsRef.current = new Set();
          setMessages([]);
          return;
        }

        const { data: storedMessages, error: messagesError } = await supabase
          .from("messages")
          .select("id,created_at,role,content")
          .eq("conversation_id", conversation.id)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: true });

        if (messagesError) {
          throw messagesError;
        }

        if (cancelled) {
          return;
        }

        const typedMessages = (storedMessages ?? []) as StoredMessage[];
        conversationIdRef.current = conversation.id;
        conversationTitleRef.current = conversation.title;
        persistedMessageIdsRef.current = new Set(
          typedMessages.map((message) => message.id),
        );
        setMessages(
          typedMessages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: [{ type: "text" as const, text: message.content }],
          })),
        );
      } catch (restoreError) {
        if (!cancelled) {
          console.error("Nie udało się wczytać rozmowy z Supabase", restoreError);
          setPersistenceError("Nie udało się wczytać zapisanej rozmowy.");
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    }

    void restoreConversation();

    return () => {
      cancelled = true;
    };
  }, [authUserId, setMessages]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    aiModelRef.current = aiModel;
  }, [aiModel]);

  useEffect(() => {
    setMessageModes((current) => {
      let changed = false;
      const next = { ...current };

      for (const message of messages) {
        if (message.role === "assistant" && !next[message.id]) {
          next[message.id] = pendingModeRef.current;
          changed = true;
        }
      }

      return changed ? next : current;
    });

    setMessageModels((current) => {
      let changed = false;
      const next = { ...current };

      for (const message of messages) {
        if (message.role === "assistant" && !next[message.id]) {
          next[message.id] = pendingAiModelRef.current;
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [messages]);

  function ensureConversation(firstUserMessage?: string) {
    const generation = conversationGenerationRef.current;

    if (conversationIdRef.current) {
      return Promise.resolve(conversationIdRef.current);
    }

    if (conversationPromiseRef.current) {
      return conversationPromiseRef.current;
    }

    const conversationPromise = (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          title: firstUserMessage ? makeConversationTitle(firstUserMessage) : null,
          user_id: userIdRef.current,
        })
        .select("id,title")
        .single();

      if (error) {
        throw error;
      }

      if (conversationGenerationRef.current === generation) {
        conversationIdRef.current = data.id;
        conversationTitleRef.current = data.title;
      }
      return data.id;
    })();

    conversationPromiseRef.current = conversationPromise;
    void conversationPromise.catch((conversationError) => {
      if (conversationPromiseRef.current === conversationPromise) {
        conversationPromiseRef.current = null;
      }
      console.error("Nie udało się utworzyć rozmowy w Supabase", conversationError);
      if (conversationGenerationRef.current === generation) {
        setPersistenceError("Nie udało się zapisać rozmowy w bazie.");
      }
    });

    return conversationPromise;
  }

  async function persistMessages(
    nextMessages: UIMessage[],
    generation: number,
  ) {
    if (generation !== conversationGenerationRef.current) {
      return;
    }

    const newMessages = nextMessages.filter(
      (message) =>
        (message.role === "user" || message.role === "assistant") &&
        !persistedMessageIdsRef.current.has(message.id) &&
        getMessageText(message).trim().length > 0,
    );

    if (newMessages.length === 0) {
      return;
    }

    const firstUserMessage = newMessages.find((message) => message.role === "user");
    const conversationId = await ensureConversation(
      firstUserMessage ? getMessageText(firstUserMessage) : undefined,
    );

    if (generation !== conversationGenerationRef.current) {
      return;
    }

    for (const message of newMessages) {
      if (generation !== conversationGenerationRef.current) {
        return;
      }

      if (persistedMessageIdsRef.current.has(message.id)) {
        continue;
      }

      const content = getMessageText(message).trim();
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        role: message.role,
        content,
      });

      if (insertError) {
        throw insertError;
      }

      persistedMessageIdsRef.current.add(message.id);

      const conversationUpdate: {
        updated_at: string;
        title?: string;
      } = { updated_at: new Date().toISOString() };

      if (message.role === "user" && !conversationTitleRef.current) {
        conversationUpdate.title = makeConversationTitle(content);
        conversationTitleRef.current = conversationUpdate.title;
      }

      const { error: updateError } = await supabase
        .from("conversations")
        .update(conversationUpdate)
        .eq("id", conversationId)
        .eq("user_id", userIdRef.current);

      if (updateError) {
        throw updateError;
      }
    }
  }

  useEffect(() => {
    if (isRestoring || status !== "ready" || messages.length === 0) {
      return;
    }

    const generation = conversationGenerationRef.current;
    persistenceQueueRef.current = persistenceQueueRef.current
      .then(() => persistMessages(messages, generation))
      .catch((persistenceErrorValue) => {
        console.error("Nie udało się zapisać wiadomości w Supabase", persistenceErrorValue);
        setPersistenceError("Nie udało się zapisać ostatniej wiadomości.");
      });
  }, [isRestoring, messages, status]);

  async function sendText(text: string) {
    if (
      !text ||
      isLoading ||
      isRestoring ||
      isProfileLoading ||
      isCreatingConversation
    ) {
      return;
    }

    pendingModeRef.current = mode;
    pendingAiModelRef.current = aiModel;
    pendingImageRef.current = attachedImages;
    setInput("");
    clearAttachedImage();
    void ensureConversation(text);
    await sendMessage({ text });
    pendingImageRef.current = [];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendText(input.trim());
  }

  async function handleNewConversation() {
    if (isRestoring || isProfileLoading || isCreatingConversation) {
      return;
    }

    if (isLoading) {
      await stop();
    }

    conversationGenerationRef.current += 1;
    conversationIdRef.current = null;
    conversationTitleRef.current = null;
    conversationPromiseRef.current = null;
    persistedMessageIdsRef.current = new Set();
    clearError();
    setPersistenceError(null);
    setInput("");
    setMessages([]);
    setMessageModes({});
    setMessageModels({});
    setCopied(false);
    setIsCreatingConversation(true);

    try {
      await ensureConversation();
    } catch (conversationError) {
      console.error("Nie udało się rozpocząć nowej rozmowy", conversationError);
      setPersistenceError("Nie udało się rozpocząć nowej rozmowy.");
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function handleExportConversation() {
    const exportText =
      messages
        .map((message) => {
          const author = message.role === "user" ? "User" : "Agent";
          return `${author}: ${getMessageText(message)}`;
        })
        .join("\n") || "Brak wiadomości w rozmowie.";

    await navigator.clipboard.writeText(exportText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
      <section className="chat-panel" aria-label="Czat z agentem AI">
        <header className="chat-header">
          <h1>Trener Biegania AI 🏃</h1>
          <p>
            Twój indywidualny trener: planuje trening, analizuje dane i pilnuje regeneracji.
          </p>
          <div className="example-questions" aria-label="Przykładowe pytania">
            {exampleQuestions.map((question) => (
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

        <HiddenImageInput fileInputRef={fileInputRef} onFiles={attachFiles} />

        <section className="memory-panel" aria-label="Kontekst rozmowy">
          <button
            className="memory-toggle"
            onClick={() => setContextOpen((open) => !open)}
            type="button"
          >
            <span>Kontekst rozmowy</span>
            <span>{contextOpen ? "Zwiń" : "Rozwiń"}</span>
          </button>

          {isRestoring && (
            <div className="memory-loading" role="status">
              Wczytuję ostatnią rozmowę...
            </div>
          )}

          {!isRestoring && contextOpen && (
            <div className="memory-content">
              <p>
                Wiadomości: {messages.length} | ~Tokeny: {tokenEstimate}
              </p>
              <div className="memory-actions">
                <button
                  disabled={isProfileLoading || isCreatingConversation}
                  onClick={handleNewConversation}
                  type="button"
                >
                  🗑 Nowa rozmowa
                </button>
                <button
                  disabled={messages.length === 0}
                  onClick={handleExportConversation}
                  type="button"
                >
                  📋 Eksportuj rozmowę
                </button>
                {copied && <span>Skopiowano!</span>}
              </div>
              {persistenceError && (
                <p className="persistence-error">{persistenceError}</p>
              )}
            </div>
          )}
        </section>

        <div className="messages" aria-live="polite">
          {messages.length === 0 ? (
            <p className="empty-state">
              Opowiedz o swoim bieganiu albo dodaj screenshot treningu.
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
                    {message.role === "assistant" && (
                      <div className="badge-row">
                        <span
                          className={`mode-badge ${
                            messageModes[message.id] ?? mode
                          }`}
                        >
                          {
                            modes.find(
                              (item) =>
                                item.id === (messageModes[message.id] ?? mode),
                            )?.badge
                          }
                        </span>
                        <span
                          className={`model-badge ${
                            messageModels[message.id] ?? aiModel
                          }`}
                        >
                          {
                            aiModels.find(
                              (item) =>
                                item.id ===
                                (messageModels[message.id] ?? aiModel),
                            )?.badge
                          }
                        </span>
                      </div>
                    )}
                    {text}
                  </div>
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

        <div className="model-switcher" aria-label="Model AI">
          {aiModels.map((item) => (
            <button
              className={aiModel === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setAiModel(item.id)}
              type="button"
            >
              {item.label}
              <span>
                {item.id === "flash" ? "szybki" : "zaawansowany"}
              </span>
            </button>
          ))}
        </div>

        <div className="mode-switcher" aria-label="Tryb rozmowy">
          {modes.map((item) => (
            <button
              className={mode === item.id ? "active" : ""}
              key={item.id}
              onClick={() => setMode(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {attachedImages.length > 0 && (
          <div className="attachment-list">
            {attachedImages.map((image, index) => (
              <AttachmentPreview image={image} key={`${image.filename}-${index}`} onRemove={() => removeImage(index)} />
            ))}
          </div>
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
              aria-label="Wiadomość"
              disabled={
                isLoading ||
                isRestoring ||
                isProfileLoading ||
                isCreatingConversation
              }
            onChange={(event) => setInput(event.target.value)}
            onPaste={handlePaste}
            placeholder="Napisz wiadomość..."
            value={input}
          />
          <button
            disabled={
              isLoading ||
              isRestoring ||
              isProfileLoading ||
              isCreatingConversation ||
              input.trim().length === 0
            }
            type="submit"
          >
            Wyślij
          </button>
        </form>
      </section>
    </main>
  );
}

export default DashboardPage;
