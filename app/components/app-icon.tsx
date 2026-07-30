import type { ReactNode } from "react";

export type AppIconName =
  | "home" | "chat" | "history" | "activity" | "target" | "briefing"
  | "grid" | "brain" | "book" | "align" | "search" | "image" | "eye"
  | "bot" | "refresh" | "plane" | "chart" | "mail" | "report"
  | "buildings" | "library" | "settings";

const paths: Record<AppIconName, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />,
  chat: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.48 8.7 8.7 0 0 1-3.42-.7L4 20l1.23-3.58A7.4 7.4 0 0 1 4.5 13a7.5 7.5 0 0 1 15.5-1.5Z" /><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
  activity: <path d="M3 12h4l2.4-6 4.2 12 2.4-6H21" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>,
  briefing: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 11h6M9 15h6M9 19h4" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  brain: <><path d="M9.5 4.5A3.2 3.2 0 0 0 4 6.8 3.2 3.2 0 0 0 5 13a3.3 3.3 0 0 0 2.5 5.8h2V4.5Z" /><path d="M14.5 4.5A3.2 3.2 0 0 1 20 6.8 3.2 3.2 0 0 1 19 13a3.3 3.3 0 0 1-2.5 5.8h-2V4.5Z" /><path d="M7 9h2.5M14.5 9H17M8 14h1.5M14.5 14H16" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22Z" /><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5A2.5 2.5 0 0 1 20 22Z" /></>,
  align: <><path d="M4 6h16M4 10h10M4 14h16M4 18h10" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.4" /><path d="m5 18 5.2-5 3.1 3 2.2-2.2L20 18" /></>,
  eye: <><path d="M2.7 12S6 6.5 12 6.5 21.3 12 21.3 12 18 17.5 12 17.5 2.7 12 2.7 12Z" /><circle cx="12" cy="12" r="2.7" /></>,
  bot: <><rect x="4" y="7" width="16" height="12" rx="3" /><path d="M12 3v4M8 12h.01M16 12h.01M8 16h8" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.7-4.3L3 9" /><path d="M3 4v5h5M4 13a8 8 0 0 0 14.7 4.3L21 15" /><path d="M16 15h5v5" /></>,
  plane: <><path d="m21 3-7.5 18-3.3-7.2L3 10.5 21 3Z" /><path d="m10.2 13.8 3.1-3.1" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></>,
  report: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 17v-4M12 17V9M15 17v-6" /></>,
  buildings: <><path d="M4 21V5h10v16M14 10h6v11M7 9h.01M11 9h.01M7 13h.01M11 13h.01M7 17h.01M11 17h.01M17 14h.01M17 18h.01" /></>,
  library: <><path d="M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z" /><path d="m3 20 18 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.08h-3v-.08A1.7 1.7 0 0 0 10.66 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06L6.6 16.98l.06-.06A1.7 1.7 0 0 0 7 15.04a1.7 1.7 0 0 0-1.56-1.04h-.08v-3h.08A1.7 1.7 0 0 0 7 9.96a1.7 1.7 0 0 0-.34-1.88L6.6 8.02 8.72 5.9l.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 11.7 4.74v-.08h3v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9.96 1.7 1.7 0 0 0 20.96 11h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z" /></>,
};

export function AppIcon({ name, className = "nav-icon" }: { name: AppIconName; className?: string }) {
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
