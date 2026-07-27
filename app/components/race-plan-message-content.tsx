"use client";

import type { UIMessage } from "ai";
import { MessageContent, getMessageText } from "./message-content";

type Race = {
  name: string;
  date: string;
  location: string;
  distancesKm: number[];
  officialUrl: string;
};

function readRaces(text: string) {
  const match = text.match(/<race-data>([\s\S]*?)<\/race-data>/i);
  if (!match) return [] as Race[];
  try {
    const data = JSON.parse(match[1]) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((race): race is Race => Boolean(
      race && typeof race === "object" && typeof (race as Race).name === "string"
      && typeof (race as Race).date === "string" && Array.isArray((race as Race).distancesKm)
      && typeof (race as Race).officialUrl === "string",
    ));
  } catch { return []; }
}

function formatDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

export function RacePlanMessageContent({ message, onSelectDistance }: { message: UIMessage; onSelectDistance: (race: Race, distanceKm: number) => void }) {
  const text = getMessageText(message);
  const races = readRaces(text);
  const visibleText = text.replace(/<race-data>[\s\S]*?<\/race-data>/ig, "").trim();
  const nonTextMessage = { ...message, parts: message.parts.filter((part) => part.type !== "text") };
  const sections = visibleText.split(/###\s+/g).filter((part) => part.trim());

  if (races.length > 0) return <div className="race-response"><section className="race-results" aria-label="Znalezione zawody">
      <div className="race-results-heading"><strong>Najbliższe biegi</strong><span>Wybierz dystans, aby ułożyć plan</span></div>
      <div className="race-card-grid">{races.map((race) => <article className="race-card" key={`${race.name}-${race.date}`}>
        <div><time>{formatDate(race.date)}</time><h3>{race.name}</h3><p>{race.location || "Lokalizacja na stronie organizatora"}</p></div>
        <div className="race-distances">{race.distancesKm.map((distance) => <button key={distance} onClick={() => onSelectDistance(race, distance)} type="button">{distance.toLocaleString("pl-PL")} km <span>Ułóż plan</span></button>)}</div>
        <a href={race.officialUrl} rel="noreferrer" target="_blank">Oficjalna strona ↗</a>
      </article>)}</div>
    </section></div>;

  return <div className="race-response">
    <MessageContent message={nonTextMessage} showTimeline />
    {sections.map((section, index) => {
      const [heading, ...body] = section.trim().split("\n");
      return <section className="race-plan-section" key={`${heading}-${index}`}><strong>{heading}</strong>{body.length > 0 && <p>{body.join("\n").trim()}</p>}</section>;
    })}
  </div>;
}
