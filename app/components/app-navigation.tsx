"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { AppIcon, type AppIconName } from "./app-icon";

type IconName = AppIconName;

const runnerLinks: Array<{ href: string; label: string; mobileLabel: string; icon: IconName }> = [
  { href: "/", label: "Centrum treningowe", mobileLabel: "Start", icon: "home" },
  { href: "/chat", label: "Porozmawiaj z trenerem", mobileLabel: "Trener", icon: "chat" },
  { href: "/history", label: "Historia rozmów", mobileLabel: "Rozmowy", icon: "history" },
  { href: "/trainings", label: "Moje treningi", mobileLabel: "Treningi", icon: "activity" },
  { href: "/race-plan", label: "Plan na zawody", mobileLabel: "Cel", icon: "target" },
  { href: "/briefings", label: "Briefingi", mobileLabel: "Briefingi", icon: "briefing" },
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
  return <AppIcon name={name} />;
}

function OtherNavIcon({ href }: { href: string }) {
  const icons: Record<string, IconName> = {
    "/think": "brain", "/fewshot": "book", "/format": "align", "/search": "search",
    "/generate": "image", "/vision": "eye", "/agent": "bot", "/react": "refresh",
    "/travel": "plane", "/extract": "chart", "/email-triage": "mail", "/report": "report",
    "/competitor": "buildings", "/upload": "library",
  };

  return <AppIcon name={icons[href] ?? "grid"} />;
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
          {otherOpen && <div className="nav-other-links">{otherLinks.map((link) => { const active = pathname.startsWith(link.href); return <Link aria-current={active ? "page" : undefined} className={active ? "active" : ""} href={link.href} key={link.href} onClick={() => setMenuOpen(false)}><OtherNavIcon href={link.href} /><span>{link.label}</span></Link>; })}</div>}
        </div>
        <button className="nav-sign-out" onClick={() => void signOut()} type="button">Wyloguj</button>
      </nav>
    </>
  );
}
