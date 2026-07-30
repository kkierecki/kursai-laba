import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import {
  beginTechnicalRequest,
  logTechnical,
  summarizeMessages,
} from "../../../lib/technical-logger";
import { getLlmRequestContext, recordApiUsage } from "../../../lib/api-usage";

export const maxDuration = 30;

const systemPrompt = `Jesteś analitykiem treningowym osobistego trenera biegania. Twoim zadaniem jest pokazać użytkownikowi zwięzłe, jawne uzasadnienie rekomendacji przed odpowiedzią.

Nie ujawniaj prywatnego, ukrytego scratchpada modelu. Zamiast tego pokaż krótkie, użyteczne uzasadnienie, obliczenia i decyzje w uporządkowanej formie.

Gdy dostajesz pytanie, przejdź przez te kroki:

### 🧠 MYŚLĘ...

**Krok 1 — Zrozumienie:**
Co dokładnie użytkownik pyta? Przeformułuj pytanie swoimi słowami.

**Krok 2 — Fakty:**
Co wiadomo z pytania? Co jest pewne, a co wymaga założenia albo sprawdzenia?

**Krok 3 — Analiza:**
Pokaż krótkie obliczenia, porównanie albo 2-3 możliwe podejścia.

**Krok 4 — Ocena:**
Które podejście jest najlepsze i dlaczego?

### ✅ ODPOWIEDŹ
Podaj finalną, konkretną odpowiedź na podstawie analizy powyżej.

WAŻNE:
- Zawsze pokaż widoczne kroki: Zrozumienie -> Fakty -> Analiza -> Ocena -> Odpowiedź.
- Używaj nagłówków markdown.
- Sekcja "MYŚLĘ..." powinna być dłuższa niż finalna odpowiedź.
- Odpowiadaj po polsku.
- Zachowaj wspierający, konkretny styl trenera biegowego, ale priorytetem jest poprawna analiza.`;

export async function POST(req: Request) {
  const requestLog = beginTechnicalRequest(req, "/api/think");

  try {
    const usageContext = await getLlmRequestContext(req);
    if ("error" in usageContext) return usageContext.error;
    const { messages }: { messages: UIMessage[] } = await req.json();
    const result = streamText({
      model: google("gemini-3.1-flash-lite"),
      system: systemPrompt,
      temperature: 0.2,
      messages: await convertToModelMessages(messages),
      // maxSteps: 3 (odpowiednik w AI SDK 7)
      stopWhen: isStepCount(3),
      onError: ({ error }) => {
        void logTechnical("ERROR", "ai.stream.error", {
          route: "/api/think",
          requestId: requestLog.requestId,
          model: "gemini-3.1-flash-lite",
          error,
        });
      },
      onFinish: ({ finishReason, usage }) => {
        void recordApiUsage(usageContext.database, usageContext.user.id, usage, "gemini-3.1-flash-lite", "/api/think").catch((error) =>
          logTechnical("ERROR", "api-usage.write.failed", { route: "/api/think", requestId: requestLog.requestId, error }),
        );
        void logTechnical("INFO", "ai.stream.finished", {
          route: "/api/think",
          requestId: requestLog.requestId,
          model: "gemini-3.1-flash-lite",
          finishReason,
          usage,
        });
      },
    });

    const response = result.toUIMessageStreamResponse();
    void requestLog.finish(200, {
      model: "gemini-3.1-flash-lite",
      messageSummary: summarizeMessages(messages),
    });
    return response;
  } catch (error) {
    await requestLog.fail(error);
    throw error;
  }
}
