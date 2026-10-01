import { NextRequest, NextResponse } from 'next/server';
import {
  askStudyAssistant,
  summarizeStudyMaterial,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
  parseRoutineWithAI,
} from '@/lib/ai/prompts';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'ask': {
        const { question, context } = payload;
        const answer = await askStudyAssistant(question, context);
        return NextResponse.json({ answer });
      }

      case 'summarize': {
        const { content, title } = payload;
        const result = await summarizeStudyMaterial(content, title);
        return NextResponse.json(result);
      }

      case 'flashcards': {
        const { content, count, courseCode } = payload;
        const cards = await generateFlashcards(content, count || 6, courseCode);
        return NextResponse.json({ flashcards: cards });
      }

      case 'quiz': {
        const { content, count } = payload;
        const quiz = await generateQuiz(content, count || 5);
        return NextResponse.json({ questions: quiz });
      }

      case 'studyPlan': {
        const { tasks, routine } = payload;
        const plan = await generateStudyPlan(tasks || [], routine || []);
        return NextResponse.json(plan);
      }

      case 'parseRoutine': {
        const { imageBase64, mimeType, text } = payload;
        const result = await parseRoutineWithAI({ imageBase64, mimeType, text });
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('AI route error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
