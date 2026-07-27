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
import {
  getRunnerContext,
  getHistoricalTrainingMemory,
  saveAthleteProfile,
  saveAthleteLocation,
  saveRecoveryLog,
  saveRunningGoal,
  saveWorkout,
} from "../../../lib/running-data";
import { fetchWeather, searchKnowledge, searchKnowledgeTool } from "../../../lib/agent-tools";
import { getRequestUser } from "../../../lib/request-user";

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

const persona = `# Trener Biegania AI — indywidualny trener i analityk treningu

## KIM JESTEM
Jestem osobistym trenerem biegania. Pomagam planować trening, analizować dane z Garmin Connect i Stravy oraz budować formę bez ignorowania regeneracji.
Pracuję na parametrach biegacza: wieku, masie ciała, płci, HRmax, progu mleczanowym, VO₂max, strefach tętna, kadencji, śnie, samopoczuciu i aktualnym celu.
Nie diagnozuję urazów ani chorób. Przy bólu, objawach alarmowych, problemach z sercem lub podejrzeniu zaburzeń odżywiania kieruję do lekarza albo fizjoterapeuty.

## JAK ODPOWIADAM

### Struktura każdej odpowiedzi:
1. 📋 **Kontekst** — potwierdzam cel albo odczytane dane (1 zdanie)
2. 🔍 **Analiza** — interpretuję obciążenie, intensywność i regenerację (maksymalnie 2 krótkie akapity)
3. ✅ **Następny krok** — konkretny trening lub działanie regeneracyjne (1–3 punkty)
4. ❓ **Pytanie** — tylko gdy brakuje danych potrzebnych do bezpiecznej rekomendacji

### Zasady:
- ZANIM odpowiem na złożone pytanie, pytam o kontekst, jeśli brakuje kluczowych danych.
- Gdy podaję fakty, oznaczam pewność: ✓ pewne, ~ przybliżone, ? do weryfikacji.
- **Pogrubiam** kluczowe terminy przy pierwszym użyciu.
- Używam list numerowanych dla kroków i punktowanych dla opcji.
- Maksymalnie 3 akapity + rekomendacja.
- Jestem wspierający, konkretny i rzeczowy. Nie zawstydzam ani nie oceniam sylwetki użytkownika.
- Gdy użytkownik napisze "podsumuj" lub "co ustaliliśmy", streszczam całą rozmowę w numerowanej liście.
- Pamiętam całą rozmowę od początku, bo dostaję historię wiadomości w żądaniu. Gdy użytkownik poda imię, używam go konsekwentnie.
- Przed zaproponowaniem nowego treningu zawsze sprawdzam aktualną datę, ostatni trening, ostatnią rozmowę i najnowszy wpis regeneracji. Jeśli brakuje danych potrzebnych do bezpiecznej propozycji, najpierw pytam o brakujące szczegóły.
- Nie zgaduję ani nie uzupełniam wartości, których użytkownik nie podał lub których nie widać jednoznacznie na screenie.
- Działam przez Google Gemini w @ai-sdk/google. Nie twierdzę, że jestem stworzony przez OpenAI.

### Styl:
- Język: polski
- Ton: profesjonalny, bezpośredni i wspierający, jak dobry trener biegowy
- Gdy używam terminu branżowego, wyjaśniam go w nawiasie.

## CZEGO NIE ROBIĘ
- Specjalizuję się w bieganiu, treningu wytrzymałościowym, regeneracji i przygotowaniu do startów. W innych dziedzinach odpowiadam ogólnie albo jasno zaznaczam ograniczenia.
- Nie udaję, że wiem coś, czego nie wiem.
- Nie udzielam porad prawnych, medycznych ani finansowych. Odsyłam do właściwego specjalisty.`;

const toolUsageRules = `## TOOL USAGE RULES
- Treat a multi-part request as one complete task and finish every requested part before the final answer.
- For current information, dates, schedules, prices, conditions, or anything the user asks you to find online, use google_search first.
- For a weather question, use ONLY getWeather with the requested city. Do not call currentDateTime, searchKnowledge, google_search, or readWebPage for the same weather question.
- After getWeather returns, write the final answer immediately. Do not call another tool unless the user explicitly asked for another independent task.
- After finding useful results, use readWebPage to verify official pages and details.
- When the user explicitly asks to generate an image, sketch, drawing, illustration, or visualization, use generateImage. Never use generateImage merely because the user attached a screenshot.
- When the user gives their name, call saveUserName before answering.
- When the user gives a durable preference, call saveUserPreference before answering.
- When the user says where they live or usually train, call saveAthleteLocation before answering. Use that location to assess terrain and, when relevant, fetch weather before proposing an outdoor workout.
- When the user gives a stable running-profile value, call saveUserPreference before answering. Use clear keys such as age, weight_kg, sex, hr_max, lactate_threshold_hr, vo2max, heart_rate_zones, cadence_spm, sleep_hours, weekly_availability, running_goal, goal_date, injury_limitations.
- For HRmax, VO₂max, cadence, threshold, body metrics, availability or limitations, also call saveAthleteProfile. For an explicitly stated goal call saveRunningGoal; for a completed workout call saveWorkout; for sleep or readiness call saveRecoveryLog. Do this after analyzing a screenshot whenever the value is clearly visible.
- If a newly read profile value differs from the saved value, never overwrite it silently. Only send observedOn when the screenshot/source itself shows an objective date. The save tool will update automatically only if that date is later than the saved observation date; otherwise ask the user whether to update and retry only after an explicit confirmation.
- Treat image attachments as training screenshots unless the user says otherwise. When several screenshots are attached, read and compare every one before answering. Extract only values you can see clearly, state uncertainty, and never invent missing metrics.
- For every attached training screenshot, before the final answer you MUST persist all clearly visible data: use saveAthleteProfile for profile metrics, saveWorkout for a completed activity with an objectively visible date, saveRecoveryLog for recovery data, and saveRunningGoal for an explicitly stated goal. If a required date or a conflicting value prevents saving, explain exactly what is missing or ask for confirmation. Report which records were saved.
- Do not claim that a workout, goal, or recovery entry was saved unless the corresponding save tool confirmed it.
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
Odpowiadaj luźniej i krócej. Zachowaj format 4 sekcji, ale każda sekcja ma być krótka.`,

  expert: `${persona}

## Tryb: EKSPERT
Odpowiadaj najbardziej merytorycznie. Dbaj o precyzję, oznaczaj pewność faktów i podawaj uporządkowane kroki. Nadal trzymaj limit długości.`,

  creative: `${persona}

## Tryb: KREATYWNY
Odpowiadaj obrazowo, z jedną lekką metaforą sportową lub miniopowieścią, ale nie trać konkretu. Format 4 sekcji zostaje.`,
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
    searchKnowledge: tool({
      description: "Wyszukuje informacje wyłącznie w prywatnej bazie wiedzy zalogowanego użytkownika.",
      inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false }),
      execute: async ({ query }) => searchKnowledge(query, userId),
    }),
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
    saveRunningGoal: tool({
      description: "Zapisuje opisowy, trwały cel biegacza. Użyj wyłącznie, gdy użytkownik wyraźnie poda cel albo potwierdzi jego zapis.",
      inputSchema: jsonSchema<{ title: string; description?: string; targetMetric?: string; targetValue?: number; targetUnit?: string; targetDate?: string }>({
        type: "object",
        properties: { title: { type: "string" }, description: { type: "string" }, targetMetric: { type: "string" }, targetValue: { type: "number" }, targetUnit: { type: "string" }, targetDate: { type: "string", description: "Data YYYY-MM-DD, tylko gdy użytkownik ją podał." } },
        required: ["title"],
        additionalProperties: false,
      }),
      execute: async (input) => {
        try {
          return await saveRunningGoal(userId, input);
        } catch {
          return { saved: false, error: "Nie udało się zapisać celu biegowego." };
        }
      },
    }),
    saveAthleteLocation: tool({
      description: "Zapisuje miejscowość lub okolicę zamieszkania biegacza, aby uwzględniać teren i pogodę. Użyj natychmiast, gdy użytkownik ją poda.",
      inputSchema: jsonSchema<{ homeLocation: string }>({ type: "object", properties: { homeLocation: { type: "string" } }, required: ["homeLocation"], additionalProperties: false }),
      execute: async ({ homeLocation }) => {
        try {
          return await saveAthleteLocation(userId, homeLocation);
        } catch {
          return { saved: false, error: "Nie udało się zapisać lokalizacji." };
        }
      },
    }),
    saveAthleteProfile: tool({
      description: "Zapisuje trwałe, ustrukturyzowane parametry biegacza (HRmax, VO2max, kadencję, próg, masę itd.). Przy wartości innej niż zapisana podaj observedOn WYŁĄCZNIE gdy jest jednoznaczna data na screenie/źródle; bez niej najpierw pytaj o zgodę. Ustaw confirmed=true tylko po wyraźnym potwierdzeniu użytkownika.",
      inputSchema: jsonSchema<{ birthYear?: number; sex?: "female" | "male" | "nonbinary" | "undisclosed"; weightKg?: number; heightCm?: number; hrMax?: number; lactateThresholdHr?: number; lactateThresholdPaceSeconds?: number; vo2max?: number; typicalCadenceSpm?: number; weeklyAvailability?: string; injuryLimitations?: string; notes?: string; observedOn?: string; confirmed?: boolean }>({
        type: "object",
        properties: { birthYear: { type: "number" }, sex: { type: "string" }, weightKg: { type: "number" }, heightCm: { type: "number" }, hrMax: { type: "number" }, lactateThresholdHr: { type: "number" }, lactateThresholdPaceSeconds: { type: "number" }, vo2max: { type: "number" }, typicalCadenceSpm: { type: "number" }, weeklyAvailability: { type: "string" }, injuryLimitations: { type: "string" }, notes: { type: "string" }, observedOn: { type: "string", description: "Obiektywna data YYYY-MM-DD widoczna w źródle, nigdy data czatu ani pliku." }, confirmed: { type: "boolean" } },
        additionalProperties: false,
      }),
      execute: async (input) => {
        try {
          return await saveAthleteProfile(userId, input);
        } catch {
          return { saved: false, error: "Nie udało się zapisać profilu biegacza." };
        }
      },
    }),
    saveWorkout: tool({
      description: "Zapisuje wykonany trening wyłącznie z danymi podanymi przez użytkownika lub wyraźnie widocznymi na screenie. Nie wpisuj wartości domyślnych ani wywnioskowanych.",
      inputSchema: jsonSchema<{ performedOn: string; summary: string; source: "garmin" | "strava" | "screenshot" | "chat" | "manual" | "other"; trainingType?: "easy" | "long" | "tempo" | "threshold" | "intervals" | "recovery" | "race" | "cross_training" | "other"; distanceM?: number; durationSeconds?: number; averagePaceSeconds?: number; averageHr?: number; maxHr?: number; averageCadenceSpm?: number; elevationGainM?: number; rpe?: number; unstructuredNotes?: string; extractionConfidence?: "user_reported" | "screen_verified" | "partial_screen" }>({
        type: "object",
        properties: { performedOn: { type: "string" }, summary: { type: "string" }, source: { type: "string" }, trainingType: { type: "string" }, distanceM: { type: "number" }, durationSeconds: { type: "number" }, averagePaceSeconds: { type: "number" }, averageHr: { type: "number" }, maxHr: { type: "number" }, averageCadenceSpm: { type: "number" }, elevationGainM: { type: "number" }, rpe: { type: "number" }, unstructuredNotes: { type: "string" }, extractionConfidence: { type: "string" } },
        required: ["performedOn", "summary", "source"],
        additionalProperties: false,
      }),
      execute: async (input) => {
        try {
          return await saveWorkout(userId, input);
        } catch {
          return { saved: false, error: "Nie udało się zapisać treningu." };
        }
      },
    }),
    saveRecoveryLog: tool({
      description: "Zapisuje regenerację na konkretny dzień. Użyj tylko dla wartości jawnie podanych przez użytkownika.",
      inputSchema: jsonSchema<{ loggedOn: string; sleepHours?: number; sleepQuality?: number; restingHr?: number; hrvMs?: number; fatigue?: number; soreness?: number; painDescription?: string; stress?: number; notes?: string }>({
        type: "object",
        properties: { loggedOn: { type: "string" }, sleepHours: { type: "number" }, sleepQuality: { type: "number" }, restingHr: { type: "number" }, hrvMs: { type: "number" }, fatigue: { type: "number" }, soreness: { type: "number" }, painDescription: { type: "string" }, stress: { type: "number" }, notes: { type: "string" } },
        required: ["loggedOn"],
        additionalProperties: false,
      }),
      execute: async (input) => {
        try {
          return await saveRecoveryLog(userId, input);
        } catch {
          return { saved: false, error: "Nie udało się zapisać regeneracji." };
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
    return `## PERSONALIZACJA BIEGACZA
To nowy biegacz, którego imienia jeszcze nie znasz. Przywitaj go krótko i zapytaj, jak masz się do niego zwracać. Następnie zbierz stopniowo: cel, aktualną objętość, doświadczenie, HRmax i ewentualne ograniczenia zdrowotne. Gdy poda imię, NATYCHMIAST użyj narzędzia saveUserName.`;
  }

  const preferences = Object.entries(profile.preferences)
    .slice(0, 20)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");

  return `## PERSONALIZACJA BIEGACZA
To stały biegacz: ${profile.name}. W nowej rozmowie przywitaj go po imieniu i zapytaj o aktualną dyspozycję lub ostatni trening. Zwracaj się po imieniu naturalnie, ale nie w każdym zdaniu. Zachowaj konkretny, wspierający ton trenera biegowego.${
    preferences
      ? ` Zapamiętane preferencje użytkownika: ${preferences}. Korzystaj z nich, gdy pasują do pytania.`
      : ""
  }`;
}

async function createTrainingContextPrompt(userId: string) {
  try {
    const context = await getRunnerContext(userId);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
    }).format(new Date());

    return `## AKTUALNY KONTEKST TRENINGOWY
Dzisiejsza data w Polsce: ${today}.
Poniższy stan pochodzi bezpośrednio z bazy i jest jedynym źródłem pamięci trwałej. Brak pola oznacza brak danych, a nie wartość domyślną.
${JSON.stringify(context)}

Przed rekomendacją nowego treningu porównaj datę z ostatnim treningiem i regeneracją. Jeśli nie ma świeżego recovery_logs, ostatni trening jest nieznany albo dane nie wystarczają do bezpiecznej decyzji, zadaj krótkie pytanie zamiast podawać plan. Po otrzymaniu potwierdzonego treningu, celu lub regeneracji użyj odpowiednio saveWorkout, saveRunningGoal lub saveRecoveryLog.`;
  } catch {
    return `## AKTUALNY KONTEKST TRENINGOWY
Dzisiejsza data w Polsce: ${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date())}.
Nie udało się odczytać bazy treningowej. Nie zakładaj żadnych wartości i poproś o dane potrzebne przed propozycją nowego treningu.`;
  }
}

function isProfileBackfillCommand(text: string) {
  return text.trim().toLowerCase().startsWith("/uzupelnij-profil");
}

async function createHistoricalBackfillPrompt(userId: string) {
  try {
    const history = await getHistoricalTrainingMemory(userId);
    return `## HISTORIA DO UZUPEŁNIENIA PROFILU
Użytkownik wywołał /uzupelnij-profil. Przejrzyj poniższą historię i zapisz przez narzędzia tylko dane jednoznacznie podane przez użytkownika albo wyraźnie oznaczone w odpowiedzi asystenta jako odczytane ze screena. Dla każdej znalezionej wartości MUSISZ użyć właściwego narzędzia zapisu; nie wystarczy jej wymienić w odpowiedzi.
Nie traktuj daty wiadomości jako daty treningu ani daty pomiaru. Nie zapisuj przypuszczeń, rekomendacji ani wartości przykładowych. Jeśli wartość koliduje z profilem, respektuj mechanizm potwierdzenia narzędzia. Na końcu podaj listę zapisanych rekordów i danych, których nie udało się zapisać.
${JSON.stringify(history)}`;
  } catch {
    return "## HISTORIA DO UZUPEŁNIENIA PROFILU\nNie udało się odczytać historii. Poinformuj użytkownika i zaproponuj ponowne przesłanie danych.";
  }
}

const businessCommandPrompt = `## KOMENDY TRENERA BIEGANIA
Jeśli ostatnia wiadomość zaczyna się od /trening, /podsumowanie albo /uzupelnij-profil, zwróć wyłącznie gotowy materiał w formacie tej komendy, bez wstępu i bez końcowego pytania.

## /trening
Służy do zapisania i krótkiej analizy wykonanego biegu. Jeśli użytkownik podaje dane ze screena, odczytaj tylko informacje pewne; brakujące oznacz jako „brak danych”.
Format: ## Trening, ## Dane, ## Ocena intensywności, ## Regeneracja, ## Następny krok.

## /podsumowanie
Służy do podsumowania tygodnia lub okresu treningowego.
Format: ## Okres, ## Obciążenie, ## Co działa, ## Ryzyka, ## Plan na kolejny tydzień.

## /uzupelnij-profil
Odczytuje historyczną korespondencję i zapisuje tylko pewne dane biegacza.
Format: ## Zapisane dane, ## Zapisane treningi, ## Konflikty wymagające potwierdzenia, ## Brakujące dane.

Zasady: nie wymyślaj pomiarów, nie zalecaj biegania przez ból ani „odrabiania” opuszczonych treningów. Przy braku danych o HRmax, progu lub ostatnich treningach poproś o nie poza formatem komendy.`;

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

  return normalized.startsWith("/trening") || normalized.startsWith("/podsumowanie") || normalized.startsWith("/uzupelnij-profil");
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
  forceToolUse = false,
}: {
  abortSignal?: AbortSignal;
  messages: ModelMessage[];
  model: string;
  requestId?: string;
  system: string;
  tools: ReturnType<typeof createChatTools>;
  forceToolUse?: boolean;
}) {
  const result = streamText({
    model: google(model),
    system: `${system}\n\n${toolUsageRules}\n${knowledgeRules}`,
    temperature: 0.3,
    abortSignal,
    messages,
    tools,
    toolChoice: forceToolUse ? "required" : "auto",
    // maxSteps: 3 (odpowiednik w AI SDK 7)
    stopWhen: isStepCount(6),
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

function attachImagesToLastUserMessage(
  messages: UIMessage[],
  images: RequestImage[] | undefined,
) {
  const validImages = (images ?? []).filter((image) => image?.dataUrl && image.mediaType).slice(0, 5);
  if (validImages.length === 0) {
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
    ...validImages.map((image) => ({
      type: "file" as const,
      mediaType: image.mediaType,
      filename: image.filename || "attached-image",
      url: image.dataUrl,
    })),
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
  forceToolUse,
}: {
  messages: ModelMessage[];
  requestId?: string;
  system: string;
  tools: ReturnType<typeof createChatTools>;
  forceToolUse?: boolean;
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
          forceToolUse,
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
            forceToolUse,
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
  forceToolUse,
}: {
  aiModel: AiModel;
  messages: ModelMessage[];
  requestId?: string;
  system: string;
  tools: ReturnType<typeof createChatTools>;
  forceToolUse?: boolean;
}) {
  if (aiModel === "pro") {
    return createModelResponse({
      messages,
      model: proModel,
      requestId,
      system,
      tools,
      forceToolUse,
    }).body;
  }

  return createFlashStreamWithFallback({ messages, requestId, system, tools, forceToolUse });
}

export async function POST(req: Request) {
  const requestLog = beginTechnicalRequest(req, "/api/chat");

  try {
    const {
      image,
      images,
      messages,
      mode,
      model,
      userId: _rawUserId,
    }: {
      image?: RequestImage;
      images?: RequestImage[];
      messages: UIMessage[];
      mode?: unknown;
      model?: unknown;
      userId?: unknown;
    } = await req.json();

    const authenticatedUser = await getRequestUser(req);
    if (!authenticatedUser) {
      return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
    }
    const selectedMode = getMode(mode);
    const selectedModel = getAiModel(model);
    const userId = authenticatedUser.id;
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

    const requestMessages = attachImagesToLastUserMessage(messages, images ?? (image ? [image] : []));
    const lastUserText = getLastUserText(requestMessages);
    const baseSystem = isBusinessCommand(lastUserText)
      ? `${systemPrompts[selectedMode]}\n\n${businessCommandPrompt}`
      : systemPrompts[selectedMode];
    const trainingContext = await createTrainingContextPrompt(userId);
    const historicalBackfill = isProfileBackfillCommand(lastUserText)
      ? `\n\n${await createHistoricalBackfillPrompt(userId)}`
      : "";
    const system = `${baseSystem}\n\n${createPersonalizationPrompt(profile)}\n\n${trainingContext}${historicalBackfill}`;
    const modelMessages = await convertToModelMessages(requestMessages, {
      tools: requestTools,
    });
    const stream = createSelectedModelStream({
      aiModel: selectedModel,
      messages: modelMessages,
      requestId: requestLog.requestId,
      system,
      tools: requestTools,
      forceToolUse: isProfileBackfillCommand(lastUserText) || (images?.length ?? (image ? 1 : 0)) > 0,
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
      imageAttached: images?.length ?? (image ? 1 : 0),
      messageSummary: summarizeMessages(requestMessages),
    });

    return response;
  } catch (error) {
    await requestLog.fail(error);
    throw error;
  }
}
