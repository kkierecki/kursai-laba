"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type KnowledgeDocument = { title: string; chunks: number; createdAt: string };
type KnowledgeChunk = { content: string; index: number; createdAt: string };
type SearchResult = { title: string; content: string; similarity: number; added_at: string | null };
type Progress = { current: number; total: number } | null;

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [progress, setProgress] = useState<Progress>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  async function authHeaders(contentType = false) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    return { ...(contentType ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${session.access_token}` };
  }

  const loadDocuments = useCallback(async () => {
    const response = await fetch("/api/knowledge-documents", { headers: await authHeaders() });
    const data = (await response.json()) as { documents?: KnowledgeDocument[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "Nie udało się pobrać dokumentów.");
    setDocuments(data.documents ?? []);
  }, []);

  useEffect(() => {
    loadDocuments().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Błąd odczytu."));
  }, [loadDocuments]);

  const totalChunks = useMemo(() => documents.reduce((total, document) => total + document.chunks, 0), [documents]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage(""); setProgress({ current: 0, total: 1 });
    try {
      const response = await fetch("/api/upload-knowledge", { method: "POST", headers: await authHeaders(true), body: JSON.stringify({ title, content }) });
      if (!response.ok || !response.body) { const data = (await response.json()) as { error?: string }; throw new Error(data.error ?? "Nie udało się rozpocząć zapisu."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (true) {
        const { done, value } = await reader.read(); buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const update = JSON.parse(line) as { type: string; current?: number; total?: number; chunksSaved?: number; message?: string };
          if (update.type === "progress") setProgress({ current: update.current ?? 0, total: update.total ?? 1 });
          if (update.type === "error") throw new Error(update.message ?? "Błąd zapisu.");
          if (update.type === "complete") { setMessage(`✅ Zapisano ${update.chunksSaved} fragmentów.`); setTitle(""); setContent(""); await loadDocuments(); }
        }
        if (done) break;
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Wystąpił nieznany błąd."); } finally { setProgress(null); }
  }

  async function selectDocument(documentTitle: string) {
    setError(""); setSelectedTitle(documentTitle); setChunks([]);
    try {
      const response = await fetch(`/api/knowledge-documents?title=${encodeURIComponent(documentTitle)}`, { headers: await authHeaders() });
      const data = (await response.json()) as { chunks?: KnowledgeChunk[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nie udało się pobrać fragmentów.");
      setChunks(data.chunks ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Błąd odczytu fragmentów."); }
  }

  async function deleteDocument(documentTitle: string) {
    setDeleting(documentTitle); setError("");
    try {
      const response = await fetch("/api/knowledge-documents", { method: "DELETE", headers: await authHeaders(true), body: JSON.stringify({ title: documentTitle }) });
      if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error ?? "Nie udało się usunąć dokumentu.");
      if (selectedTitle === documentTitle) { setSelectedTitle(null); setChunks([]); }
      await loadDocuments();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Błąd usuwania."); } finally { setDeleting(null); }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSearching(true); setSearchResults([]);
    try {
      const response = await fetch("/api/knowledge-search", { method: "POST", headers: await authHeaders(true), body: JSON.stringify({ query: searchQuery }) });
      const data = (await response.json()) as { results?: SearchResult[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Nie udało się przeszukać bazy.");
      setSearchResults(data.results ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Błąd wyszukiwania."); } finally { setSearching(false); }
  }

  const busy = progress !== null;
  return <main className="knowledge-shell"><section className="knowledge-panel">
    <header className="knowledge-header"><h1>📚 Baza wiedzy</h1><p>Wklej dokumenty, sprawdzaj ich fragmenty i testuj wyszukiwanie RAG.</p></header>
    <form className="knowledge-form" onSubmit={handleSubmit}><label>Tytuł dokumentu<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Np. Cennik 2026, FAQ, Regulamin firmy" disabled={busy} required /></label><label>Treść dokumentu<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Wklej tutaj treść dokumentu..." disabled={busy} required /></label><button disabled={busy} type="submit">📤 {busy ? "Zapisuję..." : "Zapisz w bazie wiedzy"}</button></form>
    {progress && <div className="knowledge-progress"><div>Przetwarzam fragment {progress.current || 1} z {progress.total}...</div><progress value={progress.current} max={progress.total} /></div>}{message && <p className="knowledge-success">{message}</p>}{error && <p className="knowledge-error">{error}</p>}
    <section className="knowledge-list"><h2>Twoja baza wiedzy</h2><p className="knowledge-summary">{totalChunks} fragmentów z {documents.length} dokumentów</p>{documents.length === 0 ? <p className="knowledge-empty">Brak dokumentów w bazie wiedzy.</p> : documents.map((document) => <article key={document.title} className="knowledge-document"><button className="knowledge-document-title" onClick={() => selectDocument(document.title)} type="button"><strong>{document.title}</strong><span>{document.chunks} fragmentów · {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(document.createdAt))}</span></button><button type="button" disabled={deleting === document.title || busy} onClick={() => deleteDocument(document.title)}>🗑️ Usuń</button></article>)}</section>
    {selectedTitle && <section className="knowledge-preview"><h2>Fragmenty: {selectedTitle}</h2>{chunks.map((chunk) => <article key={chunk.index} className="knowledge-chunk"><strong>Fragment {chunk.index + 1}</strong><p>{chunk.content}</p></article>)}</section>}
    <section className="knowledge-search"><h2>Test wyszukiwania</h2><p>Wyszukaj w bazie bez uruchamiania agenta.</p><form onSubmit={search}><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Szukaj w bazie wiedzy..." required /><button disabled={searching} type="submit">{searching ? "Szukam..." : "Szukaj"}</button></form>{searchResults.map((result, index) => <article className="knowledge-result" key={`${result.title}-${index}`}><header><strong>{result.title}</strong><span>Podobieństwo: {result.similarity.toFixed(2)}</span></header><p>{result.content}</p>{result.added_at && <small>Dodano: {new Intl.DateTimeFormat("pl-PL", { dateStyle: "medium" }).format(new Date(result.added_at))}</small>}</article>)}{!searching && searchQuery && searchResults.length === 0 && <p className="knowledge-empty">Brak dopasowań powyżej progu 0,5.</p>}</section>
  </section></main>;
}
