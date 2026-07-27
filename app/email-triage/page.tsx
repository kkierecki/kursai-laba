"use client";

import { useMemo, useState } from "react";

const exampleEmails = `Od: jan.kowalski@firma.pl
Temat: PILNE - Problem z fakturą
Treść: Kwota faktury FV/2026/001 jest nieprawidłowa — powinno być 5000 zł a jest 3000 zł. Proszę o pilną korektę. Termin płatności mija jutro.

Od: winner@lucky-prize.com
Temat: Congratulations! You won $1,000,000
Treść: Click here to claim your prize! Limited time offer. Act now!

Od: anna.nowak@partner.pl
Temat: Propozycja współpracy
Treść: Chcielibyśmy omówić możliwość współpracy w zakresie usług IT. Czy możemy umówić się na spotkanie w przyszłym tygodniu?

Od: klient123@gmail.com
Temat: Nie działa usługa od 3 dni
Treść: Od poniedziałku nie mogę się zalogować do panelu klienta. Reset hasła nie działa. To już trzeci dzień!

Od: newsletter@branżowy-portal.pl
Temat: Nowe trendy AI w biznesie - raport 2026
Treść: Zapraszamy do lektury najnowszego raportu o zastosowaniach AI w polskich firmach.`;

type Card = { title: string; category: string; priority: string; reason: string; draft: string };
function parseCards(text: string): Card[] { return text.split(/(?=### Mail )/).filter((block) => block.startsWith("### Mail ")).map((block) => ({ title: block.match(/^### Mail .*$/m)?.[0]?.replace(/^### Mail \d+: /, "") ?? "Mail", category: block.match(/^Kategoria:\s*(.*)$/m)?.[1]?.trim() ?? "", priority: block.match(/^Priorytet:\s*(.*)$/m)?.[1]?.trim() ?? "", reason: block.match(/^Uzasadnienie:\s*(.*)$/m)?.[1]?.trim() ?? "", draft: block.match(/^Proponowana odpowiedź:\s*\n([\s\S]*?)(?=\n---|\nPODSUMOWANIE|$)/m)?.[1]?.replace(/^>\s?/gm, "").trim() ?? "" })); }
function priorityClass(priority: string) { const value = priority.toLowerCase(); return value.includes("wysoki") ? "triage-high" : value.includes("średni") ? "triage-medium" : value.includes("spam") ? "triage-spam" : "triage-low"; }

export default function EmailTriagePage() {
  const [input, setInput] = useState(""); const [result, setResult] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const cards = useMemo(() => parseCards(result), [result]);
  async function analyze() { const emails = input.split(/\n\s*\n/).map((email) => email.trim()).filter(Boolean); if (!emails.length || loading) return; setLoading(true); setError(""); setResult(""); try { const response = await fetch("/api/email-triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emails }) }); if (!response.ok || !response.body) throw new Error("Nie udało się rozpocząć analizy."); const reader = response.body.getReader(); const decoder = new TextDecoder(); while (true) { const { value, done } = await reader.read(); if (done) break; setResult((current) => current + decoder.decode(value, { stream: true })); } } catch (err) { setError(err instanceof Error ? err.message : "Wystąpił błąd."); } finally { setLoading(false); } }
  async function copy(text: string) { await navigator.clipboard.writeText(text); }
  return <main className="triage-shell"><section className="triage-panel"><header className="triage-header"><h1>📧 E-mail Triage</h1><p>Wklej maile — agent posortuje je i napisze odpowiedzi</p></header><div className="triage-form"><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Wklej maile tutaj — oddziel je pustą linią..." aria-label="Treść maili" /><div className="triage-actions"><button className="triage-primary" disabled={loading || !input.trim()} onClick={() => void analyze()} type="button">📧 {loading ? "Analizuję..." : "Analizuj maile"}</button><button disabled={loading} onClick={() => setInput(exampleEmails)} type="button">📋 Wklej przykład</button></div></div>{error && <p className="triage-error">{error}</p>}{result && <div className="triage-results"><div className="triage-summary"><strong>Podsumowanie analizy</strong><span>{result.match(/PODSUMOWANIE[\s\S]*/)?.[0]?.replace("PODSUMOWANIE", "").trim() || "Agent analizuje wiadomości..."}</span></div>{cards.map((card) => <article className={`triage-card ${priorityClass(card.priority)}`} key={card.title}><div className="triage-card-heading"><h2>{card.title}</h2><span>{card.priority}</span></div><dl><div><dt>Kategoria</dt><dd>{card.category}</dd></div><div><dt>Uzasadnienie</dt><dd>{card.reason}</dd></div></dl><div className="triage-draft"><div><strong>Proponowana odpowiedź</strong><button onClick={() => void copy(card.draft)} type="button">Kopiuj draft</button></div><blockquote>{card.draft || "Agent przygotowuje draft..."}</blockquote></div></article>)}</div>}</section></main>;
}
