/**
 * Lexical retrieval over the research corpus parsed by `loadKnowledgeBase.ts`.
 *
 * No embeddings, no vector store — the corpus is a few dozen entries from two
 * .md files, which is small enough that plain term-overlap scoring is enough
 * to find the right passages, and it needs zero new dependencies and no
 * network call at request time.
 */

export type KnowledgeChunk = {
  title: string;
  url: string;
  access: 'full' | 'citation-only';
  text: string;
};

export type ScoredChunk = KnowledgeChunk & { score: number };

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'if', 'in',
  'into', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'our', 'should',
  'so', 'that', 'the', 'their', 'them', 'there', 'these', 'they', 'this',
  'to', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'will', 'with', 'would', 'you', 'your',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function keywords(text: string): string[] {
  return tokenize(text).filter(word => word.length > 2 && !STOPWORDS.has(word));
}

/** Scores every chunk against a query by weighted term overlap (title hits count double). */
export function scoreChunks(query: string, chunks: KnowledgeChunk[]): ScoredChunk[] {
  const queryTerms = new Set(keywords(query));
  if (queryTerms.size === 0) return [];

  return chunks
    .map(chunk => {
      const bodyTerms = new Set(keywords(chunk.text));
      const titleTerms = new Set(keywords(chunk.title));
      let score = 0;
      for (const term of queryTerms) {
        if (bodyTerms.has(term)) score += 1;
        if (titleTerms.has(term)) score += 2;
      }
      return { ...chunk, score };
    })
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score);
}

/** Takes the best-scoring chunks, capped per-source so one paper can't fill the whole context window. */
export function topChunks(
  scored: ScoredChunk[],
  opts?: { maxChunks?: number; maxPerTitle?: number },
): ScoredChunk[] {
  const maxChunks = opts?.maxChunks ?? 6;
  const maxPerTitle = opts?.maxPerTitle ?? 2;
  const perTitle = new Map<string, number>();
  const picked: ScoredChunk[] = [];

  for (const chunk of scored) {
    const used = perTitle.get(chunk.title) ?? 0;
    if (used >= maxPerTitle) continue;
    picked.push(chunk);
    perTitle.set(chunk.title, used + 1);
    if (picked.length >= maxChunks) break;
  }
  return picked;
}

export type SourceRef = { title: string; url: string };

/** Unique {title, url} pairs for the API response, in relevance order. */
export function dedupeSources(chunks: ScoredChunk[], max = 4): SourceRef[] {
  const seen = new Set<string>();
  const out: SourceRef[] = [];
  for (const chunk of chunks) {
    if (seen.has(chunk.url)) continue;
    seen.add(chunk.url);
    out.push({ title: chunk.title, url: chunk.url });
    if (out.length >= max) break;
  }
  return out;
}
