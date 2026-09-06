import type { ChatMessage } from '../store/types';

/**
 * Thin fetch wrapper around the `/api/chat` Vercel serverless function (see
 * `api/chat.ts`). `EXPO_PUBLIC_CHAT_API_URL` is net-new to this repo — Expo
 * exposes any `EXPO_PUBLIC_*` env var to client code via `process.env`
 * directly, no `expo-constants` needed. Falls back to a local `vercel dev`
 * address so the app has something to hit out of the box in development.
 */
const API_URL = process.env.EXPO_PUBLIC_CHAT_API_URL ?? 'http://localhost:3000/api/chat';

export type ChatSource = { title: string; url: string };

export type AskChatbotInput = {
  message: string;
  /** Prior turns in this conversation, oldest first. */
  history: ChatMessage[];
  /** The flag's own already-safe-language text, when chatting about a specific flag. */
  flagContext?: string;
};

export type AskChatbotResult = {
  reply: string;
  sources: ChatSource[];
};

export async function askChatbot(input: AskChatbotInput): Promise<AskChatbotResult> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: input.message,
      history: input.history.map(m => ({ from: m.from, body: m.body })),
      flagContext: input.flagContext,
    }),
  });

  if (!response.ok) {
    throw new Error(`chat API responded ${response.status}`);
  }

  const data = await response.json();
  return {
    reply: typeof data.reply === 'string' ? data.reply : '',
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}
