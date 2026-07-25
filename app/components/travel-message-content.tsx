"use client";

import type { UIMessage } from "ai";
import { MessageContent, getMessageText } from "./message-content";

function cardClass(heading: string) {
  if (heading.includes("🌤")) return "travel-weather-card";
  if (heading.includes("💰")) return "travel-budget-card";
  if (heading.includes("📅")) return "travel-holiday-card";
  if (heading.includes("🏛")) return "travel-attractions-card";
  if (heading.includes("✅")) return "travel-checklist-card";
  return "travel-summary-card";
}

export function TravelMessageContent({ message }: { message: UIMessage }) {
  const text = getMessageText(message);
  const sections = text.split(/###\s+/g).filter((part) => part.trim());
  const nonTextMessage = {
    ...message,
    parts: message.parts.filter((part) => part.type !== "text"),
  };

  if (sections.length <= 1) {
    return <MessageContent message={message} showTimeline />;
  }

  return (
    <div className="travel-response">
      <MessageContent message={nonTextMessage} showTimeline />
      {sections.map((section, index) => {
        const [heading, ...body] = section.trim().split("\n");

        return (
          <section className={`travel-card ${cardClass(heading)}`} key={`${heading}-${index}`}>
            <strong>{heading}</strong>
            {body.length > 0 && <p>{body.join("\n").trim()}</p>}
          </section>
        );
      })}
    </div>
  );
}
