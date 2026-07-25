"use client";

import type { UIMessage } from "ai";

function getToolName(part: { type: string; toolName?: string }) {
  return part.type === "dynamic-tool"
    ? part.toolName || "tool"
    : part.type.replace("tool-", "");
}

function getToolEmoji(toolName: string) {
  const emojis: Record<string, string> = {
    calculator: "🧮",
    currentDateTime: "🕐",
    google_search: "🌐",
    readWebPage: "📄",
    generateImage: "🎨",
    getWeather: "🌤️",
    getExchangeRate: "💶",
    getHolidays: "📅",
    searchKnowledge: "📚",
    searchWikipedia: "📖",
    saveNote: "📝",
    getNotes: "🗂️",
  };

  return emojis[toolName] || "🛠";
}

function summarizeOutput(output: unknown) {
  if (typeof output === "string") {
    return output.slice(0, 180);
  }

  if (output && typeof output === "object") {
    const value = output as { image?: string; text?: string; result?: unknown };

    if (value.image) {
      return value.text || "wygenerowano obraz";
    }

    if (value.result !== undefined) {
      return String(value.result);
    }

    return JSON.stringify(output).slice(0, 180);
  }

  return "";
}

export function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function splitKnowledgeCitation(text: string) {
  const match = text.match(/\n?📎\s*Źródł(?:o|a):\s*([^\n]+)/i);

  if (!match || match.index === undefined) {
    return { body: text, citation: null };
  }

  return {
    body: text.slice(0, match.index).trimEnd(),
    citation: match[1].trim(),
  };
}

export function MessageContent({
  message,
  showTimeline = false,
}: {
  message: UIMessage;
  showTimeline?: boolean;
}) {
  const text = getMessageText(message);
  const { body, citation } = splitKnowledgeCitation(text);
  const sources = message.parts.filter((part) => part.type === "source-url");
  const toolParts = message.parts.filter(
    (part) => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
  ) as Array<{
    type: string;
    toolName?: string;
    state?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
    toolCallId: string;
  }>;
  const generatedImages = toolParts
    .map((part) => part.output)
    .filter(
      (output): output is { image: string; text?: string } =>
        !!output &&
        typeof output === "object" &&
        typeof (output as { image?: unknown }).image === "string",
    );

  return (
    <>
      {showTimeline && toolParts.length > 0 && (
        <div className="tool-timeline" aria-label="Timeline narzędzi">
          <strong>Agent wykonuje zadanie...</strong>
          {toolParts.map((part, index) => {
            const toolName = getToolName(part);

            return (
              <div className="tool-step" key={part.toolCallId}>
                <span>
                  {index + 1}. {getToolEmoji(toolName)} {toolName}
                </span>
                <small>
                  {part.state === "output-error"
                    ? part.errorText
                    : part.state === "output-available"
                      ? summarizeOutput(part.output)
                      : "w toku..."}
                </small>
              </div>
            );
          })}
        </div>
      )}

      {body}

      {citation && (
        <a className="knowledge-citation" href="/upload">
          <span aria-hidden="true">📄</span> Źródło: {citation}
        </a>
      )}

      {generatedImages.map((item, index) => (
        <div className="generated-inline-image" key={`${item.image}-${index}`}>
          <img alt="Wygenerowana grafika" src={item.image} />
          {item.text && <p>{item.text}</p>}
          <button
            onClick={() => {
              const link = document.createElement("a");
              link.href = item.image;
              link.download = "ai-generated.png";
              link.click();
            }}
            type="button"
          >
            💾 Pobierz
          </button>
        </div>
      ))}

      {sources.length > 0 && (
        <div className="source-list" aria-label="Źródła">
          <strong>Źródła</strong>
          {sources.map((source) => (
            <a
              href={source.url}
              key={source.sourceId}
              rel="noreferrer"
              target="_blank"
            >
              {source.title || source.url}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
