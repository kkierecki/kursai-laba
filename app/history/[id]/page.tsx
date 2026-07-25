"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type Conversation = { id: string; title: string | null; updated_at: string };
type Message = { id: string; role: "user" | "assistant"; content: string; created_at: string };

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Brak aktywnej sesji użytkownika");
        const { data: conversationData, error: conversationError } = await supabase
          .from("conversations")
          .select("id,title,updated_at")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (conversationError) throw conversationError;
        if (!conversationData) throw new Error("Nie znaleziono rozmowy");

        const { data: messageData, error: messagesError } = await supabase
          .from("messages")
          .select("id,role,content,created_at")
          .eq("conversation_id", params.id)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: true });
        if (messagesError) throw messagesError;

        if (!cancelled) {
          setConversation(conversationData as Conversation);
          setMessages((messageData ?? []) as Message[]);
        }
      } catch (loadError) {
        console.error("Nie udało się pobrać rozmowy", loadError);
        if (!cancelled) setError("Nie udało się pobrać tej rozmowy.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadConversation();
    return () => { cancelled = true; };
  }, [params.id]);

  return (
    <main className="history-shell">
      <section className="history-panel conversation-detail" aria-label="Podgląd rozmowy">
        <header className="history-header">
          <div>
            <h1>{conversation?.title?.trim() || "Rozmowa"}</h1>
            {conversation && <p>Ostatnia aktywność: {formatDate(conversation.updated_at)}</p>}
          </div>
          <div className="conversation-actions">
            <Link className="history-back-link" href="/history">← Wróć do listy</Link>
            <Link className="history-new-link" href={`/chat?conversation=${params.id}`}>
              🔄 Kontynuuj rozmowę
            </Link>
          </div>
        </header>

        {isLoading && <p className="history-loading" role="status">Wczytuję rozmowę...</p>}
        {error && <p className="history-error" role="alert">{error}</p>}
        {!isLoading && !error && (
          <div className="history-messages">
            {messages.length === 0 ? (
              <p className="history-empty-message">Ta rozmowa nie ma jeszcze wiadomości.</p>
            ) : messages.map((message) => (
              <article className={`history-message ${message.role}`} key={message.id}>
                <div className="history-message-meta">
                  <span>{message.role === "user" ? "Ty" : "Agent"}</span>
                  <time dateTime={message.created_at}>
                    {new Intl.DateTimeFormat("pl-PL", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}
                  </time>
                </div>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
