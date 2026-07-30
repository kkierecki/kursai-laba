import { GoogleGenAI, Modality } from "@google/genai";

const imageModel = "gemini-3.1-flash-lite-image";
const imageTimeoutMs = 30000;

export type GeneratedImageResult = {
  image: string;
  text: string;
  usage: { inputTokens: number; outputTokens: number };
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(
        () => reject(new Error("Timeout generowania obrazu po 30 sekundach.")),
        timeoutMs,
      );
    }),
  ]);
}

export async function generateAiImage(
  prompt: string,
): Promise<GeneratedImageResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Brak GOOGLE_GENERATIVE_AI_API_KEY w zmiennych srodowiskowych.",
    );
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = (await withTimeout(
    ai.models.generateContent({
      model: imageModel,
      contents: prompt,
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    }),
    imageTimeoutMs,
  )) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: {
            data?: string;
            mimeType?: string;
          };
        }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);
  const text = parts
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();

  if (!imagePart?.inlineData?.data) {
    throw new Error("Model nie zwrocil obrazu.");
  }

  const mimeType = imagePart.inlineData.mimeType || "image/png";

  return {
    image: `data:${mimeType};base64,${imagePart.inlineData.data}`,
    text: text || "Obraz wygenerowany.",
    usage: {
      inputTokens: Number.isSafeInteger(response.usageMetadata?.promptTokenCount) ? response.usageMetadata!.promptTokenCount! : 0,
      outputTokens: Number.isSafeInteger(response.usageMetadata?.candidatesTokenCount) ? response.usageMetadata!.candidatesTokenCount! : 0,
    },
  };
}
