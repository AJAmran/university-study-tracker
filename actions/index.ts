'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAppData, resetAppData, withTransaction, createSnapshot, restoreSnapshot } from '@/lib/db';
import type { QueryResultRow } from 'pg';
import { Course, RoutineSlot, TaskItem, CourseAttendance, Assessment, MaterialItem, NoteItem, ExtractedRoutineSlot } from '@/types';

/**
 * OPERATIONAL MODEL (post race-fix):
 *
 * Every mutation below is a targeted SQL statement (or a short sequence) inside
 * ONE Postgres transaction. Row locks (`SELECT ... FOR UPDATE`) serialize
 * concurrent writers, so the old read-everything → rewrite-everything lost-update
 * race is gone, and a single task-toggle no longer TRUNCATEs + re-inserts the
 * whole database.
 *
 * Only bulk operations (reset / restore / routine import) touch many rows, and
 * they too run in a single transaction.
 */

// Monotonic counter + random suffix disambiguate IDs generated within the same
// millisecond, including across serverless instances (per-process counters alone
// can collide there, and a PK conflict would fail the whole transaction).
let idSequence = 0;
function uniqueId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${Date.now()}-${idSequence}-${Math.random().toString(36).slice(2, 8)}`;
}

function isUniqueViolation(e: unknown): boolean {
  return (e as { code?: string })?.code === '23505';
}

function nowIso(): string {
  return new Date().toISOString();
}

function localDateIso(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Validates a client-supplied YYYY-MM-DD calendar date; null when invalid. */
function validClientDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? v : null;
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// -- Row mappers (numeric columns come back as strings from pg) --

function mapCourse(r: QueryResultRow): Course {
  return {
    id: r.id, code: r.code, name: r.name, credit: toNum(r.credit),
    faculty: r.faculty ?? '', room: r.room ?? '', section: r.section ?? '',
    semesterId: r.semester_id ?? '', color: r.color ?? '#3b82f6', notes: r.notes ?? '',
  };
}

function mapRoutine(r: QueryResultRow): RoutineSlot {
  return {
    id: r.id, courseId: r.course_id, day: r.day, startTime: r.start_time, endTime: r.end_time,
    faculty: r.faculty ?? '', room: r.room ?? '', mode: r.mode ?? 'On Campus', notes: r.notes ?? '',
  };
}

function mapTask(r: QueryResultRow): TaskItem {
  return {
    id: r.id, title: r.title, courseId: r.course_id, type: r.type ?? 'Other',
    priority: r.priority ?? 'Medium', status: r.status ?? 'Not Started', dueDate: r.due_date,
    dueTime: r.due_time ?? undefined, description: r.description ?? '', notes: r.notes ?? '',
    completedAt: r.completed_at ?? undefined,
  };
}

function mapAttendance(r: QueryResultRow): CourseAttendance {
  return {
    id: r.id, courseId: r.course_id, totalClasses: toNum(r.total_classes),
    attended: toNum(r.attended), missed: toNum(r.missed),
    requiredPercentage: toNum(r.required_percentage, 75), logs: [],
  };
}

function mapAssessment(r: QueryResultRow): Assessment {
  return {
    id: r.id, courseId: r.course_id, title: r.title, category: r.category ?? 'Other',
    maxMarks: toNum(r.max_marks), obtainedMarks: toNum(r.obtained_marks),
    weightPercent: toNum(r.weight_percent),
  };
}

function mapMaterial(r: QueryResultRow): MaterialItem {
  return {
    id: r.id, title: r.title, courseId: r.course_id, type: r.type ?? 'PDF', url: r.url ?? '',
    tags: r.tags ?? [], description: r.description ?? '', isFavorite: Boolean(r.is_favorite),
    createdAt: r.created_at ?? nowIso(),
  };
}

function mapNote(r: QueryResultRow): NoteItem {
  return {
    id: r.id, title: r.title, courseId: r.course_id, topic: r.topic ?? '',
    taskId: r.task_id ?? undefined, content: r.content ?? '', tags: r.tags ?? [],
    isPinned: Boolean(r.is_pinned), updatedAt: r.updated_at ?? nowIso(),
  };
}

// Zod schemas
const CourseSchema = z.object({
  code: z.string().min(1, 'Course code is required'),
  name: z.string().min(1, 'Course name is required'),
  credit: z.coerce.number().min(0.5).max(10),
  faculty: z.string().default(''),
  room: z.string().default(''),
  section: z.string().default('A'),
  semesterId: z.string().default('sem-1'),
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
}).refine((v) => v.startTime !== v.endTime, { message: 'Start and end time must differ', path: ['endTime'] })
  .refine((v) => v.endTime > v.startTime, { message: 'End time must be after start time', path: ['endTime'] });

const TaskSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  courseId: z.string().min(1, 'Course is required'),
  type: z.enum(['Homework', 'Assignment', 'CT', 'Exam', 'Quiz', 'Presentation', 'Project', 'Lab', 'Report', 'Other']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  status: z.enum(['Not Started', 'In Progress', 'Completed']).default('Not Started'),
  dueDate: z.string().min(1, 'Due date is required').refine((v) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [y, m, d] = v.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
    }
    return !Number.isNaN(new Date(v).getTime());
  }, 'Invalid due date'),
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
}).refine((v) => v.obtainedMarks <= v.maxMarks, { message: 'Obtained marks cannot exceed max marks', path: ['obtainedMarks'] });

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
  url: z.string().min(1, 'URL or location is required').refine((v) => {
    if (/^https?:\/\//i.test(v)) {
      try { new URL(v); return true; } catch { return false; }
    }
    // Allow local labels like "Room 701 handout" / file paths, but block javascript:/data: XSS vectors
    return !/^\s*(javascript|data|vbscript)\s*:/i.test(v);
  }, 'Invalid URL'),
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
export async function createCourse(formData: unknown): Promise<{ success: boolean; error?: string; course?: Course }> {
  const parsed = CourseSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const course = await withTransaction(async (client) => {
      // Resolve semester: given -> current -> first, so courses are never orphaned
      const sems = await client.query(`select id, is_current from semesters`);
      const semesterId = sems.rows.find((r: QueryResultRow) => r.id === parsed.data.semesterId)?.id
        ?? sems.rows.find((r: QueryResultRow) => r.is_current)?.id
        ?? sems.rows[0]?.id
        ?? null;
      const id = uniqueId('course');
      const attId = uniqueId('att');
      const { rows } = await client.query(
        `insert into courses (id, code, name, credit, faculty, room, section, semester_id, color, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
        [
          id, parsed.data.code.trim(), parsed.data.name, parsed.data.credit,
          parsed.data.faculty ?? '', parsed.data.room ?? '', parsed.data.section ?? 'A',
          semesterId, parsed.data.color ?? '#3b82f6', parsed.data.notes ?? '',
        ]
      );
      // Auto-init attendance for the new course
      await client.query(
        `insert into attendance (id, course_id, total_classes, attended, missed, required_percentage)
         values ($1,$2,0,0,0,75)`,
        [attId, id]
      );
      return mapCourse(rows[0]);
    });
    revalidatePath('/');
    return { success: true, course };
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { success: false, error: `Course code "${parsed.data.code.trim()}" already exists` };
    }
    console.error('createCourse failed:', e);
    return { success: false, error: 'Failed to save course. Please try again.' };
  }
}

export async function updateCourse(id: string, formData: unknown): Promise<{ success: boolean; error?: string; course?: Course }> {
  const parsed = CourseSchema.partial().safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }
  if (parsed.data && Object.keys(parsed.data).length === 0) {
    return { success: false, error: 'Nothing to update' };
  }

  const colMap: Record<string, string> = {
    code: 'code', name: 'name', credit: 'credit', faculty: 'faculty', room: 'room',
    section: 'section', semesterId: 'semester_id', color: 'color', notes: 'notes',
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined || !colMap[k]) continue;
    vals.push(k === 'code' && typeof v === 'string' ? v.trim() : v);
    sets.push(`${colMap[k]} = $${vals.length}`);
  }
  if (sets.length === 0) return { success: false, error: 'Nothing to update' };

  try {
    const course = await withTransaction(async (client) => {
      vals.push(id);
      const { rows, rowCount } = await client.query(
        `update courses set ${sets.join(', ')} where id = $${vals.length} returning *`
      );
      if (!rowCount) throw new Error('COURSE_NOT_FOUND');
      return mapCourse(rows[0]);
    });
    revalidatePath('/');
    return { success: true, course };
  } catch (e) {
    if (e instanceof Error && e.message === 'COURSE_NOT_FOUND') {
      return { success: false, error: 'Course not found' };
    }
    if (isUniqueViolation(e)) {
      return { success: false, error: 'That course code is already used by another course' };
    }
    if ((e as { code?: string })?.code === '23503') {
      return { success: false, error: 'Selected semester does not exist' };
    }
    console.error('updateCourse failed:', e);
    return { success: false, error: 'Failed to update course. Please try again.' };
  }
}

export async function deleteCourse(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await withTransaction(async (client) => {
      const found = await client.query(`select code from courses where id = $1`, [id]);
      // Auto-backup before a catastrophic wipe so it can be undone.
      if (found.rowCount) {
        const data = await getAppData();
        const { snapshots: _omit, ...payload } = data;
        await client.query(
          `insert into snapshots (id, label, created_at, payload) values ($1,$2,$3,$4)`,
          [
            uniqueId('snap'),
            `pre-delete ${found.rows[0].code} ${localDateIso()}`,
            nowIso(),
            JSON.stringify(payload),
          ]
        );
      }
      await client.query(`delete from routine where course_id = $1`, [id]);
      await client.query(`delete from tasks where course_id = $1`, [id]);
      await client.query(`delete from attendance where course_id = $1`, [id]); // logs cascade
      await client.query(`delete from assessments where course_id = $1`, [id]);
      await client.query(`delete from materials where course_id = $1`, [id]);
      await client.query(`delete from notes where course_id = $1`, [id]);
      await client.query(`delete from courses where id = $1`, [id]);
    });
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('deleteCourse failed:', e);
    return { success: false, error: 'Failed to delete course. Please try again.' };
  }
}

// ROUTINE MUTATIONS
export async function createRoutineSlot(formData: unknown): Promise<{ success: boolean; error?: string; slot?: RoutineSlot }> {
  const parsed = RoutineSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const slot = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into routine (id, course_id, day, start_time, end_time, faculty, room, mode, notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [
          uniqueId('rot'), parsed.data.courseId, parsed.data.day, parsed.data.startTime,
          parsed.data.endTime, parsed.data.faculty ?? '', parsed.data.room ?? '',
          parsed.data.mode, parsed.data.notes ?? '',
        ]
      );
      return mapRoutine(rows[0]);
    });
    revalidatePath('/');
    return { success: true, slot };
  } catch (e) {
    console.error('createRoutineSlot failed:', e);
    return { success: false, error: 'Failed to save class. Please try again.' };
  }
}

export async function deleteRoutineSlot(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await withTransaction(async (client) => {
      await client.query(`delete from routine where id = $1`, [id]);
    });
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('deleteRoutineSlot failed:', e);
    return { success: false, error: 'Failed to remove class. Please try again.' };
  }
}

// TASK MUTATIONS
export async function createTask(formData: unknown): Promise<{ success: boolean; error?: string; task?: TaskItem }> {
  const parsed = TaskSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const task = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into tasks (id, title, course_id, type, priority, status, due_date, due_time, description, notes, completed_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
        [
          uniqueId('task'), parsed.data.title, parsed.data.courseId, parsed.data.type,
          parsed.data.priority, parsed.data.status, parsed.data.dueDate,
          parsed.data.dueTime || null, parsed.data.description ?? '', parsed.data.notes ?? '',
          null,
        ]
      );
      return mapTask(rows[0]);
    });
    revalidatePath('/');
    return { success: true, task };
  } catch (e) {
    console.error('createTask failed:', e);
    return { success: false, error: 'Failed to save task. Please try again.' };
  }
}

export async function toggleTaskComplete(id: string): Promise<{ success: boolean; error?: string; task?: TaskItem }> {
  try {
    const task = await withTransaction(async (client) => {
      // Single-statement flip: atomic, no read-modify-write race.
      const { rows, rowCount } = await client.query(
        `update tasks
         set status = case when status = 'Completed' then 'In Progress' else 'Completed' end,
             completed_at = case when status = 'Completed' then null else $2 end
         where id = $1 returning *`,
        [id, nowIso()]
      );
      if (!rowCount) throw new Error('TASK_NOT_FOUND');
      return mapTask(rows[0]);
    });
    revalidatePath('/');
    return { success: true, task };
  } catch (e) {
    if (e instanceof Error && e.message === 'TASK_NOT_FOUND') {
      return { success: false, error: 'Task not found' };
    }
    console.error('toggleTaskComplete failed:', e);
    return { success: false, error: 'Failed to update task. Please try again.' };
  }
}

export async function deleteTask(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await withTransaction(async (client) => {
      await client.query(`delete from tasks where id = $1`, [id]);
      // Clear dangling note references to the deleted task
      await client.query(`update notes set task_id = null where task_id = $1`, [id]);
    });
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('deleteTask failed:', e);
    return { success: false, error: 'Failed to delete task. Please try again.' };
  }
}

// ATTENDANCE MUTATIONS
const MAX_LOGS_PER_COURSE = 500;

export async function recordAttendance(
  courseId: string,
  status: 'present' | 'absent',
  date?: string
): Promise<{ success: boolean; attendance?: CourseAttendance; error?: string }> {
  if (!courseId || typeof courseId !== 'string') {
    return { success: false, error: 'Course is required' };
  }
  if (status !== 'present' && status !== 'absent') {
    return { success: false, error: 'Invalid attendance status' };
  }
  // Prefer the client-supplied calendar date (user timezone); the hosting
  // server may run in a different timezone (often UTC).
  const logDate = validClientDate(date) ?? localDateIso();

  try {
    const attendance = await withTransaction(async (client) => {
      const course = await client.query(`select 1 from courses where id = $1`, [courseId]);
      if (!course.rowCount) throw new Error('COURSE_NOT_FOUND');

      // Lock the row for the duration of the transaction: concurrent taps
      // serialize here instead of lost-updating each other.
      const att = await client.query(`select * from attendance where course_id = $1 for update`, [courseId]);
      let attId: string;
      if (!att.rowCount) {
        attId = uniqueId('att');
        await client.query(
          `insert into attendance (id, course_id, total_classes, attended, missed, required_percentage)
           values ($1,$2,0,0,0,75)`,
          [attId, courseId]
        );
      } else {
        attId = att.rows[0].id;
      }

      const { rows } = await client.query(
        `update attendance
         set total_classes = total_classes + 1,
             attended = attended + case when $2 = 'present' then 1 else 0 end,
             missed = missed + case when $2 = 'absent' then 1 else 0 end
         where id = $1 returning *`,
        [attId, status]
      );
      await client.query(
        `insert into attendance_logs (id, attendance_id, date, status, note) values ($1,$2,$3,$4,'')`,
        [uniqueId('log'), attId, logDate, status]
      );
      // Bound log growth: a course tapped daily for years stays fast to read/write.
      await client.query(
        `delete from attendance_logs where attendance_id = $1 and id not in (
           select id from attendance_logs where attendance_id = $1 order by date desc, id desc limit $2
         )`,
        [attId, MAX_LOGS_PER_COURSE]
      );
      return mapAttendance(rows[0]);
    });
    revalidatePath('/');
    return { success: true, attendance };
  } catch (e) {
    if (e instanceof Error && e.message === 'COURSE_NOT_FOUND') {
      return { success: false, error: 'Course not found' };
    }
    console.error('recordAttendance failed:', e);
    return { success: false, error: 'Failed to record attendance. Please try again.' };
  }
}

export async function updateAttendanceTarget(courseId: string, requiredPercentage: number): Promise<{ success: boolean; error?: string }> {
  const pct = Math.round(Number(requiredPercentage));
  if (!Number.isFinite(pct)) {
    return { success: false, error: 'Invalid target percentage' };
  }
  try {
    const { rowCount } = await withTransaction(async (client) => {
      return client.query(
        `update attendance set required_percentage = $2 where course_id = $1`,
        [courseId, Math.max(1, Math.min(100, pct))]
      );
    });
    if (!rowCount) return { success: false, error: 'Attendance record not found' };
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('updateAttendanceTarget failed:', e);
    return { success: false, error: 'Failed to update target. Please try again.' };
  }
}

// ASSESSMENT & MARKS MUTATIONS
export async function addAssessment(formData: unknown): Promise<{ success: boolean; error?: string; assessment?: Assessment }> {
  const parsed = AssessmentSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const assessment = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into assessments (id, course_id, title, category, max_marks, obtained_marks, weight_percent)
         values ($1,$2,$3,$4,$5,$6,$7) returning *`,
        [
          uniqueId('ass'), parsed.data.courseId, parsed.data.title, parsed.data.category,
          parsed.data.maxMarks, parsed.data.obtainedMarks, parsed.data.weightPercent,
        ]
      );
      return mapAssessment(rows[0]);
    });
    revalidatePath('/');
    return { success: true, assessment };
  } catch (e) {
    console.error('addAssessment failed:', e);
    return { success: false, error: 'Failed to save mark. Please try again.' };
  }
}

export async function deleteAssessment(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await withTransaction(async (client) => {
      await client.query(`delete from assessments where id = $1`, [id]);
    });
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('deleteAssessment failed:', e);
    return { success: false, error: 'Failed to delete mark. Please try again.' };
  }
}

// MATERIALS MUTATIONS
export async function createMaterial(formData: unknown): Promise<{ success: boolean; error?: string; material?: MaterialItem }> {
  const parsed = MaterialSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const material = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into materials (id, title, course_id, type, url, tags, description, is_favorite, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [
          uniqueId('mat'), parsed.data.title, parsed.data.courseId, parsed.data.type,
          parsed.data.url, parsed.data.tags, parsed.data.description ?? '', false, nowIso(),
        ]
      );
      return mapMaterial(rows[0]);
    });
    revalidatePath('/');
    return { success: true, material };
  } catch (e) {
    console.error('createMaterial failed:', e);
    return { success: false, error: 'Failed to save material. Please try again.' };
  }
}

export async function toggleMaterialFavorite(id: string): Promise<{ success: boolean; error?: string; material?: MaterialItem }> {
  try {
    const material = await withTransaction(async (client) => {
      const { rows, rowCount } = await client.query(
        `update materials set is_favorite = not is_favorite where id = $1 returning *`,
        [id]
      );
      if (!rowCount) throw new Error('MATERIAL_NOT_FOUND');
      return mapMaterial(rows[0]);
    });
    revalidatePath('/');
    return { success: true, material };
  } catch (e) {
    if (e instanceof Error && e.message === 'MATERIAL_NOT_FOUND') {
      return { success: false, error: 'Not found' };
    }
    console.error('toggleMaterialFavorite failed:', e);
    return { success: false, error: 'Failed to update. Please try again.' };
  }
}

export async function deleteMaterial(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await withTransaction(async (client) => {
      await client.query(`delete from materials where id = $1`, [id]);
    });
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('deleteMaterial failed:', e);
    return { success: false, error: 'Failed to delete material. Please try again.' };
  }
}

// NOTES MUTATIONS
export async function createNote(formData: unknown): Promise<{ success: boolean; error?: string; note?: NoteItem }> {
  const parsed = NoteSchema.safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  try {
    const note = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `insert into notes (id, title, course_id, topic, task_id, content, tags, is_pinned, updated_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
        [
          uniqueId('note'), parsed.data.title, parsed.data.courseId, parsed.data.topic ?? '',
          parsed.data.taskId || null, parsed.data.content ?? '', parsed.data.tags,
          parsed.data.isPinned ?? false, nowIso(),
        ]
      );
      return mapNote(rows[0]);
    });
    revalidatePath('/');
    return { success: true, note };
  } catch (e) {
    console.error('createNote failed:', e);
    return { success: false, error: 'Failed to save note. Please try again.' };
  }
}

export async function updateNote(id: string, formData: unknown): Promise<{ success: boolean; error?: string; note?: NoteItem }> {
  const parsed = NoteSchema.partial().safeParse(formData);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message };
  }

  const colMap: Record<string, string> = {
    title: 'title', courseId: 'course_id', topic: 'topic', taskId: 'task_id',
    content: 'content', tags: 'tags', isPinned: 'is_pinned',
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined || !colMap[k]) continue;
    vals.push(v);
    sets.push(`${colMap[k]} = $${vals.length}`);
  }
  if (sets.length === 0) return { success: false, error: 'Nothing to update' };
  vals.push(nowIso());
  sets.push(`updated_at = $${vals.length}`);
  vals.push(id);

  try {
    const note = await withTransaction(async (client) => {
      const { rows, rowCount } = await client.query(
        `update notes set ${sets.join(', ')} where id = $${vals.length} returning *`
      );
      if (!rowCount) throw new Error('NOTE_NOT_FOUND');
      return mapNote(rows[0]);
    });
    revalidatePath('/');
    return { success: true, note };
  } catch (e) {
    if (e instanceof Error && e.message === 'NOTE_NOT_FOUND') {
      return { success: false, error: 'Note not found' };
    }
    console.error('updateNote failed:', e);
    return { success: false, error: 'Failed to save note. Please try again.' };
  }
}

export async function toggleNotePin(id: string): Promise<{ success: boolean; error?: string; note?: NoteItem }> {
  try {
    const note = await withTransaction(async (client) => {
      const { rows, rowCount } = await client.query(
        `update notes set is_pinned = not is_pinned, updated_at = $2 where id = $1 returning *`,
        [id, nowIso()]
      );
      if (!rowCount) throw new Error('NOTE_NOT_FOUND');
      return mapNote(rows[0]);
    });
    revalidatePath('/');
    return { success: true, note };
  } catch (e) {
    if (e instanceof Error && e.message === 'NOTE_NOT_FOUND') {
      return { success: false, error: 'Note not found' };
    }
    console.error('toggleNotePin failed:', e);
    return { success: false, error: 'Failed to pin note. Please try again.' };
  }
}

export async function deleteNote(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await withTransaction(async (client) => {
      await client.query(`delete from notes where id = $1`, [id]);
    });
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('deleteNote failed:', e);
    return { success: false, error: 'Failed to delete note. Please try again.' };
  }
}

// RESET TO STARTER DATA
export async function resetDatabase() {
  try {
    await createSnapshot(`pre-reset ${localDateIso()}`);
    await resetAppData();
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('resetDatabase failed:', e);
    return { success: false, error: 'Reset failed. Your data was not touched.' };
  }
}

// BACKUPS (undo for catastrophic wipes)
export async function backupNow(label?: string) {
  try {
    const snap = await createSnapshot(
      (typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : `manual ${localDateIso()}`)
    );
    revalidatePath('/');
    return { success: true, snapshot: snap };
  } catch (e) {
    console.error('backupNow failed:', e);
    return { success: false, error: 'Backup failed. Please try again.' };
  }
}

export async function restoreBackup(id: string) {
  if (!id || typeof id !== 'string') {
    return { success: false, error: 'Backup is required' };
  }
  try {
    await restoreSnapshot(id);
    revalidatePath('/');
    return { success: true };
  } catch (e) {
    console.error('restoreBackup failed:', e);
    return { success: false, error: e instanceof Error ? e.message : 'Restore failed. Please try again.' };
  }
}

// BATCH IMPORT ROUTINE & SEMESTER PRESET
export async function importExtractedRoutine(
  slots: ExtractedRoutineSlot[],
  replaceExisting: boolean = false,
  semesterName?: string
): Promise<
  | { success: false; error: string }
  | { success: true; addedSlotsCount: number; addedCoursesCount: number }
> {
  if (!slots || slots.length === 0) {
    return { success: false, error: 'No routine slots provided to import.' };
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

  try {
    const result = await withTransaction(async (client) => {
      const sems = await client.query(`select id, is_current from semesters`);
      const defaultSemId = sems.rows.find((r: QueryResultRow) => r.is_current)?.id ?? sems.rows[0]?.id ?? null;
      if (semesterName) {
        const curId = sems.rows.find((r: QueryResultRow) => r.is_current)?.id ?? sems.rows[0]?.id;
        if (curId) {
          await client.query(`update semesters set name = $2 where id = $1`, [curId, semesterName]);
        }
      }

      const existing = await client.query(`select id, code from courses`);
      const courseCodeMap = new Map<string, string>();
      existing.rows.forEach((c: QueryResultRow) => {
        courseCodeMap.set(String(c.code).toUpperCase().replace(/\s+/g, ''), c.id);
      });
      let courseCount = existing.rowCount ?? 0;
      let addedCoursesCount = 0;

      for (const slot of slots) {
        if (!slot || typeof slot.courseCode !== 'string' || !slot.courseCode.trim()) continue;
        const normCode = slot.courseCode.toUpperCase().replace(/\s+/g, '');
        if (!courseCodeMap.has(normCode)) {
          const newCourseId = uniqueId('course');
          const courseName = (slot.courseName || slot.courseCode || 'Course').toString();
          try {
            await client.query(
              `insert into courses (id, code, name, credit, faculty, room, section, semester_id, color, notes)
               values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [
                newCourseId, slot.courseCode.toUpperCase().trim(), courseName,
                slot.credit || (courseName.toLowerCase().includes('lab') ? 1.5 : 3.0),
                slot.faculty || 'Faculty TBA', slot.room || 'Room TBA', 'A', defaultSemId,
                colorPalette[courseCount % colorPalette.length], '',
              ]
            );
          } catch (e) {
            // Lost a concurrent-insert race: another request created this code
            // first. Re-read its id and carry on instead of failing the import.
            if (!isUniqueViolation(e)) throw e;
            const again = await client.query(`select id from courses where code = $1`, [slot.courseCode.toUpperCase().trim()]);
            if (!again.rowCount) throw e;
            courseCodeMap.set(normCode, again.rows[0].id);
            continue;
          }
          await client.query(
            `insert into attendance (id, course_id, total_classes, attended, missed, required_percentage)
             values ($1,$2,0,0,0,75)`,
            [uniqueId('att'), newCourseId]
          );
          courseCodeMap.set(normCode, newCourseId);
          courseCount++;
          addedCoursesCount++;
        }
      }

      if (replaceExisting) {
        await client.query(`delete from routine`);
      }

      const validDays = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
      const validModes = new Set(['On Campus', 'Online', 'Hybrid']);
      const timeRe = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      let addedSlotsCount = 0;
      for (const slot of slots) {
        if (!slot || typeof slot.courseCode !== 'string') continue;
        const normCode = slot.courseCode.toUpperCase().replace(/\s+/g, '');
        const courseId = courseCodeMap.get(normCode);
        if (!courseId) continue;
        if (!validDays.has(slot.day)) continue;
        if (!timeRe.test(slot.startTime || '') || !timeRe.test(slot.endTime || '')) continue;
        if (slot.startTime >= slot.endTime) continue;
        await client.query(
          `insert into routine (id, course_id, day, start_time, end_time, faculty, room, mode, notes)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            uniqueId('rot'), courseId, slot.day, slot.startTime, slot.endTime,
            slot.faculty || '', slot.room || '',
            validModes.has(slot.mode as string) ? slot.mode : 'On Campus', slot.notes || '',
          ]
        );
        addedSlotsCount++;
      }
      if (addedSlotsCount === 0) {
        throw new Error('No valid routine slots found to import.');
      }
      return { addedSlotsCount, addedCoursesCount };
    });
    revalidatePath('/');
    return { success: true, ...result };
  } catch (e) {
    if (e instanceof Error && e.message === 'No valid routine slots found to import.') {
      return { success: false, error: e.message };
    }
    console.error('importExtractedRoutine failed:', e);
    return { success: false, error: 'Import failed. Your routine was not changed.' };
  }
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

