import { NextRequest, NextResponse } from 'next/server';
import {
  askStudyAssistant,
  summarizeStudyMaterial,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
  parseRoutineWithAI,
} from '@/lib/ai/prompts';

// Gemini calls (especially routine-image parsing) can take a while; allow the
// function to run past the platform default instead of being cut mid-stream.
export const maxDuration = 60;

/**
 * Same-origin guard: this endpoint spends GEMINI_API_KEY quota, so only our
 * own pages may call it. Browser same-origin POSTs carry Origin/Referer;
 * direct server-to-server calls carry neither and are still allowed.
 */
function isAllowedCaller(req: NextRequest): boolean {
  const host = req.headers.get('host');
  if (!host) return true;
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const check = (v: string | null): boolean => {
    if (!v) return true;
    try {
      return new URL(v).host === host;
    } catch {
      return false;
    }
  };
  return check(origin) && check(referer);
}

export async function POST(req: NextRequest) {
  if (!isAllowedCaller(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  try {
    const { action, payload } = (body || {}) as { action?: string; payload?: Record<string, unknown> };
    const p = payload ?? {};

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const clampCount = (v: unknown, def: number, min = 1, max = 12) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return def;
      return Math.min(max, Math.max(min, Math.floor(n)));
    };
    const asString = (v: unknown, max = 20000) =>
      typeof v === 'string' ? v.slice(0, max) : '';

    switch (action) {
      case 'ask': {
        const question = asString(p.question, 5000);
        if (!question.trim()) {
          return NextResponse.json({ error: 'Question is required' }, { status: 400 });
        }
        const context = (p.context && typeof p.context === 'object' ? p.context : undefined) as { courseName?: string; courseCode?: string; notes?: string; topic?: string } | undefined;
        const answer = await askStudyAssistant(question, context);
        return NextResponse.json({ answer });
      }

      case 'summarize': {
        const content = asString(p.content, 20000);
        if (!content.trim()) {
          return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }
        const title = asString(p.title, 200);
        const result = await summarizeStudyMaterial(content, title);
        return NextResponse.json(result);
      }

      case 'flashcards': {
        const content = asString(p.content, 20000);
        if (!content.trim()) {
          return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }
        const count = clampCount(p.count, 6);
        const cards = await generateFlashcards(content, count, asString(p.courseCode, 50));
        return NextResponse.json({ flashcards: cards });
      }

      case 'quiz': {
        const content = asString(p.content, 20000);
        if (!content.trim()) {
          return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }
        const count = clampCount(p.count, 5);
        const quiz = await generateQuiz(content, count);
        return NextResponse.json({ questions: quiz });
      }

      case 'studyPlan': {
        const tasks = Array.isArray(p.tasks) ? (p.tasks as unknown[]).slice(0, 100) : [];
        const routine = Array.isArray(p.routine) ? (p.routine as unknown[]).slice(0, 100) : [];
        const plan = await generateStudyPlan(
          tasks as Array<{ title: string; courseCode?: string; dueDate: string; priority: string }>,
          routine as Array<{ day: string; startTime: string; endTime: string; courseCode?: string }>
        );
        return NextResponse.json(plan);
      }

      case 'parseRoutine': {
        const imageBase64 = typeof p.imageBase64 === 'string' ? p.imageBase64 : undefined;
        if (imageBase64 && imageBase64.length > 7_000_000) {
          return NextResponse.json({ error: 'Image is too large (max ~5MB)' }, { status: 413 });
        }
        const text = asString(p.text, 20000);
        if (!imageBase64 && !text.trim()) {
          return NextResponse.json({ error: 'Image or text is required' }, { status: 400 });
        }
        const mimeType = typeof p.mimeType === 'string' ? p.mimeType : undefined;
        const result = await parseRoutineWithAI({ imageBase64, mimeType, text });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('AI route error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Failed to process AI request. Please try again.' },
      { status: 500 }
    );
  }
}
