import { getGeminiClient, AI_MODEL } from './provider';
import { Flashcard, QuizQuestion, ExtractedRoutineSlot } from '@/types';

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

  const prompt = `${context?.notes ? `Reference Notes from student:\n"""\n${context.notes}\n"""\n\n` : ''}Student Question: ${question}`;

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.7,
    },
  });

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
${content}
"""`;

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  try {
    const raw = response.text || '{}';
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse AI summary JSON:', err);
    return {
      summary: response.text || 'Summary unavailable.',
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
${content}
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

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  });

  try {
    const raw = response.text || '[]';
    const parsed = JSON.parse(raw);
    return parsed.map((item: any, idx: number) => ({
      id: `fc-${Date.now()}-${idx}`,
      question: item.question || 'Question',
      answer: item.answer || 'Answer',
      courseCode: courseCode || '',
      topic: item.topic || 'General',
    }));
  } catch (err) {
    console.error('Failed to parse Flashcards JSON:', err);
    return [
      {
        id: `fc-fallback-1`,
        question: 'What is the primary concept covered?',
        answer: content.slice(0, 150) + '...',
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
${content}
"""

Return a JSON array where each object has:
- "id": string
- "question": string
- "options": array of 4 distinct choices
- "correctIndex": integer 0-3 pointing to the correct choice in options
- "explanation": concise explanation of why the correct answer is right and others are wrong
- "type": "mcq" or "conceptual" or "true_false"`;

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.4,
    },
  });

  try {
    const raw = response.text || '[]';
    return JSON.parse(raw);
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

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.5,
    },
  });

  try {
    const raw = response.text || '{}';
    return JSON.parse(raw);
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

  let contents: any;

  if (input.imageBase64) {
    contents = {
      parts: [
        {
          inlineData: {
            data: input.imageBase64,
            mimeType: input.mimeType || 'image/jpeg',
          },
        },
        {
          text: `${instructions}\n\nPlease parse this university class routine document / image carefully. Extract all class rows and periods accurately into JSON.`,
        },
      ],
    };
  } else {
    contents = `${instructions}\n\nRoutine Source Text:\n"""\n${input.text || ''}\n"""\n\nPlease parse all classes and periods into JSON.`;
  }

  const response = await ai.models.generateContent({
    model: AI_MODEL,
    contents,
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  try {
    const raw = response.text || '{}';
    const parsed = JSON.parse(raw);
    const slots: ExtractedRoutineSlot[] = Array.isArray(parsed.slots)
      ? parsed.slots.map((s: any) => ({
          day: s.day || 'Monday',
          courseCode: (s.courseCode || 'COURSE').toUpperCase().trim(),
          courseName: s.courseName || s.courseCode || 'Course',
          credit: typeof s.credit === 'number' ? s.credit : 3.0,
          startTime: s.startTime || '09:00',
          endTime: s.endTime || '10:30',
          room: s.room || '',
          faculty: s.faculty || '',
          mode: s.mode === 'Online' || s.mode === 'Hybrid' ? s.mode : 'On Campus',
          notes: s.notes || '',
        }))
      : [];

    return {
      semesterName: parsed.semesterName || 'Semester 1',
      slots,
      notes: parsed.notes || `Successfully extracted ${slots.length} classes.`,
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
