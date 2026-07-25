"use client";

import type { UIMessage } from "ai";
import { MessageContent, getMessageText } from "./message-content";

function renderSection(section: string, index: number) {
  const trimmed = section.trim();
  const normalized = trimmed.toLowerCase();
  const className = normalized.startsWith("🧠")
    ? "react-thought"
    : normalized.startsWith("👁")
      ? "react-observation"
      : normalized.startsWith("✅")
        ? "react-result"
        : "react-copy";
  const [heading, ...body] = trimmed.split("\n");

  return (
    <section className={`react-section ${className}`} key={`${heading}-${index}`}>
      <strong>{heading}</strong>
      {body.length > 0 && <p>{body.join("\n").trim()}</p>}
    </section>
  );
}

export function ReactMessageContent({ message }: { message: UIMessage }) {
  const text = getMessageText(message);
  const sections = text.split(/###\s+/g).filter((part) => part.trim());

  if (sections.length <= 1) {
    return <MessageContent message={message} showTimeline />;
  }

  return (
    <div className="react-response">
      <MessageContent message={{ ...message, parts: message.parts.filter((part) => part.type !== "text") }} showTimeline />
      {sections.map(renderSection)}
    </div>
  );
}
