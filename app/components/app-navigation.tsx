"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { supabase } from "../../lib/supabase";

type IconName = "home" | "chat" | "history" | "activity" | "target" | "grid";

const runnerLinks: Array<{ href: string; label: string; mobileLabel: string; icon: IconName }> = [
  { href: "/", label: "Centrum treningowe", mobileLabel: "Start", icon: "home" },
  { href: "/chat", label: "Porozmawiaj z trenerem", mobileLabel: "Trener", icon: "chat" },
  { href: "/history", label: "Historia rozmów", mobileLabel: "Rozmowy", icon: "history" },
  { href: "/trainings", label: "Moje treningi", mobileLabel: "Treningi", icon: "activity" },
  { href: "/race-plan", label: "Plan na zawody", mobileLabel: "Cel", icon: "target" },
];

const otherLinks = [
  { href: "/think", label: "Myślenie" },
  { href: "/fewshot", label: "Słownik AI" },
  { href: "/format", label: "Formatowanie" },
  { href: "/search", label: "Wyszukiwarka" },
  { href: "/generate", label: "Generator grafik" },
  { href: "/vision", label: "Analiza obrazów" },
  { href: "/agent", label: "Agent multi-tool" },
  { href: "/react", label: "Agent ReAct" },
  { href: "/travel", label: "Podróże" },
  { href: "/extract", label: "Analizator" },
  { href: "/email-triage", label: "E-mail Triage" },
  { href: "/report", label: "Raporty" },
  { href: "/competitor", label: "Konkurencja" },
  { href: "/upload", label: "Baza wiedzy" },
];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" /></>,
    chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.48 8.7 8.7 0 0 1-3.42-.7L4 20l1.23-3.58A7.4 7.4 0 0 1 4.5 13a7.5 7.5 0 0 1 15.5-1.5Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
    activity: <><path d="M3 12h4l2.4-6 4.2 12 2.4-6H21" /></>,
    target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  };

  return <svg aria-hidden="true" className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(() => otherLinks.some((link) => pathname.startsWith(link.href)));

  if (pathname === "/login") return null;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <header className="mobile-app-bar">
        <Link className="mobile-brand" href="/" aria-label="Trener Biegania AI — strona główna"><span aria-hidden="true" /> RUNLAB</Link>
        <button aria-expanded={menuOpen} aria-label="Otwórz menu" className="nav-toggle" onClick={() => setMenuOpen((value) => !value)} type="button"><NavIcon name="grid" /></button>
      </header>
      {menuOpen && <button aria-label="Zamknij menu" className="nav-scrim" onClick={() => setMenuOpen(false)} type="button" />}
      <nav className={`app-nav ${menuOpen ? "open" : ""}`} aria-label="Główna nawigacja">
        <Link className="nav-brand" href="/" onClick={() => setMenuOpen(false)}><span aria-hidden="true" className="brand-mark" /><span>RUN<span>LAB</span><small>Twój trener biegania</small></span></Link>
        <div className="nav-main-links">
          {runnerLinks.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={link.href} key={link.href} onClick={() => setMenuOpen(false)}><NavIcon name={link.icon} /><span className="nav-label"><span className="nav-label-desktop">{link.label}</span><span className="nav-label-mobile">{link.mobileLabel}</span></span></Link>;
          })}
        </div>
        <div className="nav-other">
          <button aria-expanded={otherOpen} className={`nav-other-toggle ${otherLinks.some((link) => pathname.startsWith(link.href)) ? "active" : ""}`} onClick={() => setOtherOpen((value) => !value)} type="button"><NavIcon name="grid" /> Pozostałe narzędzia <span aria-hidden="true">{otherOpen ? "−" : "+"}</span></button>
          {otherOpen && <div className="nav-other-links">{otherLinks.map((link) => { const active = pathname.startsWith(link.href); return <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={link.href} key={link.href} onClick={() => setMenuOpen(false)}>{link.label}</Link>; })}</div>}
        </div>
        <button className="nav-sign-out" onClick={() => void signOut()} type="button">Wyloguj</button>
      </nav>
    </>
  );
}
