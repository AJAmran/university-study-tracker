import { getGeminiClient, AI_MODEL } from './provider';
import { Flashcard, QuizQuestion, ExtractedRoutineSlot } from '@/types';

const MAX_INPUT = 12000;

function truncate(input: string, max = MAX_INPUT): string {
  if (!input) return '';
  return input.length > max ? input.slice(0, max) : input;
}

function stripCodeFence(raw: string): string {
  const t = (raw || '').trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1].trim() : t;
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(stripCodeFence(raw)) as T;
  } catch {
    return fallback;
  }
}

const AI_TIMEOUT_MS = 90_000;
const AI_MAX_ATTEMPTS = 3;

/**
 * Operational wrapper for every Gemini call: hard timeout (no more hung
 * requests) + retry with backoff on transient failures (429 / 5xx / network).
 * Non-retryable errors (400, auth, bad-model 404) throw immediately.
 */
async function aiCall<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < AI_MAX_ATTEMPTS; attempt++) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${AI_TIMEOUT_MS / 1000}s`)), AI_TIMEOUT_MS)
      );
      return await Promise.race([fn(), timeout]);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable = /429|5\d\d|overloaded|timeout|timed out|fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(msg);
      if (!retryable || attempt === AI_MAX_ATTEMPTS - 1) throw e;
      await new Promise((r) => setTimeout(r, 600 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function askStudyAssistant(
  question: string,
  context?: {
    courseName?: string;
    courseCode?: string;
    notes?: string;
    topic?: string;
  }
): Promise<string> {
  const ai = getGeminiClient();

  const systemInstruction = `You are UniMaster AI, a personal academic tutor and study companion for a university student.
Your goals:
- Explain complex concepts with crystal clarity, intuitive analogies, and rigorous academic accuracy.
- Provide clean code snippets, step-by-step math derivations, or memory mnemonics when appropriate.
- Be concise, supportive, and exam-focused.
- If context is provided (course: ${context?.courseCode || 'General'} ${context?.courseName || ''}, topic: ${context?.topic || 'N/A'}), tailor your explanations specifically to that subject level.`;

  const prompt = `${context?.notes ? `Reference Notes from student:\n"""\n${truncate(context.notes, 6000)}\n"""\n\n` : ''}Student Question: ${truncate(question, 5000)}`;

  const response = await aiCall('askStudyAssistant', () => ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.7,
    },
  }));

  return response.text || 'No response generated.';
}

export async function summarizeStudyMaterial(
  content: string,
  title?: string
): Promise<{
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  examTips: string[];
}> {
  const ai = getGeminiClient();

  const prompt = `Analyze and summarize the following university study material / lecture notes for "${title || 'Academic Topic'}".
Format your response as a valid JSON object matching this schema:
{
  "summary": "Concise executive overview of the concept (2-3 paragraphs)",
  "keyPoints": ["bullet point 1", "bullet point 2", ...],
  "definitions": [
    {"term": "Term Name", "definition": "Precise academic definition"}
  ],
  "examTips": ["High-yield exam insight 1", "Common pitfall to avoid 2", ...]
}

Study Material:
"""
${truncate(content)}
"""`;

  const response = await aiCall('summarizeStudyMaterial', () => ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  }));

  try {
    const raw = response.text || '{}';
    const parsed = safeParseJson<Record<string, unknown>>(raw, {});
    if (parsed && typeof parsed.summary === 'string') {
      return {
        summary: parsed.summary,
        keyPoints: Array.isArray(parsed.keyPoints) ? (parsed.keyPoints as unknown[]).filter((x): x is string => typeof x === 'string') : [],
        definitions: Array.isArray(parsed.definitions)
          ? (parsed.definitions as Array<{ term?: unknown; definition?: unknown }>)
              .filter((d) => typeof d?.term === 'string')
              .map((d) => ({ term: d.term as string, definition: typeof d.definition === 'string' ? d.definition : '' }))
          : [],
        examTips: Array.isArray(parsed.examTips) ? (parsed.examTips as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      };
    }
    throw new Error('Invalid summary shape');
  } catch (err) {
    console.error('Failed to parse AI summary JSON:', err);
    return {
      summary: stripCodeFence(response.text || 'Summary unavailable.').slice(0, 4000),
      keyPoints: ['Review source material directly.'],
      definitions: [],
      examTips: ['Prepare key derivations and definitions.'],
    };
  }
}

export async function generateFlashcards(
  content: string,
  count: number = 6,
  courseCode?: string
): Promise<Flashcard[]> {
  const ai = getGeminiClient();

  const prompt = `Generate exactly ${count} high-yield university study flashcards based on this topic/material:
Course: ${courseCode || 'General'}
Content:
"""
${truncate(content)}
"""

Return a JSON array of flashcards with this exact structure:
[
  {
    "id": "fc-1",
    "question": "Clear, challenging question testing recall or concept application",
    "answer": "Concise, precise answer with key terms bolded or highlighted",
    "topic": "Subtopic name"
  }
]`;

  const response = await aiCall('generateFlashcards', () => ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  }));

  try {
    const raw = response.text || '[]';
    const parsed = safeParseJson<unknown>(raw, []);
    if (!Array.isArray(parsed)) throw new Error('Invalid flashcards shape');
    return (parsed as Array<Record<string, unknown>>).map((item, idx) => ({
      id: `fc-${Date.now()}-${idx}-${Math.floor(Math.random() * 10000)}`,
      question: typeof item.question === 'string' && item.question ? item.question : 'Question',
      answer: typeof item.answer === 'string' && item.answer ? item.answer : 'Answer',
      courseCode: courseCode || '',
      topic: typeof item.topic === 'string' && item.topic ? item.topic : 'General',
    }));
  } catch (err) {
    console.error('Failed to parse Flashcards JSON:', err);
    const snippet = truncate(content, 150);
    return [
      {
        id: `fc-fallback-${Date.now()}`,
        question: 'What is the primary concept covered?',
        answer: snippet ? snippet + '...' : 'Review source material directly.',
        courseCode,
      },
    ];
  }
}

export async function generateQuiz(
  content: string,
  count: number = 5
): Promise<QuizQuestion[]> {
  const ai = getGeminiClient();

  const prompt = `Generate ${count} university-level quiz questions (MCQs and conceptual questions) based on this material:
"""
${truncate(content)}
"""

Return a JSON array where each object has:
- "id": string
- "question": string
- "options": array of 4 distinct choices
- "correctIndex": integer 0-3 pointing to the correct choice in options
- "explanation": concise explanation of why the correct answer is right and others are wrong
- "type": "mcq" or "conceptual" or "true_false"`;

  const response = await aiCall('generateQuiz', () => ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  }));

  try {
    const raw = response.text || '[]';
    const parsed = safeParseJson<unknown>(raw, []);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Array<Record<string, unknown>>)
      .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options) && (q.options as unknown[]).length === 4)
      .slice(0, count)
      .map((q, idx) => {
        const options = (q.options as unknown[]).map((o) => String(o)).slice(0, 4);
        let correctIndex = Number(q.correctIndex);
        if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;
        return {
          id: typeof q.id === 'string' && q.id ? q.id : `qz-${Date.now()}-${idx}`,
          question: q.question as string,
          options,
          correctIndex,
          explanation: typeof q.explanation === 'string' ? q.explanation : '',
          type: q.type === 'true_false' || q.type === 'conceptual' ? (q.type as 'true_false' | 'conceptual') : 'mcq',
        } as QuizQuestion;
      });
  } catch (err) {
    console.error('Failed to parse Quiz JSON:', err);
    return [];
  }
}

export async function generateStudyPlan(
  tasks: Array<{ title: string; courseCode?: string; dueDate: string; priority: string }>,
  routine: Array<{ day: string; startTime: string; endTime: string; courseCode?: string }>
): Promise<{
  planOverview: string;
  dailySchedule: Array<{
    day: string;
    focusCourses: string[];
    timeSlots: Array<{ time: string; activity: string; priority: string }>;
  }>;
  proTips: string[];
}> {
  const ai = getGeminiClient();

  const prompt = `Create an optimized, realistic academic study plan for this university student.
Current Tasks & Deadlines:
${JSON.stringify(tasks, null, 2)}

Class Routine Commitments:
${JSON.stringify(routine, null, 2)}

Create a balanced study plan that:
1. Prioritizes upcoming CTs, exams, and urgent assignments.
2. Fits around class times without burning out the student.
3. Incorporates spaced repetition and active recall.

Return JSON matching:
{
  "planOverview": "Strategic rationale for the week",
  "dailySchedule": [
    {
      "day": "Monday",
      "focusCourses": ["CSE 221", "CSE 223"],
      "timeSlots": [
        {"time": "16:00 - 17:30", "activity": "Practice Dynamic Programming Knapsack", "priority": "High"},
        {"time": "19:00 - 20:30", "activity": "SQL Normalization Exercise", "priority": "Medium"}
      ]
    }
  ],
  "proTips": ["Tip 1", "Tip 2", "Tip 3"]
}`;

  const response = await aiCall('generateStudyPlan', () => ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.5,
    },
  }));

  try {
    const raw = response.text || '{}';
    const parsed = safeParseJson<Record<string, unknown>>(raw, {});
    if (parsed && typeof parsed.planOverview === 'string') {
      return {
        planOverview: parsed.planOverview,
        dailySchedule: Array.isArray(parsed.dailySchedule) ? (parsed.dailySchedule as Array<{ day: string; focusCourses: string[]; timeSlots: Array<{ time: string; activity: string; priority: string }> }>) : [],
        proTips: Array.isArray(parsed.proTips) ? (parsed.proTips as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      };
    }
    throw new Error('Invalid plan shape');
  } catch (err) {
    console.error('Failed to parse Study Plan JSON:', err);
    return {
      planOverview: 'Review your upcoming urgent deadlines first.',
      dailySchedule: [],
      proTips: ['Break study blocks into 45-minute Pomodoro sessions.'],
    };
  }
}

export async function parseRoutineWithAI(input: {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
}): Promise<{
  semesterName?: string;
  slots: ExtractedRoutineSlot[];
  notes?: string;
}> {
  const ai = getGeminiClient();

  const instructions = `You are an expert university routine and timetable parser.
Your task is to analyze the university class routine (provided via image or text) and accurately extract all class schedule slots.

For each class period:
- day: strictly one of "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday".
- courseCode: course code exactly as printed on the routine. Normalize to uppercase and trimmed format.
- courseName: course title if present, or infer from standard syllabus.
- credit: numeric credit hours (default 3.0 for theory, 1.5 for lab).
- startTime: 24-hour time "HH:MM" (e.g. "08:30", "09:00", "11:30", "14:00").
- endTime: 24-hour time "HH:MM" (e.g. "10:00", "10:30", "13:00", "15:30").
- room: classroom or lab name if printed. If the routine does not show one, return an empty string rather than inventing one.
- faculty: teacher's name or initials if printed. If not shown, return an empty string rather than inventing one.
- mode: "On Campus" | "Online" | "Hybrid" (default "On Campus"). The sheet may write this as "On-Campus" with a hyphen; normalize it to "On Campus".
- notes: section, batch, or special notes if printed. Otherwise an empty string.

Only report what the routine actually shows. Do not guess rooms, faculty names, or class times that are not visible in the image or text.

Return valid JSON conforming to:
{
  "semesterName": the detected semester label, or "Semester 1" if the routine does not state one,
  "slots": [
    {
      "day": "Sunday",
      "courseCode": "MAT 0541 1203",
      "courseName": "Structured Programming Language",
      "credit": 3,
      "startTime": "09:00",
      "endTime": "10:30",
      "room": "",
      "faculty": "",
      "mode": "On Campus",
      "notes": "Section A"
    }
  ],
  "notes": "Detected X classes"
}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let contents: any;

  if (input.imageBase64) {
    const cleanBase64 = input.imageBase64.includes(',')
      ? input.imageBase64.split(',').pop() || ''
      : input.imageBase64;
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    const mimeType = allowedMime.includes(input.mimeType || '') ? input.mimeType! : 'image/jpeg';
    contents = {
      parts: [
        {
          inlineData: {
            data: cleanBase64,
            mimeType,
          },
        },
        {
          text: `${instructions}\n\nPlease parse this university class routine document / image carefully. Extract all class rows and periods accurately into JSON.`,
        },
      ],
    };
  } else {
    contents = `${instructions}\n\nRoutine Source Text:\n"""\n${truncate(input.text || '', 8000)}\n"""\n\nPlease parse all classes and periods into JSON.`;
  }

  const response = await aiCall('parseRoutineWithAI', () => ai.models.generateContent({
    model: AI_MODEL,
    contents,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  }));

  try {
    const raw = response.text || '{}';
    const parsed = safeParseJson<{ semesterName?: unknown; slots?: unknown; notes?: unknown }>(raw, {});
    const validDays = new Set(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
    const timeRe = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const slots: ExtractedRoutineSlot[] = Array.isArray(parsed.slots)
      ? (parsed.slots as Array<Record<string, unknown>>)
          .filter((s) => s && typeof s.courseCode === 'string' && (s.courseCode as string).trim() && validDays.has(s.day as string) && timeRe.test(String(s.startTime || '')) && timeRe.test(String(s.endTime || '')) && String(s.startTime) < String(s.endTime))
          .map((s) => ({
            day: s.day as ExtractedRoutineSlot['day'],
            courseCode: (s.courseCode as string).toUpperCase().trim().slice(0, 50),
            courseName: (typeof s.courseName === 'string' && s.courseName ? s.courseName : (s.courseCode as string)).slice(0, 120),
            credit: typeof s.credit === 'number' && Number.isFinite(s.credit) ? Math.min(10, Math.max(0.5, s.credit)) : 3.0,
            startTime: String(s.startTime),
            endTime: String(s.endTime),
            room: typeof s.room === 'string' ? s.room.slice(0, 100) : '',
            faculty: typeof s.faculty === 'string' ? s.faculty.slice(0, 100) : '',
            mode: s.mode === 'Online' || s.mode === 'Hybrid' ? s.mode : 'On Campus',
            notes: typeof s.notes === 'string' ? s.notes.slice(0, 200) : '',
          }))
      : [];

    return {
      semesterName: typeof parsed.semesterName === 'string' ? parsed.semesterName.slice(0, 120) : 'Semester 1',
      slots,
      notes: typeof parsed.notes === 'string' ? parsed.notes.slice(0, 500) : `Successfully extracted ${slots.length} classes.`,
    };
  } catch (err) {
    console.error('Failed to parse AI routine JSON:', err);
    return {
      semesterName: 'Semester 1',
      slots: [],
      notes: 'Could not automatically parse the routine image or text. You can use the semester preset or add classes manually.',
    };
  }
}
