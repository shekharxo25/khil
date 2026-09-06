import { loadKnowledgeBase } from './_lib/loadKnowledgeBase';
import { scoreChunks, topChunks, dedupeSources, type ScoredChunk, type SourceRef } from './_lib/retrieve';
import { assertChatSafeReply } from '../src/domain/safeLanguage';

/**
 * `/api/chat` — the backend `src/screens/Chat.tsx` and `src/lib/chatApi.ts`
 * already call. Retrieves the entries most relevant to the parent's question
 * directly from `api/_lib/research/*.md` (see `loadKnowledgeBase.ts`) — the
 * chatbot's entire knowledge base, parsed at request time, no build step —
 * asks Claude to answer grounded in them,
 * and gates the reply through `assertChatSafeReply` before it goes back —
 * the same non-diagnosis rule the rest of the app enforces in code rather
 * than in prose.
 *
 * No `ANTHROPIC_API_KEY`: returns a clearly-labeled stand-in reply (still
 * backed by real retrieval, so the sources shown are real) rather than
 * erroring — see the README's chatbot-backend section. An actual failure
 * calling Claude returns a non-2xx status instead, which `chatApi.ts` turns
 * into its own "could not reach the assistant" message client-side.
 */

type ApiRequest = { method?: string; body?: unknown };
type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
};

type ChatTurn = { from: 'parent' | 'assistant'; body: string };
type ParsedBody = { message: string; history: ChatTurn[]; flagContext?: string };

const MODEL = process.env.ANTHROPIC_CHAT_MODEL ?? 'claude-sonnet-5';
const MAX_TOKENS = 700;
const MAX_HISTORY_ITEMS = 16;

const SYSTEM_PROMPT = `You are the Khil research assistant, built into a screening-game app for \
children aged 2-6. Parents use you to understand the published research behind child \
development and behavioral screening, not to get a reading on their own child.

Ground every substantive claim in the source excerpts provided below the parent's message. \
When you rely on one, name it by title in your answer — you don't need to repeat its URL, the \
app shows sources separately. If the excerpts don't cover the question, say so plainly rather \
than guessing or inventing a citation.

Hard rules, no exceptions:
- Never tell a parent that their child has, shows signs of, or is likely to have any named \
condition (autism, ADHD, dyslexia, a developmental delay, or any other diagnosis). That call is \
never this app's to make.
- Never invent or state a personalized risk score, percentage, or severity level for a specific \
child.
- If a parent asks you to interpret their own child's flag or results, say that's a question for \
the specialist mapped to their account — you can still discuss what the research says in \
general.
- Keep answers short enough to read comfortably on a phone: a few sentences, occasionally a \
short list.`;

function parseBody(body: unknown): ParsedBody | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b.message !== 'string' || !b.message.trim()) return null;

  const history: ChatTurn[] = Array.isArray(b.history)
    ? b.history.filter((m): m is ChatTurn => {
        if (!m || typeof m !== 'object') return false;
        const turn = m as Record<string, unknown>;
        return (turn.from === 'parent' || turn.from === 'assistant') && typeof turn.body === 'string';
      })
    : [];

  return {
    message: b.message.trim(),
    history,
    flagContext: typeof b.flagContext === 'string' ? b.flagContext : undefined,
  };
}

function buildContextBlock(picked: ScoredChunk[]): string {
  if (picked.length === 0) {
    return 'No source excerpts in the research corpus matched this question closely.';
  }
  return picked
    .map((chunk, i) => {
      const kind = chunk.access === 'full' ? 'excerpt' : 'citation only — do not quote directly, describe generally';
      return `[${i + 1}] "${chunk.title}" (${kind})\n${chunk.text}`;
    })
    .join('\n\n');
}

type AnthropicMessage = { role: 'user' | 'assistant'; content: string };

/** Maps the thread to Anthropic's strict user/assistant alternation, merging any run of same-role turns left by a prior failed request. */
function toAnthropicMessages(history: ChatTurn[], fallbackMessage: string): AnthropicMessage[] {
  const source = history.length > 0 ? history : [{ from: 'parent' as const, body: fallbackMessage }];
  const capped = source.slice(-MAX_HISTORY_ITEMS);
  const firstUserIdx = capped.findIndex(t => t.from === 'parent');
  const trimmed = firstUserIdx > 0 ? capped.slice(firstUserIdx) : capped;

  const merged: AnthropicMessage[] = [];
  for (const turn of trimmed) {
    const role: 'user' | 'assistant' = turn.from === 'parent' ? 'user' : 'assistant';
    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.content += `\n${turn.body}`;
    } else {
      merged.push({ role, content: turn.body });
    }
  }
  return merged;
}

async function callClaude(systemPrompt: string, messages: AnthropicMessage[]): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY as string,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`anthropic API responded ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text)
    .join('\n')
    .trim();
}

function buildStubReply(picked: ScoredChunk[]): string {
  const label = '[Demo mode — no assistant configured yet]';
  if (picked.length === 0) {
    return (
      `${label} I can't generate a real answer right now (no ANTHROPIC_API_KEY set on the ` +
      `backend), and nothing in the research corpus closely matched that question either. ` +
      `Once the key is configured, I'll answer for real.`
    );
  }
  const list = picked
    .slice(0, 3)
    .map(c => `• ${c.title}`)
    .join('\n');
  return (
    `${label} I can't generate a real answer right now (no ANTHROPIC_API_KEY set on the ` +
    `backend), but these sources in the research corpus look most relevant to your question:\n` +
    `${list}\nOnce the key is configured, I'll answer for real using them.`
  );
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const parsed = parseBody(req.body);
  if (!parsed) {
    res.status(400).json({ error: 'expected { message: string, history?: array, flagContext?: string }' });
    return;
  }

  const corpus = loadKnowledgeBase();
  const query = parsed.flagContext ? `${parsed.message}\n${parsed.flagContext}` : parsed.message;
  const picked = topChunks(scoreChunks(query, corpus));
  const sources: SourceRef[] = dedupeSources(picked);

  if (!process.env.ANTHROPIC_API_KEY) {
    const reply = assertChatSafeReply(buildStubReply(picked), 'api/chat:stub');
    res.status(200).json({ reply, sources });
    return;
  }

  try {
    const flagNote = parsed.flagContext
      ? `\n\nThe parent is asking in the context of a flag described to them, in safe non-diagnostic ` +
        `language, as: "${parsed.flagContext}". Discuss what the research says in general; do not use ` +
        `this to claim anything about this specific child beyond what that sentence already says.`
      : '';
    const systemPrompt = `${SYSTEM_PROMPT}${flagNote}\n\nSource excerpts:\n${buildContextBlock(picked)}`;
    const messages = toAnthropicMessages(parsed.history, parsed.message);

    const raw = await callClaude(systemPrompt, messages);
    const reply = assertChatSafeReply(
      raw || "I couldn't find a clear answer to that — worth trying a more specific question.",
      'api/chat',
    );
    res.status(200).json({ reply, sources });
  } catch (err) {
    console.error('[khil/api/chat] Claude call failed:', err);
    res.status(502).json({ error: 'assistant unavailable' });
  }
}
