'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAppData, saveAppData, resetAppData } from '@/lib/db';
import { Course, RoutineSlot, TaskItem, CourseAttendance, Assessment, MaterialItem, NoteItem, DayOfWeek, ClassMode, ExtractedRoutineSlot } from '@/types';

// Monotonic counter disambiguates IDs generated within the same millisecond.
// Without it, two rapid mutations (e.g. two attendance taps) can emit the same
// `att-${Date.now()}` id, and writeAll()'s uniqueById dedupe would silently
// drop one of the rows on the next save.
let idSequence = 0;
function uniqueId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now()}-${idSequence}`;
}

// Zod schemas
const CourseSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
  name: z.string().min(1, 'Course name is required'),
  credit: z.coerce.number().min(0.5).max(10),
  faculty: z.string().default(''),
  room: z.string().default(''),
  section: z.string().default('A'),
  semesterId: z.string().default('sem-current'),
  color: z.string().default('#3b82f6'),
  notes: z.string().optional(),
});

const RoutineSchema = z.object({
  courseId: z.string().min(1, 'Course is required'),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid start time (HH:MM)'),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid end time (HH:MM)'),
  faculty: z.string().optional(),
  room: z.string().optional(),
  mode: z.enum(['On Campus', 'Online', 'Hybrid']).default('On Campus'),
  notes: z.string().optional(),
});

const TaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  courseId: z.string().min(1, 'Course is required'),
  type: z.enum(['Homework', 'Assignment', 'CT', 'Exam', 'Quiz', 'Presentation', 'Project', 'Lab', 'Report', 'Other']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  status: z.enum(['Not Started', 'In Progress', 'Completed']).default('Not Started'),
  dueDate: z.string().min(1, 'Due date is required'),
  dueTime: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

const AssessmentSchema = z.object({
  courseId: z.string().min(1, 'Course is required'),
  title: z.string().min(1, 'Title is required'),
  category: z.enum(['CT', 'Assignment', 'Quiz', 'Midterm', 'Final', 'Lab', 'Viva', 'Presentation', 'Attendance', 'Other']),
  maxMarks: z.coerce.number().min(1),
  obtainedMarks: z.coerce.number().min(0),
  weightPercent: z.coerce.number().min(0).max(100),
});

const MaterialSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  courseId: z.string().min(1, 'Course is required'),
  type: z.enum([
    'PDF',
    'Lecture Slides',
    'Notes',
    'Handwritten Notes',
    'Video',
    'Lab Code',
    'Assignment',
    'Google Drive',
    'GitHub',
    'External Link',
  ]),
  url: z.string().min(1, 'URL or location is required'),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  isFavorite: z.boolean().default(false),
});

const NoteSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  courseId: z.string().min(1, 'Course is required'),
  topic: z.string().optional(),
  taskId: z.string().optional(),
  content: z.string().default(''),
  tags: z.array(z.string()).default([]),
  isPinned: z.boolean().default(false),
});

// COURSE MUTATIONS
export async function createCourse(formData: unknown) {
  const parsed = CourseSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const newCourse: Course = {
    id: uniqueId('course'),
    ...parsed.data,
  };

  data.courses.push(newCourse);
  // Auto-init attendance for new course
  data.attendance.push({
    id: uniqueId('att'),
    courseId: newCourse.id,
    totalClasses: 0,
    attended: 0,
    missed: 0,
    requiredPercentage: 75,
  });

  await saveAppData(data);
  revalidatePath('/');
  return { success: true, course: newCourse };
}

export async function updateCourse(id: string, formData: unknown) {
  const parsed = CourseSchema.partial().safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const idx = data.courses.findIndex((c) => c.id === id);
  if (idx === -1) return { success: false, error: 'Course not found' };

  data.courses[idx] = { ...data.courses[idx], ...parsed.data };
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, course: data.courses[idx] };
}

export async function deleteCourse(id: string) {
  const data = await getAppData();
  data.courses = data.courses.filter((c) => c.id !== id);
  data.routine = data.routine.filter((r) => r.courseId !== id);
  data.tasks = data.tasks.filter((t) => t.courseId !== id);
  data.attendance = data.attendance.filter((a) => a.courseId !== id);
  data.assessments = data.assessments.filter((a) => a.courseId !== id);
  data.materials = data.materials.filter((m) => m.courseId !== id);
  data.notes = data.notes.filter((n) => n.courseId !== id);

  await saveAppData(data);
  revalidatePath('/');
  return { success: true };
}

// ROUTINE MUTATIONS
export async function createRoutineSlot(formData: unknown) {
  const parsed = RoutineSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const newSlot: RoutineSlot = {
    id: uniqueId('rot'),
    ...parsed.data,
    day: parsed.data.day as DayOfWeek,
    mode: parsed.data.mode as ClassMode,
  };

  data.routine.push(newSlot);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, slot: newSlot };
}

export async function deleteRoutineSlot(id: string) {
  const data = await getAppData();
  data.routine = data.routine.filter((r) => r.id !== id);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true };
}

// TASK MUTATIONS
export async function createTask(formData: unknown) {
  const parsed = TaskSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const newTask: TaskItem = {
    id: uniqueId('task'),
    ...parsed.data,
  };

  data.tasks.push(newTask);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, task: newTask };
}

export async function updateTask(id: string, formData: unknown) {
  const parsed = TaskSchema.partial().safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const idx = data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return { success: false, error: 'Task not found' };

  data.tasks[idx] = { ...data.tasks[idx], ...parsed.data };
  if (parsed.data.status === 'Completed' && !data.tasks[idx].completedAt) {
    data.tasks[idx].completedAt = new Date().toISOString();
  } else if (parsed.data.status && parsed.data.status !== 'Completed') {
    delete data.tasks[idx].completedAt;
  }

  await saveAppData(data);
  revalidatePath('/');
  return { success: true, task: data.tasks[idx] };
}

export async function toggleTaskComplete(id: string) {
  const data = await getAppData();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return { success: false, error: 'Task not found' };

  if (task.status === 'Completed') {
    task.status = 'In Progress';
    delete task.completedAt;
  } else {
    task.status = 'Completed';
    task.completedAt = new Date().toISOString();
  }

  await saveAppData(data);
  revalidatePath('/');
  return { success: true, task };
}

export async function deleteTask(id: string) {
  const data = await getAppData();
  data.tasks = data.tasks.filter((t) => t.id !== id);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true };
}

// ATTENDANCE MUTATIONS
export async function recordAttendance(
  courseId: string,
  status: 'present' | 'absent'
): Promise<{ success: boolean; attendance?: CourseAttendance; error?: string }> {
  const data = await getAppData();
  let att = data.attendance.find((a) => a.courseId === courseId);

  if (!att) {
    att = {
      id: uniqueId('att'),
      courseId,
      totalClasses: 0,
      attended: 0,
      missed: 0,
      requiredPercentage: 75,
      logs: [],
    };
    data.attendance.push(att);
  }

  att.totalClasses += 1;
  if (status === 'present') {
    att.attended += 1;
  } else {
    att.missed += 1;
  }

  if (!att.logs) att.logs = [];
  att.logs.unshift({
    id: uniqueId('log'),
    date: new Date().toISOString().split('T')[0],
    status,
  });

  await saveAppData(data);
  revalidatePath('/');
  return { success: true, attendance: att };
}

export async function updateAttendanceTarget(courseId: string, requiredPercentage: number) {
  const data = await getAppData();
  const att = data.attendance.find((a) => a.courseId === courseId);
  if (!att) {
    return { success: false, error: 'Attendance record not found' };
  }
  att.requiredPercentage = Math.max(1, Math.min(100, requiredPercentage));
  await saveAppData(data);
  revalidatePath('/');
  return { success: true };
}

// ASSESSMENT & MARKS MUTATIONS
export async function addAssessment(formData: unknown) {
  const parsed = AssessmentSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const newAss: Assessment = {
    id: uniqueId('ass'),
    ...parsed.data,
  };

  data.assessments.push(newAss);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, assessment: newAss };
}

export async function deleteAssessment(id: string) {
  const data = await getAppData();
  data.assessments = data.assessments.filter((a) => a.id !== id);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true };
}

// MATERIALS MUTATIONS
export async function createMaterial(formData: unknown) {
  const parsed = MaterialSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const newMat: MaterialItem = {
    id: uniqueId('mat'),
    ...parsed.data,
    createdAt: new Date().toISOString(),
  };

  data.materials.unshift(newMat);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, material: newMat };
}

export async function toggleMaterialFavorite(id: string) {
  const data = await getAppData();
  const mat = data.materials.find((m) => m.id === id);
  if (!mat) return { success: false, error: 'Not found' };

  mat.isFavorite = !mat.isFavorite;
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, material: mat };
}

export async function deleteMaterial(id: string) {
  const data = await getAppData();
  data.materials = data.materials.filter((m) => m.id !== id);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true };
}

// NOTES MUTATIONS
export async function createNote(formData: unknown) {
  const parsed = NoteSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const newNote: NoteItem = {
    id: uniqueId('note'),
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };

  data.notes.unshift(newNote);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, note: newNote };
}

export async function updateNote(id: string, formData: unknown) {
  const parsed = NoteSchema.partial().safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const data = await getAppData();
  const idx = data.notes.findIndex((n) => n.id === id);
  if (idx === -1) return { success: false, error: 'Note not found' };

  data.notes[idx] = {
    ...data.notes[idx],
    ...parsed.data,
    updatedAt: new Date().toISOString(),
  };

  await saveAppData(data);
  revalidatePath('/');
  return { success: true, note: data.notes[idx] };
}

export async function toggleNotePin(id: string) {
  const data = await getAppData();
  const note = data.notes.find((n) => n.id === id);
  if (!note) return { success: false, error: 'Note not found' };

  note.isPinned = !note.isPinned;
  note.updatedAt = new Date().toISOString();
  await saveAppData(data);
  revalidatePath('/');
  return { success: true, note };
}

export async function deleteNote(id: string) {
  const data = await getAppData();
  data.notes = data.notes.filter((n) => n.id !== id);
  await saveAppData(data);
  revalidatePath('/');
  return { success: true };
}

// RESET TO STARTER DATA
export async function resetDatabase() {
  await resetAppData();
  revalidatePath('/');
  return { success: true };
}

// BATCH IMPORT ROUTINE & SEMESTER PRESET
export async function importExtractedRoutine(
  slots: ExtractedRoutineSlot[],
  replaceExisting: boolean = false,
  semesterName?: string
) {
  if (!slots || slots.length === 0) {
    return { success: false, error: 'No routine slots provided to import.' };
  }

  const data = await getAppData();

  if (semesterName) {
    const curSem = data.semesters.find((s) => s.isCurrent) || data.semesters[0];
    if (curSem) {
      curSem.name = semesterName;
    }
  }

  const colorPalette = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#f97316', // orange
  ];

  let addedCoursesCount = 0;

  const courseCodeMap = new Map<string, string>();
  data.courses.forEach((c) => {
    courseCodeMap.set(c.code.toUpperCase().replace(/\s+/g, ''), c.id);
  });

  for (const slot of slots) {
    const normCode = slot.courseCode.toUpperCase().replace(/\s+/g, '');
    if (!courseCodeMap.has(normCode)) {
      const newCourseId = uniqueId('course');
      const assignedColor = colorPalette[data.courses.length % colorPalette.length];
      const newCourse: Course = {
        id: newCourseId,
        code: slot.courseCode.toUpperCase().trim(),
        name: slot.courseName || slot.courseCode,
        credit: slot.credit || (slot.courseName.toLowerCase().includes('lab') ? 1.5 : 3.0),
        faculty: slot.faculty || 'Faculty TBA',
        room: slot.room || 'Room TBA',
        section: 'A',
        semesterId: data.semesters.find((s) => s.isCurrent)?.id || 'sem-current',
        color: assignedColor,
      };

      data.courses.push(newCourse);
      data.attendance.push({
        id: uniqueId('att'),
        courseId: newCourseId,
        totalClasses: 0,
        attended: 0,
        missed: 0,
        requiredPercentage: 75,
        logs: [],
      });

      courseCodeMap.set(normCode, newCourseId);
      addedCoursesCount++;
    }
  }

  if (replaceExisting) {
    data.routine = [];
  }

  let addedSlotsCount = 0;
  for (const slot of slots) {
    const normCode = slot.courseCode.toUpperCase().replace(/\s+/g, '');
    const courseId = courseCodeMap.get(normCode);
    if (courseId) {
      data.routine.push({
        id: uniqueId('rot'),
        courseId,
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        faculty: slot.faculty || '',
        room: slot.room || '',
        mode: slot.mode || 'On Campus',
        notes: slot.notes || '',
      });
      addedSlotsCount++;
    }
  }

  await saveAppData(data);
  revalidatePath('/');
  return {
    success: true,
    addedSlotsCount,
    addedCoursesCount,
  };
}

// The official Semester 1 routine: five periods on Friday, two online periods
// on Saturday evening. The SPL and Physics-II labs reuse their parent subject's
// code so the import matches the existing five courses instead of creating
// duplicate lab courses.
export async function applyCurrentSemesterPreset() {
  const presetSlots: ExtractedRoutineSlot[] = [
    { day: 'Friday', courseCode: 'MAT 0541 1203', courseName: 'Mathematics-II', credit: 3, startTime: '08:30', endTime: '10:30', room: 'Room 701', faculty: 'RS', mode: 'On Campus' },
    { day: 'Friday', courseCode: 'CSE 0613 1203', courseName: 'Structured Programming Language', credit: 3, startTime: '10:30', endTime: '12:00', room: 'Room 704', faculty: 'MRC', mode: 'On Campus', notes: 'Theory' },
    { day: 'Friday', courseCode: 'CSE 0613 1203', courseName: 'Structured Programming Language', credit: 3, startTime: '12:00', endTime: '13:30', room: 'Room 704', faculty: 'MRC', mode: 'On Campus', notes: 'Lab' },
    { day: 'Friday', courseCode: 'PHY 0533 1203', courseName: 'Physics-II', credit: 3, startTime: '14:45', endTime: '16:45', room: 'Room 701', faculty: 'NAJ', mode: 'On Campus', notes: 'Theory' },
    { day: 'Friday', courseCode: 'PHY 0533 1203', courseName: 'Physics-II', credit: 3, startTime: '16:45', endTime: '18:45', room: 'Physics Lab (JR)', faculty: 'NAJ', mode: 'On Campus', notes: 'Lab' },
    { day: 'Saturday', courseCode: 'ENG 0231 1201', courseName: 'English-II, Language Composition', credit: 3, startTime: '19:00', endTime: '21:00', faculty: 'TS', mode: 'Online' },
    { day: 'Saturday', courseCode: 'CSE 0613 1205', courseName: 'Discrete Mathematics', credit: 3, startTime: '21:00', endTime: '23:00', faculty: 'HP', mode: 'Online' },
  ];

  return importExtractedRoutine(presetSlots, true, 'Semester 1 (1st Semester - Spring 2026)');
}
