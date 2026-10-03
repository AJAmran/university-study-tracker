import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'unimaster-pro',
        },
      },
    });
  }
  return aiInstance;
}

// `gemini-3.8-flash` is not a published Gemini model ID, which made every AI
// call fail with a 404. This is the current stable fast model.
// Override with GEMINI_MODEL env var if the ID is retired.
export const AI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
