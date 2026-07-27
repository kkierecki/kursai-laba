"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "../../lib/supabase";

const links = [
  { href: "/", label: "🏠 Dashboard" },
  { href: "/chat", label: "💬 Chat" },
  { href: "/history", label: "📜 Historia" },
  { href: "/think", label: "🧠 Myślenie" },
  { href: "/fewshot", label: "📚 Słownik AI" },
  { href: "/format", label: "📐 Formatowanie" },
  { href: "/search", label: "🌐 Wyszukiwarka" },
  { href: "/generate", label: "🎨 Generator grafik" },
  { href: "/vision", label: "👁️ Analiza obrazów" },
  { href: "/agent", label: "🤖 Agent multi-tool" },
  { href: "/react", label: "🔄 Agent ReAct" },
  { href: "/travel", label: "✈️ Podróże" },
  { href: "/extract", label: "📊 Analizator" },
  { href: "/email-triage", label: "📧 E-mail Triage" },
  { href: "/upload", label: "📚 Baza wiedzy" },
];

export function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (pathname === "/login") return null;

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <button
        aria-expanded={open}
        aria-label="Otwórz menu"
        className="nav-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        ☰ Menu
      </button>
      <nav className={`app-nav ${open ? "open" : ""}`} aria-label="Główna nawigacja">
        <div className="nav-brand">Trener Biegania AI</div>
        {links.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? "active" : ""}
              href={link.href}
              key={link.href}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          );
        })}
        <button className="nav-sign-out" onClick={() => void signOut()} type="button">Wyloguj</button>
      </nav>
    </>
  );
}
