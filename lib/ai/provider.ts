import { GoogleGenAI } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

// `gemini-3.8-flash` is not a published Gemini model ID, which made every AI
// call fail with a 404. This is the current stable fast model.
export const AI_MODEL = 'gemini-3.1-flash-lite';
