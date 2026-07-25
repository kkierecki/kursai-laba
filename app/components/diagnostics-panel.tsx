"use client";

import type { UIMessage } from "ai";

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
};

function toolName(part: ToolPart) {
  return part.type === "dynamic-tool"
    ? part.toolName || "tool"
    : part.type.replace("tool-", "");
}

function errorMessage(part: ToolPart) {
  if (part.state === "output-error") return part.errorText || "Błąd narzędzia";
  if (part.output && typeof part.output === "object" && "error" in part.output) {
    return String((part.output as { error: unknown }).error);
  }
  return null;
}

export function DiagnosticsPanel({
  duration,
  isLoading,
  messages,
  maxSteps = 5,
}: {
  duration: number | null;
  isLoading: boolean;
  messages: UIMessage[];
  maxSteps?: number;
}) {
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const parts = (lastAssistant?.parts.filter(
    (part) => part.type === "dynamic-tool" || part.type.startsWith("tool-"),
  ) ?? []) as ToolPart[];
  const counts = parts.reduce<Record<string, number>>((result, part) => {
    const name = toolName(part);
    result[name] = (result[name] ?? 0) + 1;
    return result;
  }, {});
  const errors = parts
    .map((part) => ({ name: toolName(part), input: part.input, message: errorMessage(part) }))
    .filter((item): item is { name: string; input: unknown; message: string } => Boolean(item.message));
  const stepCount = Math.min(parts.length, maxSteps);
  const progressClass = stepCount >= maxSteps ? "danger" : stepCount === 4 ? "warning" : "safe";
  const status = isLoading
    ? "W trakcie..."
    : parts.length >= maxSteps
      ? "⚠️ Limit kroków"
      : lastAssistant
        ? "✅ Zadanie ukończone"
        : "Gotowy";

  return (
    <aside className="diagnostics-panel" aria-label="Diagnostyka">
      <h2>🛡️ Diagnostyka</h2>
      <div className="diagnostics-progress-row">
        <span>Kroki</span>
        <strong>{stepCount}/{maxSteps}</strong>
      </div>
      <progress className={progressClass} max={maxSteps} value={stepCount} />
      <dl>
        <div><dt>Narzędzia</dt><dd>{Object.entries(counts).map(([name, count]) => `${name}(${count})`).join(", ") || "brak"}</dd></div>
        <div><dt>Błędy</dt><dd>{errors.length}</dd></div>
        <div><dt>Czas</dt><dd>{duration === null ? (isLoading ? "pomiar..." : "—") : `${duration.toFixed(1)}s`}</dd></div>
        <div><dt>Status</dt><dd>{status}</dd></div>
      </dl>
      {errors.map((item, index) => (
        <div className="diagnostic-alert" key={`${item.name}-${index}`}>
          🔴 {item.name}({JSON.stringify(item.input)}) — {item.message}
        </div>
      ))}
    </aside>
  );
}
