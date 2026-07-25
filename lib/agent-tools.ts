import { jsonSchema, tool } from "ai";
import { logTechnical } from "./technical-logger";
import { supabase } from "./supabase";

const notesStore = new Map<
  string,
  { title: string; content: string; createdAt: string }
>();

const externalApiTimeoutMs = 5000;

function externalEndpoint(input: string | URL) {
  try {
    const url = input instanceof URL ? input : new URL(input);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(input).slice(0, 300);
  }
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), externalApiTimeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });

    if (!response.ok) {
      void logTechnical("WARN", "external.http.error", {
        endpoint: externalEndpoint(input),
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  } catch (error) {
    void logTechnical("ERROR", "external.fetch.error", {
      endpoint: externalEndpoint(input),
      error,
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function connectionError(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return { error: "Timeout — serwer nie odpowiedział w 5 sekund. Spróbuj ponownie." };
  }

  return {
    error: `Błąd połączenia: ${
      error instanceof Error ? error.message : "nieznany błąd"
    }`,
  };
}

const weatherDescriptions: Record<number, string> = {
  0: "bezchmurnie",
  1: "przeważnie bezchmurnie",
  2: "częściowe zachmurzenie",
  3: "pochmurno",
  45: "mgła",
  48: "mgła osadzająca szadź",
  51: "lekka mżawka",
  53: "mżawka",
  55: "intensywna mżawka",
  61: "lekki deszcz",
  63: "deszcz",
  65: "intensywny deszcz",
  71: "lekki śnieg",
  73: "śnieg",
  75: "intensywny śnieg",
  80: "przelotny deszcz",
  81: "przelotny deszcz",
  82: "gwałtowne opady",
  95: "burza",
};

type JsonObject = Record<string, unknown>;

export function calculate(expression: string) {
  const normalized = expression.replaceAll(",", ".").trim();
  const blocked = /\b(import|require|eval|process|fetch)\b/i;

  if (blocked.test(normalized) || !/^[\d\s+\-*/().%]+$/.test(normalized)) {
    return { error: "Wyrażenie zawiera niedozwolone znaki" };
  }

  try {
    const result = Function(`"use strict"; return (${normalized});`)();

    if (typeof result !== "number" || !Number.isFinite(result)) {
      return { error: `Nie mogę obliczyć: ${expression}` };
    }

    return { expression, result };
  } catch {
    return { error: `Nie mogę obliczyć: ${expression}` };
  }
}

export function getCurrentDateTime() {
  const now = new Date();

  return {
    dateTime: now.toLocaleString("pl-PL", {
      dateStyle: "full",
      timeStyle: "medium",
      timeZone: "Europe/Warsaw",
    }),
    dayOfWeek: now.toLocaleDateString("pl-PL", {
      weekday: "long",
      timeZone: "Europe/Warsaw",
    }),
    timestamp: now.toISOString(),
  };
}

export async function fetchWeather(city: string) {
  const normalized = city.trim();

  if (!normalized) return { error: "Podaj nazwę miasta" };

  try {
    const geocodingResponse = await fetchWithTimeout(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(normalized)}&count=1&language=pl`,
    );

    if (!geocodingResponse.ok) {
      return { error: `API zwróciło błąd ${geocodingResponse.status}. Sprawdź parametry.` };
    }

    const geocoding = (await geocodingResponse.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string }>;
    };
    const place = geocoding.results?.[0];

    if (!place) {
      return { error: `Nie znalazłem miasta ${normalized}. Sprawdź pisownię.` };
    }

    const weatherResponse = await fetchWithTimeout(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`,
    );

    if (!weatherResponse.ok) {
      return { error: `API zwróciło błąd ${weatherResponse.status}. Sprawdź parametry.` };
    }

    const weather = (await weatherResponse.json()) as {
      current?: {
        temperature_2m: number;
        relative_humidity_2m: number;
        wind_speed_10m: number;
        weather_code: number;
      };
    };

    if (!weather.current) {
      return { error: `Nie udało się pobrać pogody dla ${place.name}` };
    }

    return {
      city: place.name,
      temperature: weather.current.temperature_2m,
      humidity: weather.current.relative_humidity_2m,
      windSpeed: weather.current.wind_speed_10m,
      description:
        weatherDescriptions[weather.current.weather_code] ??
        `kod pogody ${weather.current.weather_code}`,
    };
  } catch (error) {
    return connectionError(error);
  }
}

export async function fetchExchangeRate(currency: string) {
  const normalized = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return { error: "Podaj 3-literowy kod waluty (np. EUR, USD)" };
  }

  try {
    const response = await fetchWithTimeout(
      `https://api.nbp.pl/api/exchangerates/rates/a/${encodeURIComponent(normalized)}/?format=json`,
    );

    if (response.status === 404) {
      return { error: `Waluta ${normalized} nie jest w tabeli NBP. Popularne: EUR, USD, GBP, CHF` };
    }

    if (!response.ok) {
      return { error: `API zwróciło błąd ${response.status}. Sprawdź parametry.` };
    }

    const data = (await response.json()) as {
      rates?: Array<{ mid: number; effectiveDate: string }>;
    };
    const rate = data.rates?.[0];

    if (!rate) return { error: `Nie udało się pobrać kursu ${normalized}` };

    return { currency: normalized, rate: rate.mid, date: rate.effectiveDate, source: "NBP" };
  } catch (error) {
    return connectionError(error);
  }
}

export async function fetchHolidays(countryCode: string, year: number) {
  const normalized = countryCode.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(normalized)) {
    return { error: "Podaj 2-literowy kod kraju (np. PL, DE, US)" };
  }

  try {
    const response = await fetchWithTimeout(
      `https://date.nager.at/api/v3/publicholidays/${year}/${encodeURIComponent(normalized)}`,
    );

    if (!response.ok) {
      return { error: `Nie znalazłem świąt dla kraju ${normalized}. Popularne: PL, DE, US, GB, FR` };
    }

    const holidays = (await response.json()) as Array<{
      date: string;
      localName: string;
      name: string;
    }>;

    return holidays.slice(0, 15).map(({ date, localName, name }) => ({ date, localName, name }));
  } catch (error) {
    return connectionError(error);
  }
}

export async function fetchWikipedia(query: string) {
  const normalized = query.trim();
  if (!normalized) return { error: "Podaj hasło do wyszukania w Wikipedii" };

  const headers = { "user-agent": "MojAgent/1.0 (educational project)" };

  try {
    const summaryResponse = await fetchWithTimeout(
      `https://pl.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(normalized)}`,
      { headers },
    );

    if (summaryResponse.ok) {
      const summary = (await summaryResponse.json()) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      };

      return {
        title: summary.title ?? normalized,
        summary: (summary.extract ?? "").slice(0, 1000),
        url: summary.content_urls?.desktop?.page ?? `https://pl.wikipedia.org/wiki/${encodeURIComponent(normalized)}`,
      };
    }

    if (summaryResponse.status !== 404) {
      return { error: `API zwróciło błąd ${summaryResponse.status}. Sprawdź parametry.` };
    }

    const searchResponse = await fetchWithTimeout(
      `https://pl.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(normalized)}&format=json&origin=*`,
      { headers },
    );

    if (!searchResponse.ok) {
      return { error: `API zwróciło błąd ${searchResponse.status}. Sprawdź parametry.` };
    }

    const search = (await searchResponse.json()) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    const match = search.query?.search?.[0];

    if (!match) return { error: `Nie znalazłem artykułu: ${normalized}` };

    return {
      title: match.title,
      summary: match.snippet.replace(/<[^>]+>/g, "").slice(0, 1000),
      url: `https://pl.wikipedia.org/wiki/${encodeURIComponent(match.title)}`,
    };
  } catch (error) {
    return connectionError(error);
  }
}

export async function fetchWebPage(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return { error: `Nieprawidłowy adres URL: ${url}` };
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { error: "Można czytać tylko strony HTTP i HTTPS" };
  }

  try {
    const response = await fetchWithTimeout(parsedUrl, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; MojAgent/1.0)" },
    });

    if (!response.ok) {
      return { error: `API zwróciło błąd ${response.status}. Sprawdź parametry.` };
    }

    const html = await response.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    return { url: parsedUrl.toString(), text };
  } catch (error) {
    return connectionError(error);
  }
}

async function createKnowledgeEmbedding(text: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return null;
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "models/gemini-embedding-2", content: { parts: [{ text }] }, output_dimensionality: 768 }) },
  );
  const payload = (await response.json()) as { embedding?: { values?: number[] } };
  if (!response.ok || !payload.embedding?.values) throw new Error("Nie udało się wygenerować embeddingu.");
  return payload.embedding.values;
}

export async function searchKnowledge(query: string) {
  const normalized = query.trim();
  if (!normalized) return { results: [], total_found: 0, message: "Nie znaleziono informacji w bazie wiedzy." };
  try {
    const embedding = await createKnowledgeEmbedding(normalized);
    if (!embedding) return { results: [], total_found: 0, message: "Nie znaleziono informacji w bazie wiedzy." };
    const { data, error } = await supabase.rpc("match_documents", { query_embedding: embedding, match_threshold: 0.5, match_count: 5 });
    if (error) throw error;
    const results = (data ?? []).map((row: { title?: string; content?: string; similarity?: number; metadata?: Record<string, unknown> }) => {
      const title = row.title ?? "Dokument";
      const metadata = row.metadata ?? {};
      return {
        title,
        content: row.content ?? "",
        similarity: row.similarity ?? 0,
        metadata: {
          source: typeof metadata.source === "string" ? metadata.source : title,
          chunk_index: typeof metadata.chunk_index === "number" ? metadata.chunk_index : 0,
          total_chunks: typeof metadata.total_chunks === "number" ? metadata.total_chunks : 1,
        },
        added_at: typeof metadata.added_at === "string" ? metadata.added_at : null,
      };
    });
    const source_documents = [...new Set(results.map((result: { metadata: { source: string } }) => result.metadata.source))];
    return results.length
      ? { results, total_found: results.length, source_documents }
      : { results: [], total_found: 0, source_documents: [], message: "Nie znaleziono informacji w bazie wiedzy." };
  } catch (error) {
    void logTechnical("WARN", "knowledge.search.failed", { error });
    return { results: [], total_found: 0, message: "Nie udało się przeszukać bazy wiedzy." };
  }
}

export const searchKnowledgeTool = tool({
  description: "Wyszukuje informacje w bazie wiedzy firmy (cenniki, FAQ, regulaminy, oferty). ZAWSZE używaj przy pytaniach o ceny, pakiety, warunki i firmowe usługi.",
  inputSchema: jsonSchema<{ query: string }>({ type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false }),
  execute: async ({ query }) => searchKnowledge(query),
});

export const lessonFourTools = {
  searchKnowledge: searchKnowledgeTool,
  calculator: tool({
    description: "Oblicza wyrażenia matematyczne. Używaj do dokładnych obliczeń.",
    inputSchema: jsonSchema<{ expression: string }>({
      type: "object",
      properties: { expression: { type: "string" } },
      required: ["expression"],
      additionalProperties: false,
    }),
    execute: async ({ expression }) => calculate(expression),
  }),
  currentDateTime: tool({
    description: "Zwraca aktualną datę i czas w Polsce.",
    inputSchema: jsonSchema<JsonObject>({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => getCurrentDateTime(),
  }),
  getWeather: tool({
    description: "Sprawdza aktualną pogodę w podanym mieście.",
    inputSchema: jsonSchema<{ city: string }>({
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
      additionalProperties: false,
    }),
    execute: async ({ city }) => fetchWeather(city),
  }),
  getExchangeRate: tool({
    description: "Sprawdza średni kurs waluty do PLN z NBP.",
    inputSchema: jsonSchema<{ currency: string }>({
      type: "object",
      properties: { currency: { type: "string" } },
      required: ["currency"],
      additionalProperties: false,
    }),
    execute: async ({ currency }) => fetchExchangeRate(currency),
  }),
  getHolidays: tool({
    description: "Sprawdza święta państwowe w kraju w podanym roku.",
    inputSchema: jsonSchema<{ countryCode: string; year: number }>({
      type: "object",
      properties: {
        countryCode: { type: "string" },
        year: { type: "number" },
      },
      required: ["countryCode", "year"],
      additionalProperties: false,
    }),
    execute: async ({ countryCode, year }) => fetchHolidays(countryCode, year),
  }),
  searchWikipedia: tool({
    description: "Wyszukuje artykuł w polskiej Wikipedii i zwraca streszczenie.",
    inputSchema: jsonSchema<{ query: string }>({
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    }),
    execute: async ({ query }) => fetchWikipedia(query),
  }),
  saveNote: tool({
    description: "Zapisuje notatkę w pamięci agenta.",
    inputSchema: jsonSchema<{ title: string; content: string }>({
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
      },
      required: ["title", "content"],
      additionalProperties: false,
    }),
    execute: async ({ title, content }) => {
      notesStore.set(title, { title, content, createdAt: new Date().toISOString() });
      return { saved: true, title };
    },
  }),
  getNotes: tool({
    description: "Pobiera wszystkie zapisane notatki.",
    inputSchema: jsonSchema<JsonObject>({
      type: "object",
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => [...notesStore.values()],
  }),
  readWebPage: tool({
    description: "Pobiera i czyta zawartość strony internetowej.",
    inputSchema: jsonSchema<{ url: string }>({
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
      additionalProperties: false,
    }),
    execute: async ({ url }) => fetchWebPage(url),
  }),
};
