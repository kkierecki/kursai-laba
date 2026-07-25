/** Dzieli tekst na fragmenty, zachowując końcówkę poprzedniego fragmentu jako kontekst. */
export function splitIntoChunks(text: string, chunkSize = 500, overlap = 50): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const sentences = normalized.match(/[^.!?\n]+[.!?]?|\n+/g) ?? [normalized];
  const chunks: string[] = [];
  let current = "";
  const addChunk = (value: string) => { const chunk = value.trim(); if (chunk) chunks.push(chunk); };
  for (const part of sentences) {
    const sentence = part.trim();
    if (!sentence) continue;
    if (sentence.length > chunkSize) {
      if (current) { addChunk(current); current = ""; }
      for (let start = 0; start < sentence.length; start += chunkSize - overlap) addChunk(sentence.slice(start, start + chunkSize));
      continue;
    }
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= chunkSize) current = candidate;
    else { addChunk(current); current = `${current.slice(-overlap)} ${sentence}`.trim(); }
  }
  addChunk(current);
  return chunks;
}
