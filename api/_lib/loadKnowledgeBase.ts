import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { KnowledgeChunk } from './retrieve';

/**
 * The chatbot's whole knowledge base: the research .md files in this
 * directory, parsed directly at request time. No ingestion step, no
 * external fetches, no build artifact to generate or commit — copy a
 * `.md` file in here and it's part of the corpus on the next deploy.
 *
 * These are copies of the two files at the top of the `Claudeinte code`
 * folder (`child_psychology_developmental_disorders_bibliography.md`,
 * `childhood_cognitive_disorders_research_brief.md`). Update both places
 * together if the source files change.
 */
const RESEARCH_DIR = path.join(__dirname, 'research');

let cached: KnowledgeChunk[] | null = null;

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function firstUrl(text: string): string | undefined {
  const linked = text.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
  if (linked) return linked[2];
  const bare = text.match(/https?:\/\/\S+/);
  return bare ? bare[0].replace(/[)\].,|]+$/, '') : undefined;
}

/** Prefers a quoted paper title inside the first bold span (the bibliography's style); falls back to the whole span (the research brief's style, no quotes). */
function firstTitle(text: string): string {
  const bold = text.match(/\*\*(.+?)\*\*/);
  const raw = bold ? bold[1] : text.split('\n')[0];
  const quoted = raw.match(/"([^"]{8,200})"/);
  const candidate = (quoted ? quoted[1] : raw).replace(/\.$/, '').trim();
  return candidate.length > 140 ? `${candidate.slice(0, 137)}...` : candidate;
}

/**
 * Splits one research .md file into retrieval chunks: one per numbered or
 * bulleted, linked entry (both files use one or the other for every citation).
 * Section headings (`## ...`) are kept as a prefix on each entry's text so
 * retrieval and the model both see which theme/domain an entry sits under.
 * Prose that isn't part of a linked entry (intros, closing notes) has no URL
 * to cite and is dropped rather than turned into an uncited chunk.
 */
function parseMarkdown(raw: string): KnowledgeChunk[] {
  const lines = raw.split('\n');
  const chunks: KnowledgeChunk[] = [];
  let buffer: string[] = [];
  let section = '';

  const flush = () => {
    if (buffer.length === 0) return;
    const block = buffer.join('\n').trim();
    buffer = [];
    if (!block) return;
    const url = firstUrl(block);
    if (!url) return;
    chunks.push({
      title: firstTitle(block),
      url,
      access: 'citation-only',
      text: section ? `[${section}] ${stripMarkdown(block)}` : stripMarkdown(block),
    });
  };

  const isEntryStart = (line: string) => /^(\d+\.\s+|-\s+)\S/.test(line);

  for (const line of lines) {
    if (line.startsWith('## ')) {
      flush();
      section = line.replace(/^##\s*/, '').trim();
      continue;
    }
    if (isEntryStart(line)) {
      flush();
      buffer.push(line);
      continue;
    }
    if (buffer.length > 0) {
      buffer.push(line);
    }
  }
  flush();

  return chunks;
}

export function loadKnowledgeBase(): KnowledgeChunk[] {
  if (cached) return cached;

  try {
    const files = readdirSync(RESEARCH_DIR).filter(f => f.endsWith('.md'));
    cached = files.flatMap(file => parseMarkdown(readFileSync(path.join(RESEARCH_DIR, file), 'utf8')));
  } catch (err) {
    console.warn(
      '[khil/api/chat] could not read api/_lib/research/*.md — falling back to an empty corpus.',
      err,
    );
    cached = [];
  }
  return cached;
}
