"use client";

import { type ReactNode, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Briefing = {
  id: string;
  briefing_date: string;
  created_at: string;
  content: string;
};

type LoadState = "loading" | "ready" | "error";
type BriefingIconName = "briefing" | "spark" | "copy" | "back" | "check" | "calendar";

function BriefingIcon({ name }: { name: BriefingIconName }) {
  const paths: Record<BriefingIconName, ReactNode> = {
    briefing: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6M9 19h4" /></>,
    spark: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" /><path d="m19 17 .7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7L19 17Z" /></>,
    copy: <><rect x="9" y="9" width="10" height="11" rx="1.5" /><path d="M15 9V5.5A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H9" /></>,
    back: <><path d="m13 5-7 7 7 7" /><path d="M6 12h13" /></>,
    check: <><path d="m5 12 4.2 4L19 6" /></>,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  };
  return <svg aria-hidden="true" className="briefing-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.55">{paths[name]}</svg>;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "full",
    timeZone: "Europe/Warsaw",
  }).format(new Date(`${date}T12:00:00Z`));
}

function warsawDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function preview(content: string) {
  const condensed = content.replace(/\s+/g, " ").trim();
  return condensed.length > 150 ? `${condensed.slice(0, 150).trimEnd()}…` : condensed;
}

function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^\)]+\))/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
    return link ? <a href={link[2]} key={index} rel="noreferrer" target="_blank">{link[1]}</a> : <span key={index}>{part}</span>;
  });
}

function BriefingMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    if (line.startsWith("#")) {
      const level = Math.min(line.match(/^#+/)?.[0].length ?? 2, 3);
      const Heading = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(<Heading key={index}>{inline(line.replace(/^#+\s*/, "").replace(/^[^\p{L}\p{N}]+/u, ""))}</Heading>);
      index++;
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (index < lines.length && (ordered ? /^\d+\.\s+/.test(lines[index].trim()) : /^[-*]\s+/.test(lines[index].trim()))) {
        items.push(lines[index].trim().replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""));
        index++;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={index}>{items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</List>);
      continue;
    }
    const paragraph = [line];
    index++;
    while (index < lines.length && lines[index].trim() && !lines[index].trim().startsWith("#") && !/^[-*]\s+/.test(lines[index].trim()) && !/^\d+\.\s+/.test(lines[index].trim())) {
      paragraph.push(lines[index].trim());
      index++;
    }
    blocks.push(<p key={index}>{inline(paragraph.join(" "))}</p>);
  }

  return <>{blocks}</>;
}

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [selectedBriefing, setSelectedBriefing] = useState<Briefing | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const hasTodayBriefing = briefings.some((briefing) => briefing.briefing_date === warsawDate());

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return { Authorization: `Bearer ${session.access_token}` };

    // Przy pierwszym wejściu na stronę klient Supabase może jeszcze nie mieć
    // odtworzonej sesji z localStorage. Odświeżenie wykorzystuje zapisany token
    // odnowienia i zapobiega fałszywemu komunikatowi o wylogowaniu.
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session?.access_token) throw new Error("Sesja wygasła. Zaloguj się ponownie.");
    return { Authorization: `Bearer ${data.session.access_token}` };
  }

  async function loadBriefings() {
    setLoadState("loading");
    try {
      const response = await fetch("/api/briefings", { headers: await authHeaders() });
      const payload = await response.json() as { briefings?: Briefing[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Nie udało się pobrać briefingów.");
      setBriefings(payload.briefings ?? []);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setMessage(error instanceof Error ? error.message : "Nie udało się pobrać briefingów.");
    }
  }

  useEffect(() => { void loadBriefings(); }, []);

  async function generateNow() {
    if (generating) return;
    setGenerating(true);
    setMessage("");
    try {
      const response = await fetch("/api/cron/morning", { headers: await authHeaders() });
      const payload = await response.json() as { cached?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Nie udało się wygenerować briefingu.");
      setMessage(payload.cached ? "Dzisiejszy briefing był już gotowy — odświeżono listę." : "Briefing został wygenerowany.");
      await loadBriefings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Nie udało się wygenerować briefingu.");
    } finally {
      setGenerating(false);
    }
  }

  async function copyBriefing() {
    if (!selectedBriefing) return;
    await navigator.clipboard.writeText(selectedBriefing.content);
    setMessage("Treść briefingu została skopiowana.");
  }

  if (selectedBriefing) {
    return <main className="briefings-shell"><section className="briefings-panel briefing-detail"><header className="briefings-detail-header"><button className="briefings-back" onClick={() => setSelectedBriefing(null)} type="button"><BriefingIcon name="back" />Wróć do listy</button><div><p className="briefings-eyebrow"><BriefingIcon name="briefing" />Poranny briefing</p><h1>{formatDate(selectedBriefing.briefing_date)}</h1></div><button className="briefings-copy" onClick={() => void copyBriefing()} type="button"><BriefingIcon name="copy" />Kopiuj</button></header>{message && <p className="briefings-message" aria-live="polite">{message}</p>}<article className="briefings-markdown"><BriefingMarkdown text={selectedBriefing.content} /></article></section></main>;
  }

  return <main className="briefings-shell"><section className="briefings-panel"><header className="briefings-header"><div><h1 className="briefings-title"><span><BriefingIcon name="briefing" /></span>Briefingi</h1><p>Poranny kontekst do Twojego biegu — zawsze pod ręką.</p></div>{!hasTodayBriefing && <button className="briefings-generate" disabled={generating} onClick={() => void generateNow()} type="button"><BriefingIcon name="spark" />{generating ? "Generuję…" : "Wygeneruj teraz"}</button>}</header>{message && <p className="briefings-message" aria-live="polite">{message}</p>}<div className="briefings-list">{loadState === "loading" && <p className="briefings-status">Wczytywanie briefingów…</p>}{loadState === "error" && <p className="briefings-status briefing-error">{message || "Nie udało się pobrać briefingów."}</p>}{loadState === "ready" && (briefings.length ? briefings.map((briefing) => <button className="briefing-card" key={briefing.id} onClick={() => { setSelectedBriefing(briefing); setMessage(""); }} type="button"><div className="briefing-card-header"><span className="briefing-date-icon"><BriefingIcon name="calendar" /></span><time dateTime={briefing.briefing_date}>{formatDate(briefing.briefing_date)}</time></div><p>{preview(briefing.content)}</p><span className="briefing-auto"><BriefingIcon name="check" />Wygenerowany automatycznie</span></button>) : <div className="briefings-empty"><span className="briefings-empty-icon"><BriefingIcon name="briefing" /></span><div><h2>Jeszcze nie ma briefingu</h2><p>Wygeneruj pierwszy, aby mieć poranny plan pod ręką.</p></div><button className="briefings-generate" disabled={generating} onClick={() => void generateNow()} type="button"><BriefingIcon name="spark" />{generating ? "Generuję…" : "Wygeneruj teraz"}</button></div>)}</div></section></main>;
}
