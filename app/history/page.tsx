"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type Conversation = {
  id: string;
  title: string | null;
  updated_at: string;
};

type Message = {
  conversation_id: string;
  content: string;
  created_at: string;
};

type ConversationSummary = Conversation & {
  messageCount: number;
  lastMessage: string | null;
  searchableContent: string;
};

function formatActivity(date: string) {
  const difference = new Date(date).getTime() - Date.now();
  const minutes = Math.round(difference / 60_000);
  const relativeTime = new Intl.RelativeTimeFormat("pl", { numeric: "auto" });

  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, "minute");
  if (Math.abs(minutes) < 1_440) return relativeTime.format(Math.round(minutes / 60), "hour");
  if (Math.abs(minutes) < 10_080) return relativeTime.format(Math.round(minutes / 1_440), "day");

  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export default function HistoryPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadConversations() {
    setIsLoading(true);
    setError(null);

    try {
      const { data: conversationData, error: conversationError } = await supabase
        .from("conversations")
        .select("id,title,updated_at")
        .order("updated_at", { ascending: false });

      if (conversationError) throw conversationError;

      const ids = (conversationData ?? []).map((conversation) => conversation.id);
      const { data: messageData, error: messageError } = ids.length
        ? await supabase
            .from("messages")
            .select("conversation_id,content,created_at")
            .in("conversation_id", ids)
            .order("created_at", { ascending: true })
        : { data: [], error: null };

      if (messageError) throw messageError;

      const messagesByConversation = new Map<string, Message[]>();
      for (const message of (messageData ?? []) as Message[]) {
        const messages = messagesByConversation.get(message.conversation_id) ?? [];
        messages.push(message);
        messagesByConversation.set(message.conversation_id, messages);
      }

      setConversations(
        ((conversationData ?? []) as Conversation[]).map((conversation) => {
          const messages = messagesByConversation.get(conversation.id) ?? [];
          const lastMessage = messages.at(-1)?.content ?? null;
          return {
            ...conversation,
            messageCount: messages.length,
            lastMessage,
            searchableContent: messages.map((message) => message.content).join(" "),
          };
        }),
      );
    } catch (loadError) {
      console.error("Nie udało się pobrać historii rozmów", loadError);
      setError("Nie udało się pobrać historii rozmów. Spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadConversations();
  }, []);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pl-PL");
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      `${conversation.title ?? ""} ${conversation.searchableContent}`
        .toLocaleLowerCase("pl-PL")
        .includes(query),
    );
  }, [conversations, search]);

  async function deleteConversation(id: string) {
    if (
      !window.confirm(
        "Czy na pewno chcesz usunąć tę rozmowę? Tej operacji nie można cofnąć.",
      )
    ) {
      return;
    }

    setDeletingId(id);
    setError(null);
    try {
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", id);
      if (messagesError) throw messagesError;

      const { error: conversationError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", id);
      if (conversationError) throw conversationError;

      setConversations((current) =>
        current.filter((conversation) => conversation.id !== id),
      );
      setNotice("Rozmowa usunięta");
      window.setTimeout(() => setNotice(null), 3_000);
    } catch (deleteError) {
      console.error("Nie udało się usunąć rozmowy", deleteError);
      setError("Nie udało się usunąć rozmowy. Spróbuj ponownie.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="history-shell">
      <section className="history-panel" aria-label="Historia rozmów">
        <header className="history-header">
          <div>
            <h1>📜 Historia rozmów</h1>
            <p>Wszystkie Twoje rozmowy z agentem</p>
          </div>
          <Link className="history-new-link" href="/chat">
            + Nowa rozmowa
          </Link>
        </header>

        <label className="history-search">
          <span>Szukaj w rozmowach</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Szukaj w rozmowach..."
            value={search}
          />
        </label>

        {notice && <p className="history-notice" role="status">{notice}</p>}
        {error && <p className="history-error" role="alert">{error}</p>}

        {isLoading ? (
          <p className="history-loading" role="status">Wczytuję rozmowy...</p>
        ) : filteredConversations.length === 0 ? (
          <div className="history-empty">
            <p>
              {conversations.length === 0
                ? "Nie masz jeszcze żadnych rozmów. Zacznij nową!"
                : "Nie znaleziono rozmów pasujących do wyszukiwania."}
            </p>
            {conversations.length === 0 && <Link href="/chat">Rozpocznij rozmowę</Link>}
          </div>
        ) : (
          <div className="history-list">
            {filteredConversations.map((conversation) => (
              <article className="history-card" key={conversation.id}>
                <Link className="history-card-link" href={`/history/${conversation.id}`}>
                  <div className="history-card-topline">
                    <h2>{conversation.title?.trim() || "Nowa rozmowa"}</h2>
                    <time dateTime={conversation.updated_at}>
                      {formatActivity(conversation.updated_at)}
                    </time>
                  </div>
                  <p className="history-card-meta">
                    {conversation.messageCount} {conversation.messageCount === 1 ? "wiadomość" : "wiadomości"}
                  </p>
                  <p className="history-card-preview">
                    {conversation.lastMessage
                      ? conversation.lastMessage.slice(0, 100) +
                        (conversation.lastMessage.length > 100 ? "…" : "")
                      : "Brak wiadomości w rozmowie."}
                  </p>
                </Link>
                <button
                  aria-label={`Usuń rozmowę: ${conversation.title ?? "Nowa rozmowa"}`}
                  className="history-delete"
                  disabled={deletingId === conversation.id}
                  onClick={() => void deleteConversation(conversation.id)}
                  type="button"
                >
                  {deletingId === conversation.id ? "Usuwanie..." : "🗑️ Usuń"}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
