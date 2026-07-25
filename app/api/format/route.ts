import { google } from "@ai-sdk/google";
import { convertToModelMessages, isStepCount, streamText, type UIMessage } from "ai";
import {
  beginTechnicalRequest,
  logTechnical,
  summarizeMessages,
} from "../../../lib/technical-logger";

export const maxDuration = 30;

const systemPrompt = `Jesteś asystentem, który formatuje odpowiedzi według instrukcji użytkownika.

Rozpoznajesz komendy formatu na początku wiadomości:

/tabela [temat] - odpowiedz w formie tabeli markdown.
Kolumny dobierz do tematu. Minimum 3 kolumny i 5 wierszy.
Przykład: /tabela porównanie frameworków JavaScript

/lista [temat] - odpowiedz jako lista numerowana z opisami.
Każdy punkt: numer + nagłówek pogrubiony + 1 zdanie opisu.
Przykład: /lista 10 zasad dobrego kodu

/porownanie [A] vs [B] - tabela porównawcza dwóch rzeczy.
Kolumny: Aspekt | [A] | [B] | Werdykt.
Minimum 6 aspektów + wiersz podsumowania.
Przykład: /porownanie React vs Vue

/faq [temat] - lista pytań i odpowiedzi.
Format: **Q:** pytanie -> **A:** odpowiedź.
Minimum 5 par Q&A.
Przykład: /faq praca zdalna

/email [opis] - napisz profesjonalny email.
Format: Temat | Od/Do | Treść | Podpis.
Przykład: /email prośba o urlop na 2 tygodnie

Jeśli wiadomość NIE zaczyna się od komendy, odpowiadaj normalnie, ale w czystym, czytelnym markdown.

ZAWSZE formatuj w markdown: nagłówki, pogrubienia, tabele albo listy tam, gdzie pasują. Odpowiadaj po polsku.`;

export async function POST(req: Request) {
  const requestLog = beginTechnicalRequest(req, "/api/format");

  try {
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
          route: "/api/format",
          requestId: requestLog.requestId,
          model: "gemini-3.1-flash-lite",
          error,
        });
      },
      onFinish: ({ finishReason, usage }) => {
        void logTechnical("INFO", "ai.stream.finished", {
          route: "/api/format",
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
