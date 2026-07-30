import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import {
  beginTechnicalRequest,
  logTechnical,
  summarizeMessages,
} from "../../../lib/technical-logger";
import { getLlmRequestContext, recordApiUsage } from "../../../lib/api-usage";

export const maxDuration = 30;

const systemPrompt = `Jesteś asystentem, który odpowiada w DOKŁADNIE takim formacie jak w przykładach poniżej.

## PRZYKŁADY

Użytkownik: "Czym jest API?"
Asystent:
📖 **API (Application Programming Interface)**
Prosty opis: To "kelner" w restauracji - pośrednik między tobą a kuchnią.
⚙ W praktyce: Gdy Allegro pokazuje status paczki InPost, pobiera dane przez API z systemu InPost.
🔗 Powiązane: REST, endpoint, JSON, HTTP

Użytkownik: "Czym jest B2B?"
Asystent:
📖 **B2B (Business-to-Business)**
Prosty opis: To umowa między Twoją firmą a firmą klienta - jak dwóch rzemieślników na targu, a nie sklep i klient.
⚙ W praktyce: Programista zakłada JDG i wystawia fakturę VAT zamiast mieć umowę o pracę.
🔗 Powiązane: JDG, faktura VAT, ZUS, umowa o pracę

## ZASADY
- ZAWSZE odpowiadaj w DOKŁADNIE tym formacie: 📖 termin -> prosty opis z analogią -> ⚙ praktyczny przykład -> 🔗 powiązane terminy.
- Analogie powinny być z codziennego życia: restauracja, mieszkanie, samochód, sklep, szkoła albo urząd.
- Odpowiedź ma mieć maksymalnie 6 linii.
- Jeśli pytanie NIE jest o definicję lub termin, odpowiedz normalnie, ale zwięźle.
- Odpowiadaj po polsku.`;

export async function POST(req: Request) {
  const requestLog = beginTechnicalRequest(req, "/api/fewshot");

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
          route: "/api/fewshot",
          requestId: requestLog.requestId,
          model: "gemini-3.1-flash-lite",
          error,
        });
      },
      onFinish: ({ finishReason, usage }) => {
        void recordApiUsage(usageContext.database, usageContext.user.id, usage, "gemini-3.1-flash-lite", "/api/fewshot").catch((error) =>
          logTechnical("ERROR", "api-usage.write.failed", { route: "/api/fewshot", requestId: requestLog.requestId, error }),
        );
        void logTechnical("INFO", "ai.stream.finished", {
          route: "/api/fewshot",
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
