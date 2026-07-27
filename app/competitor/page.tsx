"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FormEvent, useMemo, useState } from "react";
import { getMessageText } from "../components/message-content";

const examples = [["Shopify", "WooCommerce", "PrestaShop", "Szukam platformy e-commerce dla małego sklepu"], ["Notion", "Obsidian", "Evernote", "Potrzebuję narzędzia do osobistego zarządzania wiedzą"], ["Vercel", "Netlify", "Railway", "Wdrażam małą aplikację Next.js"], ["ChatGPT", "Claude", "Gemini", "Szukam narzędzia AI do codziennej pracy"]] as const;

function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n"); const blocks: React.ReactNode[] = []; let i = 0;
  while (i < lines.length) { const line = lines[i].trim(); if (!line) { i++; continue; }
    if (line.startsWith("#")) { const Heading = `h${Math.min(line.match(/^#+/)?.[0].length ?? 2, 3)}` as "h1" | "h2" | "h3"; blocks.push(<Heading key={i}>{line.replace(/^#+\s*/, "")}</Heading>); i++; continue; }
    if (line.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) { const rows: string[][] = []; while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(lines[i++].split("|").slice(1, -1).map((cell) => cell.trim())); const header = rows.shift() ?? []; rows.shift(); blocks.push(<div className="competitor-table-wrap" key={i}><table><thead><tr>{header.map((cell, x) => <th key={x}>{cell}</th>)}</tr></thead><tbody>{rows.map((row, y) => <tr key={y}>{row.map((cell, x) => <td key={x}>{cell}</td>)}</tr>)}</tbody></table></div>); continue; }
    if (/^[-*]\s+/.test(line)) { const items: string[] = []; while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) items.push(lines[i++].trim().replace(/^[-*]\s+/, "")); blocks.push(<ul key={i}>{items.map((item, x) => <li key={x}>{item}</li>)}</ul>); continue; }
    const paragraph = [line]; i++; while (i < lines.length && lines[i].trim() && !lines[i].trim().startsWith("#") && !lines[i].trim().startsWith("|") && !/^[-*]\s+/.test(lines[i].trim())) paragraph.push(lines[i++].trim()); blocks.push(<p key={i}>{paragraph.join(" ")}</p>);
  } return <>{blocks}</>;
}

export default function CompetitorPage() {
  const [companies, setCompanies] = useState(["", "", ""]); const [context, setContext] = useState("");
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/competitor" }), []); const { messages, sendMessage, status, error, setMessages } = useChat({ transport }); const loading = status === "submitted" || status === "streaming"; const result = [...messages].reverse().find((item) => item.role === "assistant"); const text = result ? getMessageText(result) : "";
  async function compare(event?: FormEvent) { event?.preventDefault(); if (loading || companies.some((company) => !company.trim())) return; await sendMessage({ text: `Porównaj firmy: ${companies.map((company) => company.trim()).join(" vs ")}.${context.trim() ? ` Kontekst użytkownika: ${context.trim()}` : ""}` }); }
  return <main className="competitor-shell"><section className="competitor-panel"><header className="competitor-header"><h1>🏢 Analiza konkurencji</h1><p>Podaj firmy — agent porówna je za Ciebie</p></header><form className="competitor-form" onSubmit={(event) => void compare(event)}><div className="competitor-inputs">{["Firma 1", "Firma 2", "Firma 3"].map((label, i) => <label key={label}>{label}<input onChange={(event) => setCompanies((current) => current.map((item, index) => index === i ? event.target.value : item))} placeholder={["Np. Shopify", "Np. WooCommerce", "Np. PrestaShop"][i]} value={companies[i]} /></label>)}</div><label>Kontekst (opcjonalnie)<textarea onChange={(event) => setContext(event.target.value)} placeholder="Szukam platformy e-commerce dla małego sklepu" value={context} /></label><button className="competitor-primary" disabled={loading || companies.some((company) => !company.trim())} type="submit">🔎 {loading ? "Analizuję..." : "Porównaj"}</button><div className="competitor-examples">{examples.map((example) => <button disabled={loading} key={example.join("-")} onClick={() => { setCompanies([example[0], example[1], example[2]]); setContext(example[3]); setMessages([]); }} type="button">{example.slice(0, 3).join(" vs ")}</button>)}</div></form>{error && <p className="competitor-error">Nie udało się przygotować analizy. Spróbuj ponownie.</p>}{loading && <p className="competitor-loading">Agent zbiera informacje i porównuje firmy...</p>}{text && <section className="competitor-result"><div className="competitor-result-actions"><strong>Gotowa analiza</strong><button onClick={() => void navigator.clipboard.writeText(text)} type="button">📋 Kopiuj analizę</button></div><div className="competitor-markdown"><Markdown text={text} /></div></section>}{messages.length > 0 && !loading && <button className="competitor-clear" onClick={() => setMessages([])} type="button">Wyczyść analizę</button>}</section></main>;
}
