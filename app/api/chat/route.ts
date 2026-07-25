import { google } from "@ai-sdk/google";
import { generateAiImage } from "../../../lib/image-generation";
import {
  UI_MESSAGE_STREAM_HEADERS,
  convertToModelMessages,
  isStepCount,
  jsonSchema,
  streamText,
  tool,
  type ModelMessage,
  type UIMessage,
} from "ai";
import {
  beginTechnicalRequest,
  logTechnical,
  summarizeMessages,
} from "../../../lib/technical-logger";
import {
  ensureUserProfile,
  saveUserName,
  saveUserPreference,
  type UserProfile,
} from "../../../lib/user-profile";
import { fetchWeather, searchKnowledgeTool } from "../../../lib/agent-tools";

export const maxDuration = 90;

if (process.env.ENABLE_SEARCH_GROUNDING === "true") {
  console.warn(
    "⚠️ UWAGA: Search Grounding jest WŁĄCZONY. " +
      "To jest najdroższa funkcja API ($14/1000 zapytań). " +
      "Używaj TYLKO do testów. Wyłącz po testach usuwając ENABLE_SEARCH_GROUNDING z .env.local, " +
      "bo inni uczestnicy kursu mają wtedy ograniczony dostęp do modeli.",
  );
}

const flashModel = "gemini-3.1-flash-lite";
const flashFallbackModel = "gemini-3.1-flash-lite";
const proModel = "gemini-3.1-flash-lite";
const firstTextTimeoutMs = 30000;
const readWebPageTimeoutMs = 5000;
const maxWebPageTextLength = 3000;

const persona = `# Bosman Borys - ekspert żeglugi tradycyjnej i pracy pokładowej

## KIM JESTEM
Jestem ekspertem żeglugi tradycyjnej, pracy pokładowej i organizacji załogi z 35-letnim doświadczeniem w realiach żaglowców końca XIX wieku.
Specjalizuję się w takielunku (liny, żagle i osprzęt), bezpieczeństwie pokładowym oraz dyscyplinie pracy załogi.
Pracowałem z załogami handlowymi, uczniami szkół morskich, rekonstruktorami historycznymi i autorami tworzącymi realistyczne sceny morskie.

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** - potwierdzam zrozumienie pytania (1 zdanie)
2. 🔍 **Analiza** - merytoryczna odpowiedź (maksymalnie 2 krótkie akapity)
3. ✅ **Rekomendacja** - konkretne działanie do podjęcia (1-3 punkty)
4. ❓ **Pytanie** - jedno pytanie pogłębiające do użytkownika

### Zasady:
- ZANIM odpowiem na złożone pytanie, pytam o kontekst, jeśli brakuje kluczowych danych.
- Gdy podaję fakty, oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji.
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu.
- Używam list numerowanych dla kroków i punktowanych dla opcji.
- Maksymalnie 3 akapity + rekomendacja.
- Jestem oschły, konkretny i morski w tonie. Mogę użyć lekkiego portowego przekleństwa, ale bez obrażania użytkownika i bez slurów.
- Gdy użytkownik napisze "podsumuj" lub "co ustaliliśmy", streszczam całą rozmowę w numerowanej liście.
- Pamiętam całą rozmowę od początku, bo dostaję historię wiadomości w żądaniu. Gdy użytkownik poda imię, używam go konsekwentnie.
- Działam przez Google Gemini w @ai-sdk/google. Nie twierdzę, że jestem stworzony przez OpenAI.

### Styl:
- Język: polski
- Ton: profesjonalny, bezpośredni, oschły, z morskim charakterem
- Gdy używam terminu branżowego, wyjaśniam go w nawiasie.

## CZEGO NIE ROBIĘ
- Nie odpowiadam ekspercko na pytania spoza żeglugi, pracy pokładowej, historii morskiej, bezpieczeństwa na pokładzie, organizacji załogi i pisania realistycznych scen morskich. Mówię wprost, co mogę zrobić.
- Nie udaję, że wiem coś, czego nie wiem.
- Nie udzielam porad prawnych, medycznych ani finansowych. Odsyłam do właściwego specjalisty.`;

const toolUsageRules = `## TOOL USAGE RULES
- Treat a multi-part request as one complete task and finish every requested part before the final answer.
- For current information, dates, schedules, prices, conditions, or anything the user asks you to find online, use google_search first.
- For a weather question, use ONLY getWeather with the requested city. Do not call currentDateTime, searchKnowledge, google_search, or readWebPage for the same weather question.
- After getWeather returns, write the final answer immediately. Do not call another tool unless the user explicitly asked for another independent task.
- After finding useful results, use readWebPage to verify official pages and details.
- For an image, sketch, drawing, illustration, or visualization, always use generateImage. Do not claim that image generation is unavailable when the tool is available.
- When the user gives their name, call saveUserName before answering.
- When the user gives a durable preference, call saveUserPreference before answering.
- Before the final answer, check that every part of the user's request was completed. If a tool fails, try a sensible alternative and explain the limitation only at the end.`;

const knowledgeRules = `
## BAZA WIEDZY FIRMY
- Pytania o ceny, pakiety, oferty, regulamin, FAQ i firmowe usługi: najpierw zawsze użyj searchKnowledge.
- Nie używaj searchKnowledge do pytań o pogodę, kursy walut, Wikipedię ani innych pytań ogólnych.
- Odpowiadaj wyłącznie na podstawie znalezionych fragmentów; nie wymyślaj brakujących informacji.
- Gdy searchKnowledge zwróci 0 wyników albo najlepsze dopasowanie ma similarity poniżej 0.5, nie odpowiadaj z wiedzy ogólnej. Powiedz wprost: „Nie mam informacji na ten temat w mojej bazie wiedzy. Skontaktuj się z firmą bezpośrednio.”
- Po pojedynczym wywołaniu searchKnowledge napisz odpowiedź albo odmowę; nie powtarzaj tego samego wyszukiwania bez nowego pytania użytkownika.
- Odmowa dotyczy wyłącznie tematów firmowych. Pytania ogólne, np. o pogodę, kursy walut i Wikipedię, obsługuj odpowiednim narzędziem.

## CYTOWANIE ŹRÓDEŁ
- Gdy odpowiadasz na podstawie searchKnowledge, zawsze na samym końcu dodaj osobną linię: „📎 Źródło: [tytuł dokumentu]”.
- Jeżeli korzystasz z więcej niż jednego dokumentu, użyj: „📎 Źródła: [tytuł 1], [tytuł 2]”.
- Tytuły do cytowania bierz wyłącznie z pola source_documents lub metadata.source wyniku searchKnowledge.`;

const systemPrompts = {
  casual: `${persona}

## Tryb: CASUAL
Odpowiadaj luźniej, krócej i bardziej po bosmańsku. Zachowaj format 4 sekcji, ale każda sekcja ma być krótka, do diabła.`,

  expert: `${persona}

## Tryb: EKSPERT
Odpowiadaj najbardziej merytorycznie. Dbaj o precyzję, oznaczaj pewność faktów i podawaj uporządkowane kroki. Nadal trzymaj limit długości.`,

  creative: `${persona}

## Tryb: KREATYWNY
Odpowiadaj obrazowo, z jedną mocną metaforą morską lub miniopowieścią, ale nie trać konkretu. Format 4 sekcji zostaje.`,
} as const;

type ChatMode = keyof typeof systemPrompts;
type AiModel = "flash" | "pro";

type ReadWebPageInput = {
  url: string;
};

type CalculatorInput = {
  expression: string;
};

type GenerateImageInput = {
  prompt: string;
};

type WeatherInput = {
  city: string;
};

type RequestImage = {
  dataUrl: string;
  mediaType: string;
  filename?: string;
};

const chatTools = {
  searchKnowledge: searchKnowledgeTool,
  calculator: tool({
    description:
      "Wykonuje proste obliczenia arytmetyczne. Uzywaj do VAT, cen, procentow i dzialan matematycznych.",
    inputSchema: jsonSchema<CalculatorInput>({
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            "Wyrazenie matematyczne, np. 8500 * 0.23 albo 8500 + 1955.",
        },
      },
      required: ["expression"],
      additionalProperties: false,
    }),
    execute: async ({ expression }) => calculateExpression(expression),
  }),
  currentDateTime: tool({
    description:
      "Zwraca aktualna date i godzine w strefie Europe/Warsaw. Uzywaj do pytan o dzisiejsza date, godzine i aktualny kontekst czasu.",
    inputSchema: jsonSchema<Record<string, never>>({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () =>
      new Intl.DateTimeFormat("pl-PL", {
        dateStyle: "full",
        timeStyle: "medium",
        timeZone: "Europe/Warsaw",
      }).format(new Date()),
  }),
  getWeather: tool({
    description:
      "Sprawdza aktualną pogodę w podanym mieście. Używaj zawsze, gdy użytkownik pyta o pogodę.",
    inputSchema: jsonSchema<WeatherInput>({
      type: "object",
      properties: {
        city: {
          type: "string",
          description: "Nazwa miasta, np. Warszawa.",
        },
      },
      required: ["city"],
      additionalProperties: false,
    }),
    execute: async ({ city }) => fetchWeather(city),
  }),
  readWebPage: tool({
    description:
      "Pobiera i czyta zawartosc strony internetowej. Uzywaj gdy uzytkownik poda URL lub gdy chcesz przeczytac artykul/strone znaleziona w wyszukiwarce.",
    inputSchema: jsonSchema<ReadWebPageInput>({
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Pelny adres URL strony internetowej.",
        },
      },
      required: ["url"],
      additionalProperties: false,
    }),
    execute: async ({ url }) => readWebPage(url),
  }),
  generateImage: tool({
    description:
      "Generuje obraz na podstawie opisu. Uzywaj takze do szkicow, rysunkow, ilustracji i wizualizacji statkow, gdy uzytkownik prosi o obraz.",
    inputSchema: jsonSchema<GenerateImageInput>({
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Opis obrazu do wygenerowania.",
        },
      },
      required: ["prompt"],
      additionalProperties: false,
    }),
    execute: async ({ prompt }) => generateAiImage(prompt),
    toModelOutput: ({ output }) => ({
      type: "text",
      value: `Obraz zostal wygenerowany. ${output.text}`,
    }),
  }),
};

function createChatTools(userId: string | null) {
  const tools =
    process.env.ENABLE_SEARCH_GROUNDING === "true"
      ? { ...chatTools, google_search: google.tools.googleSearch({}) }
      : chatTools;

  if (!userId) {
    return tools;
  }

  return {
    ...tools,
    saveUserName: tool({
      description:
        "Zapisuje imię użytkownika w jego profilu. Użyj natychmiast, gdy użytkownik poda swoje imię.",
      inputSchema: jsonSchema<{ name: string }>({
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Imię użytkownika, bez dodatkowego komentarza.",
          },
        },
        required: ["name"],
        additionalProperties: false,
      }),
      execute: async ({ name }) => {
        try {
          return await saveUserName(userId, name);
        } catch {
          return { saved: false, error: "Nie udało się zapisać imienia." };
        }
      },
    }),
    saveUserPreference: tool({
      description:
        "Zapisuje trwałą preferencję użytkownika, np. ulubione_jedzenie=pizza albo miasto=Kraków.",
      inputSchema: jsonSchema<{ key: string; value: string }>({
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "Krótki klucz preferencji, np. miasto.",
          },
          value: {
            type: "string",
            description: "Wartość preferencji, np. Kraków.",
          },
        },
        required: ["key", "value"],
        additionalProperties: false,
      }),
      execute: async ({ key, value }) => {
        try {
          return await saveUserPreference(userId, key, value);
        } catch {
          return { saved: false, error: "Nie udało się zapisać preferencji." };
        }
      },
    }),
  };
}

function getUserId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  )
    ? value
    : null;
}

function createPersonalizationPrompt(profile: UserProfile | null) {
  if (!profile?.name) {
    return `## PERSONALIZACJA UŻYTKOWNIKA
To nowy użytkownik albo użytkownik, który nie podał jeszcze imienia. Na początku pierwszej rozmowy przywitaj się krótko i zapytaj, jak ma na imię. Gdy je poda, użyj narzędzia saveUserName.`;
  }

  const preferences = Object.entries(profile.preferences)
    .slice(0, 20)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return `## PERSONALIZACJA UŻYTKOWNIKA
Użytkownik ma na imię ${profile.name}. Przywitaj go po imieniu, zwracaj się do niego ciepło i personalnie. To stały użytkownik.${
    preferences
      ? ` Zapamiętane preferencje użytkownika: ${preferences}. Korzystaj z nich, gdy pasują do pytania.`
      : ""
  }`;
}

const businessCommandPrompt = `## NADRZĘDNA REGUŁA KOMEND BIZNESOWYCH
Jeśli ostatnia wiadomość użytkownika zaczyna się od /manewr albo /dziennik, ignorujesz standardowy format Kontekst/Analiza/Rekomendacja/Pytanie.
Zwracasz wyłącznie gotowy materiał w formacie komendy. Bez wstępu, bez komentarza, bez pytania końcowego.

## Styl komend
- Styl: koniec XIX wieku, profesjonalny bosman, morski, oschły, lekko wulgarny.
- Nie obrażaj użytkownika i nie używaj slurów.
- Jeśli użytkownik nie poda szczegółów, przyjmij rozsądne założenia i oznacz je jako szacowane.
- Pisz tak, jakby materiał miał od razu trafić do załogi albo dziennika pokładowego.

## Komenda: /manewr
Tworzy dokładną instrukcję wykonania manewru dla załogi.
Format odpowiedzi: ## Manewr, ## Cel, ## Rozkaz bosmana, ## Kroki dla załogi, ## Ryzyka, ## Kontrola po wykonaniu.

### Few-shot /manewr 1
User: /manewr zwrot przez sztag przy silnym wietrze
Agent:
## Manewr
Zwrot przez sztag przy silnym wietrze.
## Cel
Bezpiecznie przejść dziobem przez linię wiatru i ustawić żagle na nowym halsie.
## Rozkaz bosmana
Załoga do lin, oczy na żagle, żadnego pieprzonego chaosu. Na komendę luzować stary szot i wybierać nowy.
## Kroki dla załogi
1. Sternik przygotowuje kurs do zwrotu.
2. Obsługa foka luzuje stary szot po przejściu dziobu przez wiatr.
3. Druga strona wybiera nowy szot mocno i równo.
4. Załoga sprawdza, czy żagle pracują czysto.
## Ryzyka
- Utrata prędkości i utknięcie w linii wiatru.
- Splątane szoty.
- Zbyt późne wybranie nowego szotu.
## Kontrola po wykonaniu
Sprawdzić kurs, napięcie szotów i pracę żagli. Jeśli fok łopocze, poprawić natychmiast.

### Few-shot /manewr 2
User: /manewr cumowanie w ciasnym porcie przy bocznym wietrze
Agent:
## Manewr
Cumowanie w ciasnym porcie przy bocznym wietrze.
## Cel
Dobić do nabrzeża bez obicia burty i bez robienia widowiska dla całego portu.
## Rozkaz bosmana
Odbijacze za burtę, cumy w dłonie, nikt nie stoi jak słup. Wiatr będzie spychał kadłub, więc działać szybko i bez gadania.
## Kroki dla załogi
1. Przygotować cumę dziobową, rufową i szpring.
2. Wystawić odbijacze po stronie nabrzeża.
3. Najpierw podać szpring, żeby zatrzymać dryf.
4. Dociągnąć dziób i rufę, potem wybrać luz.
## Ryzyka
- Zepchnięcie statku na sąsiednią jednostkę.
- Przytrzaśnięcie dłoni cumą.
- Za późne podanie szpringu.
## Kontrola po wykonaniu
Sprawdzić napięcie cum, pozycję odbijaczy i odstęp od nabrzeża. Jak coś trze, poprawić od razu, do cholery.

## Komenda: /dziennik
Tworzy zapis do dziennika pokładowego w stylu końca XIX wieku.
Format odpowiedzi: ## Data i wachta, ## Pozycja / kurs, ## Warunki, ## Zdarzenie, ## Decyzja bosmana, ## Wpis do dziennika.

### Few-shot /dziennik 1
User: /dziennik nocny sztorm, uszkodzony fok, załoga zmęczona
Agent:
## Data i wachta
14 listopada 1892 r., wachta nocna, godz. 00:00-04:00.
## Pozycja / kurs
Pozycja szacowana: 49°12'N, 006°35'W. Kurs: WSW, utrzymywany z trudem pod silny wiatr.
## Warunki
Silny sztorm, wysoka fala, widoczność marna. Pokład mokry i śliski jak przeklęta rybia łuska.
## Zdarzenie
Fok został uszkodzony podczas gwałtownego szkwału. Załoga zmęczona, lecz zdolna do pracy.
## Decyzja bosmana
Zredukować żagle, zabezpieczyć uszkodzony fok i wystawić dodatkową obserwację przy dziobie.
## Wpis do dziennika
Podczas wachty nocnej statek wszedł w silny sztorm. Fok doznał uszkodzenia na skutek nagłego uderzenia wiatru. Załoga, choć wyczerpana, wykonała rozkaz zabezpieczenia żagla. Kurs WSW utrzymano z trudem. Strat w ludziach brak. Morze parszywe, ale statek trzyma się dzielnie.

### Few-shot /dziennik 2
User: /dziennik spokojny poranek, naprawiono takielunek, załoga w dobrym stanie
Agent:
## Data i wachta
3 czerwca 1894 r., wachta poranna, godz. 04:00-08:00.
## Pozycja / kurs
Pozycja obserwowana: 46°48'N, 012°10'W. Kurs: NE, prędkość około 6 węzłów.
## Warunki
Morze łagodne, wiatr umiarkowany z zachodu, widoczność dobra.
## Zdarzenie
Naprawiono elementy takielunku uszkodzone poprzedniego dnia. Załoga w dobrym stanie.
## Decyzja bosmana
Utrzymać kurs NE, sprawdzić ponownie mocowania lin przed kolejną wachtą.
## Wpis do dziennika
Poranek spokojny, morze łaskawe jak rzadko. Załoga przystąpiła do naprawy takielunku i wykonała robotę bez zbędnego marudzenia. Liny sprawdzone, mocowania poprawione, żagle pracują czysto. Stan ludzi dobry. Oby tak dalej, choć morzu ufa tylko głupiec.`;

function getMode(mode: unknown): ChatMode {
  return mode === "expert" || mode === "creative" || mode === "casual"
    ? mode
    : "casual";
}

function getAiModel(model: unknown): AiModel {
  return model === "pro" ? "pro" : "flash";
}

function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

function getLastUserText(messages: UIMessage[]) {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  return lastUserMessage ? getMessageText(lastUserMessage) : "";
}

function isBusinessCommand(text: string) {
  const normalized = text.trim().toLowerCase();

  return normalized.startsWith("/manewr") || normalized.startsWith("/dziennik");
}

function calculateExpression(expression: string) {
  const normalized = expression.replaceAll(",", ".");

  if (!/^[\d\s+\-*/().%]+$/.test(normalized)) {
    return "Dozwolone sa tylko liczby i operatory: + - * / ( ) . %";
  }

  try {
    const result = Function(`"use strict"; return (${normalized});`)();

    if (typeof result !== "number" || !Number.isFinite(result)) {
      return "Wynik nie jest poprawna liczba.";
    }

    return {
      expression,
      result,
    };
  } catch {
    return "Nie udalo sie obliczyc wyrazenia.";
  }
}

function decodeHtmlEntities(text: string) {
  return text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code)),
    );
}

function extractReadableText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, maxWebPageTextLength);
}

async function readWebPage(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return `Nieprawidlowy adres URL: ${url}`;
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return "Mozna czytac tylko strony HTTP i HTTPS.";
  }

  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    readWebPageTimeoutMs,
  );

  try {
    const response = await fetch(parsedUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; MojAgent/1.0; +https://localhost)",
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      return `Nie udalo sie pobrac strony. HTTP ${response.status} ${response.statusText}.`;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      return `Strona nie wyglada na HTML. Content-Type: ${contentType || "brak"}.`;
    }

    const text = extractReadableText(await response.text());

    return text || "Pobrano strone, ale nie udalo sie wyciagnac czytelnego tekstu.";
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return "Nie udalo sie pobrac strony: timeout po 5 sekundach.";
    }

    return `Nie udalo sie pobrac strony: ${
      error instanceof Error ? error.message : "nieznany blad"
    }.`;
  } finally {
    clearTimeout(timeout);
  }
}

function createModelResponse({
  abortSignal,
  messages,
  model,
  system,
  tools,
  requestId,
}: {
  abortSignal?: AbortSignal;
  messages: ModelMessage[];
  model: string;
  requestId?: string;
  system: string;
  tools: ReturnType<typeof createChatTools>;
}) {
  const result = streamText({
    model: google(model),
    system: `${system}\n\n${toolUsageRules}\n${knowledgeRules}`,
    temperature: 0.3,
    abortSignal,
    messages,
    tools,
    // maxSteps: 3 (odpowiednik w AI SDK 7)
    stopWhen: isStepCount(3),
    onStepEnd: ({ stepNumber, toolCalls, toolResults }) => {
      void logTechnical("INFO", "ai.step.finished", {
        route: "/api/chat",
        requestId,
        model,
        stepNumber,
        toolNames: toolCalls.map((toolCall) => toolCall.toolName),
        toolCount: toolCalls.length,
        resultCount: toolResults.length,
      });
    },
    onToolExecutionStart: ({ toolCall }) => {
      void logTechnical("INFO", "ai.tool.started", {
        route: "/api/chat",
        requestId,
        model,
        toolName: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
      });
    },
    onToolExecutionEnd: ({ toolCall, toolExecutionMs, toolOutput }) => {
      void logTechnical("INFO", "ai.tool.finished", {
        route: "/api/chat",
        requestId,
        model,
        toolName: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        durationMs: toolExecutionMs,
        outputType: toolOutput.type,
      });
    },
    onError: ({ error }) => {
      void logTechnical("ERROR", "ai.stream.error", {
        route: "/api/chat",
        requestId,
        model,
        error,
      });
    },
    onFinish: ({ finishReason, usage }) => {
      void logTechnical("INFO", "ai.stream.finished", {
        route: "/api/chat",
        requestId,
        model,
        finishReason,
        usage,
      });
    },
  });

  return result.toUIMessageStreamResponse({ sendSources: true });
}

function attachImageToLastUserMessage(
  messages: UIMessage[],
  image: RequestImage | undefined,
) {
  if (!image?.dataUrl || !image.mediaType) {
    return messages;
  }

  const nextMessages = structuredClone(messages) as UIMessage[];
  const lastUserMessage = [...nextMessages]
    .reverse()
    .find((message) => message.role === "user");

  if (!lastUserMessage) {
    return nextMessages;
  }

  lastUserMessage.parts = [
    {
      type: "file",
      mediaType: image.mediaType,
      filename: image.filename || "attached-image",
      url: image.dataUrl,
    },
    ...lastUserMessage.parts,
  ];

  return nextMessages;
}

function readWithTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
) {
  return new Promise<ReadableStreamReadResult<Uint8Array>>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Primary flash model did not produce text in time."));
      }, timeoutMs);

      reader.read().then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    },
  );
}

async function pipeReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      return;
    }

    controller.enqueue(value);
  }
}

async function pipeResponse(
  response: Response,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Model response body is empty.");
  }

  await pipeReader(reader, controller);
}

function hasPrimaryProgress(streamText: string) {
  return [
    '"type":"text-delta"',
    '"type":"reasoning-delta"',
    '"type":"tool-input-start"',
    '"type":"tool-input-delta"',
    '"type":"tool-input-available"',
    '"type":"tool-output-available"',
    '"type":"source-url"',
  ].some((marker) => streamText.includes(marker));
}

function createFlashStreamWithFallback({
  messages,
  requestId,
  system,
  tools,
}: {
  messages: ModelMessage[];
  requestId?: string;
  system: string;
  tools: ReturnType<typeof createChatTools>;
}) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const primaryAbortController = new AbortController();
      const decoder = new TextDecoder();
      const bufferedChunks: Uint8Array[] = [];
      let bufferedText = "";
      let primaryStarted = false;

      try {
        const primaryResponse = createModelResponse({
          abortSignal: primaryAbortController.signal,
          messages,
          model: flashModel,
          requestId,
          system,
          tools,
        });
        const primaryReader = primaryResponse.body?.getReader();

        if (!primaryReader) {
          throw new Error("Primary flash model response body is empty.");
        }

        const deadline = Date.now() + firstTextTimeoutMs;

        while (!primaryStarted) {
          const remainingMs = deadline - Date.now();

          if (remainingMs <= 0) {
            throw new Error("Primary flash model did not produce text in time.");
          }

          const { done, value } = await readWithTimeout(
            primaryReader,
            remainingMs,
          );

          if (done) {
            throw new Error("Primary flash model stream ended before text.");
          }

          bufferedChunks.push(value);
          bufferedText += decoder.decode(value, { stream: true });

          if (bufferedText.includes('"type":"error"')) {
            throw new Error("Primary flash model returned an error.");
          }

          if (hasPrimaryProgress(bufferedText)) {
            primaryStarted = true;

            for (const chunk of bufferedChunks) {
              controller.enqueue(chunk);
            }

            await pipeReader(primaryReader, controller);
          }
        }
      } catch (error) {
        void logTechnical("WARN", "ai.primary.failed_using_fallback", {
          route: "/api/chat",
          requestId,
          primaryModel: flashModel,
          fallbackModel: flashFallbackModel,
          error,
        });

        if (primaryStarted) {
          throw new Error("Primary flash model stream failed after it started.");
        }

        primaryAbortController.abort();

        try {
          const fallbackResponse = createModelResponse({
            messages,
            model: flashFallbackModel,
            requestId,
            system,
            tools,
          });

          await pipeResponse(fallbackResponse, controller);
          void logTechnical("INFO", "ai.fallback.completed", {
            route: "/api/chat",
            requestId,
            model: flashFallbackModel,
          });
        } catch (fallbackError) {
          void logTechnical("ERROR", "ai.fallback.failed", {
            route: "/api/chat",
            requestId,
            model: flashFallbackModel,
            error: fallbackError,
          });
          throw fallbackError;
        }
      } finally {
        controller.close();
      }
    },
  });
}

function createSelectedModelStream({
  aiModel,
  messages,
  requestId,
  system,
  tools,
}: {
  aiModel: AiModel;
  messages: ModelMessage[];
  requestId?: string;
  system: string;
  tools: ReturnType<typeof createChatTools>;
}) {
  if (aiModel === "pro") {
    return createModelResponse({
      messages,
      model: proModel,
      requestId,
      system,
      tools,
    }).body;
  }

  return createFlashStreamWithFallback({ messages, requestId, system, tools });
}

export async function POST(req: Request) {
  const requestLog = beginTechnicalRequest(req, "/api/chat");

  try {
    const {
      image,
      messages,
      mode,
      model,
      userId: rawUserId,
    }: {
      image?: RequestImage;
      messages: UIMessage[];
      mode?: unknown;
      model?: unknown;
      userId?: unknown;
    } = await req.json();

    const selectedMode = getMode(mode);
    const selectedModel = getAiModel(model);
    const userId = getUserId(rawUserId);
    const requestTools = createChatTools(userId);
    let profile: UserProfile | null = null;

    if (userId) {
      try {
        profile = await ensureUserProfile(userId);
      } catch (profileError) {
        void logTechnical("WARN", "user.profile.load.failed", {
          route: "/api/chat",
          requestId: requestLog.requestId,
          error: profileError,
        });
      }
    }

    const requestMessages = attachImageToLastUserMessage(messages, image);
    const lastUserText = getLastUserText(requestMessages);
    const baseSystem = isBusinessCommand(lastUserText)
      ? `${systemPrompts[selectedMode]}\n\n${businessCommandPrompt}`
      : systemPrompts[selectedMode];
    const system = `${baseSystem}\n\n${createPersonalizationPrompt(profile)}`;
    const modelMessages = await convertToModelMessages(requestMessages, {
      tools: requestTools,
    });
    const stream = createSelectedModelStream({
      aiModel: selectedModel,
      messages: modelMessages,
      requestId: requestLog.requestId,
      system,
      tools: requestTools,
    });

    if (!stream) {
      throw new Error("Selected model response body is empty.");
    }

    const response = new Response(stream, {
      headers: {
        ...UI_MESSAGE_STREAM_HEADERS,
        "x-request-id": requestLog.requestId,
      },
    });

    void requestLog.finish(200, {
      model: selectedModel,
      mode: selectedMode,
      imageAttached: Boolean(image),
      messageSummary: summarizeMessages(requestMessages),
    });

    return response;
  } catch (error) {
    await requestLog.fail(error);
    throw error;
  }
}
