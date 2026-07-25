import { splitIntoChunks } from "../../../lib/chunking";
import { supabase } from "../../../lib/supabase";
import { getRequestUser } from "../../../lib/request-user";

const encoder = new TextEncoder();
function event(controller: ReadableStreamDefaultController<Uint8Array>, value: object) { controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`)); }
async function createEmbedding(text: string) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error("Brak klucza Gemini w konfiguracji serwera.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=${apiKey}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "models/gemini-embedding-2", content: { parts: [{ text }] }, output_dimensionality: 768 }) });
  const payload = (await response.json()) as { embedding?: { values?: number[] }; error?: { message?: string } };
  if (!response.ok || !payload.embedding?.values) throw new Error(payload.error?.message ?? "Nie udało się wygenerować embeddingu.");
  return payload.embedding.values;
}
export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) return Response.json({ error: "Wymagane logowanie." }, { status: 401 });
  const { title, content } = (await request.json()) as { title?: unknown; content?: unknown };
  if (typeof title !== "string" || !title.trim() || typeof content !== "string" || !content.trim()) return Response.json({ error: "Podaj tytuł i treść dokumentu." }, { status: 400 });
  const chunks = splitIntoChunks(content); const documentTitle = title.trim(); const addedAt = new Date().toISOString();
  const stream = new ReadableStream<Uint8Array>({ async start(controller) { try { for (const [index, chunk] of chunks.entries()) { const embedding = await createEmbedding(chunk); const { error } = await supabase.from("documents").insert({ title: documentTitle, content: chunk, embedding: `[${embedding.join(",")}]`, user_id: user.id, metadata: { source: documentTitle, chunk_index: index, total_chunks: chunks.length, added_at: addedAt } }); if (error) throw new Error(`Nie udało się zapisać fragmentu ${index + 1}: ${error.message}`); event(controller, { type: "progress", current: index + 1, total: chunks.length }); } event(controller, { type: "complete", chunksSaved: chunks.length }); } catch (error) { event(controller, { type: "error", message: error instanceof Error ? error.message : "Wystąpił nieznany błąd." }); } finally { controller.close(); } } });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
}
