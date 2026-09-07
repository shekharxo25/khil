import type { ChatMessage } from '../store/types';

/**
 * Thin fetch wrapper around the `/api/chat` Vercel serverless function (see
 * `api/chat.ts`). `EXPO_PUBLIC_CHAT_API_URL` is net-new to this repo — Expo
 * exposes any `EXPO_PUBLIC_*` env var to client code via `process.env`
 * directly, no `expo-constants` needed. Defaults to a same-origin relative
 * path — correct both in production (the API route is served from the same
 * Vercel domain as the app) and under `vercel dev` locally. Only override
 * `EXPO_PUBLIC_CHAT_API_URL` when the API truly lives on a different origin
 * (e.g. `expo start` web without `vercel dev` in front of it).
 */
const API_URL = process.env.EXPO_PUBLIC_CHAT_API_URL ?? '/api/chat';

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
