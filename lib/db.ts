import { Pool, PoolClient } from 'pg';
import {
  AppData,
  Course,
  RoutineSlot,
  TaskItem,
  CourseAttendance,
  AttendanceLog,
  Assessment,
  MaterialItem,
  NoteItem,
  Semester,
  SnapshotMeta,
} from '@/types';

/**
 * Storage layer backed by PostgreSQL (Neon).
 *
 * The exported functions keep the same read-modify-write contract the server
 * actions already rely on, so no component or action had to change shape:
 *
 *   const data = await getAppData();
 *   data.courses.push(course);
 *   await saveAppData(data);
 *
 * `saveAppData` replaces the full contents inside one transaction, which matches
 * the previous whole-file write semantics exactly: anything absent from the
 * object passed in is gone afterwards.
 */

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

function readConnectionString(): string {
  const url = process.env.DATABASE_URL || process.env.DBURL;
  if (!url) {
    throw new Error(
      'No database connection string found. Set DATABASE_URL in .env.local (DBURL is also accepted).'
    );
  }
  return url;
}

/**
 * Neon requires TLS. `pg` 8.23 treats an `sslmode` in the URL as verify-full and
 * warns loudly, and `channel_binding` is a libpq-only parameter it cannot parse.
 * Both are stripped here and TLS is requested explicitly instead.
 *
 * Certificates ARE verified by default (Neon presents publicly-trusted certs and
 * Node ships the CA bundle). Only set DB_SSL_INSECURE=true on networks/hosts
 * where verification is impossible — that re-opens MITM exposure.
 */
function buildPoolConfig() {
  const raw = readConnectionString();
  let cleaned = raw;
  try {
    const u = new URL(raw);
    u.searchParams.delete('channel_binding');
    // Keep sslmode for information but pg handles TLS via `ssl` below;
    // strip it to avoid the verify-full warning, preserving other params.
    u.searchParams.delete('sslmode');
    cleaned = u.toString();
  } catch {
    // Fallback for non-standard URLs: strip params textually and clean dangling separators
    cleaned = raw
      .replace(/[?&]channel_binding=[^&]*/gi, '')
      .replace(/[?&]sslmode=[^&]*/gi, '')
      .replace(/\?&/, '?')
      .replace(/[?&]$/, '');
  }

  return {
    connectionString: cleaned,
    ssl: process.env.DB_SSL_INSECURE === 'true' ? { rejectUnauthorized: false } : { rejectUnauthorized: true },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Fail fast on runaway statements instead of hanging the request; Neon
    // cold-start wake-ups surface here as a retryable error, not a hang.
    statement_timeout: 20_000,
  };
}

// Cached on globalThis so Next.js hot reloads in dev do not open a new pool on
// every edit, which would exhaust Neon's connection limit.
const globalForDb = globalThis as unknown as { __unimasterPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__unimasterPool) {
    globalForDb.__unimasterPool = new Pool(buildPoolConfig());
    // An idle client erroring out (Neon suspending the compute) must not take the
    // process down; the next query will simply open a fresh connection.
    globalForDb.__unimasterPool.on('error', (err) => {
      console.error('Unexpected Postgres pool error:', err.message);
    });
  }
  return globalForDb.__unimasterPool;
}

async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_STATEMENTS = [
  `create table if not exists semesters (
     id            text primary key,
     name          text not null,
     is_current    boolean not null default false,
     target_gpa    numeric(4,2) not null default 3.90
   )`,

  `create table if not exists courses (
     id            text primary key,
     code          text not null unique,
     name          text not null,
     credit        numeric(4,2) not null default 3,
     faculty       text not null default '',
     room          text not null default '',
     section       text not null default '',
     semester_id   text references semesters(id) on delete set null,
     color         text not null default '#3b82f6',
     notes         text not null default ''
   )`,

  // No foreign keys on course_id: the actions let a record be created against a
  // course id that no longer exists (for example a task saved while offline), and
  // an enforced constraint would turn that into a hard insert failure.
  `create table if not exists routine (
     id            text primary key,
     course_id     text not null,
     day           text not null,
     start_time    text not null,
     end_time      text not null,
     faculty       text not null default '',
     room          text not null default '',
     mode          text not null default 'On Campus',
     notes         text not null default ''
   )`,

  `create table if not exists tasks (
     id            text primary key,
     title         text not null,
     course_id     text not null,
     type          text not null default 'Other',
     priority      text not null default 'Medium',
     status        text not null default 'Not Started',
     due_date      text not null,
     due_time      text,
     description   text not null default '',
     notes         text not null default '',
     completed_at  text
   )`,

  `create table if not exists attendance (
     id                   text primary key,
     course_id            text not null,
     total_classes        integer not null default 0,
     attended             integer not null default 0,
     missed               integer not null default 0,
     required_percentage  integer not null default 75
   )`,

  // Logs are a growing per-tap history. Stored as rows so the list stays queryable
  // instead of being re-serialized into one growing JSON value on every save.
  `create table if not exists attendance_logs (
     id             text primary key,
     attendance_id  text not null references attendance(id) on delete cascade,
     date           text not null,
     status         text not null,
     note           text not null default ''
   )`,

  `create table if not exists assessments (
     id              text primary key,
     course_id       text not null,
     title           text not null,
     category        text not null default 'Other',
     max_marks       numeric(8,2) not null default 0,
     obtained_marks  numeric(8,2) not null default 0,
     weight_percent  numeric(6,2) not null default 0
   )`,

  `create table if not exists materials (
     id            text primary key,
     title         text not null,
     course_id     text not null,
     type          text not null default 'PDF',
     url           text not null default '',
     tags          text[] not null default '{}',
     description   text not null default '',
     is_favorite   boolean not null default false,
     created_at    text not null
   )`,

  `create table if not exists notes (
     id            text primary key,
     title         text not null,
     course_id     text not null,
     topic         text not null default '',
     task_id       text,
     content       text not null default '',
     tags          text[] not null default '{}',
     is_pinned     boolean not null default false,
     updated_at    text not null
   )`,

  `create index if not exists idx_routine_course on routine(course_id)`,
  `create index if not exists idx_tasks_course on tasks(course_id)`,
  `create index if not exists idx_tasks_due on tasks(due_date)`,
  `create index if not exists idx_attendance_course on attendance(course_id)`,
  `create index if not exists idx_logs_attendance on attendance_logs(attendance_id)`,
  `create index if not exists idx_assessments_course on assessments(course_id)`,
  `create index if not exists idx_materials_course on materials(course_id)`,
  `create index if not exists idx_notes_course on notes(course_id)`,

  // Backup snapshots for undoing catastrophic wipes (reset / delete-course).
  // Deliberately NOT part of ALL_TABLES: snapshots must survive truncates.
  `create table if not exists snapshots (
     id            text primary key,
     label         text not null,
     created_at    text not null,
     payload       jsonb not null
   )`,
  `create index if not exists idx_snapshots_created on snapshots(created_at desc)`,
];

// All tables this app owns, in dependency order. Truncated together on save.
const ALL_TABLES = [
  'attendance_logs',
  'attendance',
  'routine',
  'tasks',
  'assessments',
  'materials',
  'notes',
  'courses',
  'semesters',
];

async function runSchema(client: PoolClient): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await client.query(statement);
  }
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

// Semester 1, transcribed from the official class routine sheet: five subjects
// across seven weekly periods. The SPL and Physics-II labs are separate periods
// but belong to their parent subject, not separate courses.
//
// Note: three subjects carry a "-II" suffix (Mathematics-II, Physics-II,
// English-II) even though this is the student's first semester. That is how the
// department printed them, so the names are kept verbatim.
const SEED_SEMESTER: Semester = {
  id: 'sem-1',
  name: 'Semester 1 (1st Semester - Spring 2026)',
  isCurrent: true,
  targetGPA: 3.90,
};

// Course codes keep the section number the department published (1201, 1203,
// 1205). Discrete Mathematics shares the CSE 0613 prefix with Structured
// Programming but sits in section 1205, so the full code stays unique.
const SEED_COURSES: Course[] = [
  {
    id: 'course-301',
    code: 'MAT 0541 1203',
    name: 'Mathematics-II',
    credit: 3,
    faculty: 'RS',
    room: 'Room 701',
    section: '1203',
    semesterId: 'sem-1',
    color: '#8b5cf6',
    notes: 'Friday 08:30-10:30, Room 701. Add your syllabus units and formula sheet links here as the term goes on.',
  },
  {
    id: 'course-302',
    code: 'CSE 0613 1203',
    name: 'Structured Programming Language',
    credit: 3,
    faculty: 'MRC',
    room: 'Room 704',
    section: '1203',
    semesterId: 'sem-1',
    color: '#3b82f6',
    notes: 'Friday 10:30-12:00 theory, Room 704, then 12:00-13:30 lab in the same room. The lab is graded separately, so log its marks as a Lab-category assessment.',
  },
  {
    id: 'course-303',
    code: 'PHY 0533 1203',
    name: 'Physics-II',
    credit: 3,
    faculty: 'NAJ',
    room: 'Room 701',
    section: '1203',
    semesterId: 'sem-1',
    color: '#f59e0b',
    notes: 'Friday 14:45-16:45 theory in Room 701, then 16:45-18:45 lab in Physics Lab (JR). The lab is graded separately.',
  },
  {
    id: 'course-304',
    code: 'ENG 0231 1201',
    name: 'English-II, Language Composition',
    credit: 3,
    faculty: 'TS',
    room: '',
    section: '1201',
    semesterId: 'sem-1',
    color: '#ec4899',
    notes: 'Saturday 19:00-21:00, online. No room assigned on the official routine.',
  },
  {
    id: 'course-305',
    code: 'CSE 0613 1205',
    name: 'Discrete Mathematics',
    credit: 3,
    faculty: 'HP',
    room: '',
    section: '1205',
    semesterId: 'sem-1',
    color: '#10b981',
    notes: 'Saturday 21:00-23:00, online. Listed under the same CSE 0613 prefix as Structured Programming but a different section, so it is tracked as its own subject.',
  },
];

// As printed on the routine sheet: five periods on Friday, two online periods on
// Saturday evening. Nothing is scheduled Sunday through Thursday.
const SEED_ROUTINE: RoutineSlot[] = [
  { id: 'rot-301', courseId: 'course-301', day: 'Friday', startTime: '08:30', endTime: '10:30', faculty: 'RS', room: 'Room 701', mode: 'On Campus', notes: 'Mathematics-II' },
  { id: 'rot-302', courseId: 'course-302', day: 'Friday', startTime: '10:30', endTime: '12:00', faculty: 'MRC', room: 'Room 704', mode: 'On Campus', notes: 'Structured Programming Language - theory' },
  { id: 'rot-303', courseId: 'course-302', day: 'Friday', startTime: '12:00', endTime: '13:30', faculty: 'MRC', room: 'Room 704', mode: 'On Campus', notes: 'Structured Programming Language - lab. Bring your pending lab report.' },
  { id: 'rot-304', courseId: 'course-303', day: 'Friday', startTime: '14:45', endTime: '16:45', faculty: 'NAJ', room: 'Room 701', mode: 'On Campus', notes: 'Physics-II - theory' },
  { id: 'rot-305', courseId: 'course-303', day: 'Friday', startTime: '16:45', endTime: '18:45', faculty: 'NAJ', room: 'Physics Lab (JR)', mode: 'On Campus', notes: 'Physics-II - lab, Physics Lab (JR).' },
  { id: 'rot-306', courseId: 'course-304', day: 'Saturday', startTime: '19:00', endTime: '21:00', faculty: 'TS', room: '', mode: 'Online', notes: 'English-II, Language Composition. Online session.' },
  { id: 'rot-307', courseId: 'course-305', day: 'Saturday', startTime: '21:00', endTime: '23:00', faculty: 'HP', room: '', mode: 'Online', notes: 'Discrete Mathematics. Online session.' },
];

function seedData(): AppData {
  return {
    semesters: [SEED_SEMESTER],
    courses: SEED_COURSES,
    routine: SEED_ROUTINE,
    tasks: [],
    // One attendance row per course so the tracker shows the right percentage and
    // "bunkable classes" math immediately. Counts start at zero for a new term.
    attendance: SEED_COURSES.map((course, index) => ({
      id: `att-30${index + 1}`,
      courseId: course.id,
      totalClasses: 0,
      attended: 0,
      missed: 0,
      requiredPercentage: 75,
    })),
    assessments: [],
    materials: [],
    notes: [],
  };
}

// ---------------------------------------------------------------------------
// Migration guard
// ---------------------------------------------------------------------------

const globalForMigration = globalThis as unknown as { __unimasterReady?: Promise<void> };

/**
 * Creates the schema on first use and seeds the starter semester when the
 * database is completely empty. A database holding at least one course is
 * treated as real user data and is never re-seeded, so this stays safe to call
 * on every request.
 */
async function ensureReady(): Promise<void> {
  if (!globalForMigration.__unimasterReady) {
    globalForMigration.__unimasterReady = (async () => {
      await withClient(async (client) => {
        await runSchema(client);
        const { rows } = await client.query('select count(*)::int as n from courses');
        if (rows[0].n === 0) {
          console.log('[db] Empty database detected, seeding Semester 1 starter data.');
          try {
            await writeAll(client, seedData());
          } catch (err) {
            // Fresh-DB race: two cold instances can both observe zero courses and
            // seed concurrently; the loser hits PK conflicts on the identical seed
            // ids. That just means the other instance won — safe to ignore.
            if ((err as { code?: string })?.code === '23505') {
              console.log('[db] Seed race lost to another instance, continuing.');
              return;
            }
            throw err;
          }
        }
      });
    })().catch((err) => {
      // Clear the cached promise so a later request retries instead of being
      // permanently poisoned by a transient network failure.
      globalForMigration.__unimasterReady = undefined;
      throw err;
    });
  }
  return globalForMigration.__unimasterReady;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function writeAll(client: PoolClient, data: AppData): Promise<void> {
  await client.query(`truncate ${ALL_TABLES.join(', ')} restart identity cascade`);

  // A single course id can legitimately appear in more than one routine slot (the
  // SPL and Physics-II labs share their parent subject), and the UI can duplicate
  // a row. Insert statements are primary-key bound, so duplicates are dropped here
  // rather than aborting the whole transaction.
  const uniqueById = <T extends { id: string }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  };

  // Rows are inserted one statement at a time rather than through a multi-argument
  // unnest. Passing a `text[][]` parameter for the tag columns looks tidier, but pg
  // mis-serializes nested JavaScript arrays into multi-dimensional Postgres arrays
  // ("malformed array literal"), so the flat form below is the reliable one.
  for (const s of uniqueById(data.semesters)) {
    await client.query(
      `insert into semesters (id, name, is_current, target_gpa) values ($1,$2,$3,$4)`,
      [s.id, s.name, Boolean(s.isCurrent), s.targetGPA]
    );
  }

  for (const c of uniqueById(data.courses)) {
    await client.query(
      `insert into courses (id, code, name, credit, faculty, room, section, semester_id, color, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        c.id,
        c.code,
        c.name,
        c.credit,
        c.faculty ?? '',
        c.room ?? '',
        c.section ?? '',
        c.semesterId || null,
        c.color ?? '#3b82f6',
        c.notes ?? '',
      ]
    );
  }

  for (const r of uniqueById(data.routine)) {
    await client.query(
      `insert into routine (id, course_id, day, start_time, end_time, faculty, room, mode, notes)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        r.id,
        r.courseId,
        r.day,
        r.startTime,
        r.endTime,
        r.faculty ?? '',
        r.room ?? '',
        r.mode ?? 'On Campus',
        r.notes ?? '',
      ]
    );
  }

  for (const t of uniqueById(data.tasks)) {
    await client.query(
      `insert into tasks (id, title, course_id, type, priority, status, due_date, due_time, description, notes, completed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        t.id,
        t.title,
        t.courseId,
        t.type ?? 'Other',
        t.priority ?? 'Medium',
        t.status ?? 'Not Started',
        t.dueDate,
        t.dueTime || null,
        t.description ?? '',
        t.notes ?? '',
        t.completedAt || null,
      ]
    );
  }

  for (const a of uniqueById(data.attendance)) {
    await client.query(
      `insert into attendance (id, course_id, total_classes, attended, missed, required_percentage)
       values ($1,$2,$3,$4,$5,$6)`,
      [a.id, a.courseId, a.totalClasses, a.attended, a.missed, a.requiredPercentage ?? 75]
    );
  }

  // Logs carry no course reference of their own, so they are written directly after
  // their parent row to satisfy the foreign key.
  const seenLogIds = new Set<string>();
  for (const a of data.attendance) {
    for (const l of a.logs ?? []) {
      if (seenLogIds.has(l.id)) continue;
      seenLogIds.add(l.id);
      await client.query(
        `insert into attendance_logs (id, attendance_id, date, status, note) values ($1,$2,$3,$4,$5)`,
        [l.id, a.id, l.date, l.status, l.note ?? '']
      );
    }
  }

  for (const a of uniqueById(data.assessments)) {
    await client.query(
      `insert into assessments (id, course_id, title, category, max_marks, obtained_marks, weight_percent)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        a.id,
        a.courseId,
        a.title,
        a.category ?? 'Other',
        a.maxMarks,
        a.obtainedMarks ?? 0,
        a.weightPercent ?? 0,
      ]
    );
  }

  for (const m of uniqueById(data.materials)) {
    await client.query(
      `insert into materials (id, title, course_id, type, url, tags, description, is_favorite, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        m.id,
        m.title,
        m.courseId,
        m.type ?? 'PDF',
        m.url ?? '',
        m.tags ?? [],
        m.description ?? '',
        Boolean(m.isFavorite),
        m.createdAt ?? new Date().toISOString(),
      ]
    );
  }

  for (const n of uniqueById(data.notes)) {
    await client.query(
      `insert into notes (id, title, course_id, topic, task_id, content, tags, is_pinned, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        n.id,
        n.title,
        n.courseId,
        n.topic ?? '',
        n.taskId || null,
        n.content ?? '',
        n.tags ?? [],
        Boolean(n.isPinned),
        n.updatedAt ?? new Date().toISOString(),
      ]
    );
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Postgres `numeric` columns come back as JS strings (e.g. "3.50", "75").
 * Leaving them as strings breaks the math in lib/calculations.ts (lexicographic
 * comparisons like "9" < "75" are true) and the percentage arithmetic. These
 * helpers coerce the columns to real numbers at the read boundary.
 */
function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getAppData(): Promise<AppData> {
  await ensureReady();

  try {
    return await withClient(async (client) => {
      // Run one at a time: a single pg client cannot have more than one query in
      // flight, so Promise.all here would just queue up on the same client anyway.
      const semesters = await client.query('select * from semesters order by name');
      const courses = await client.query('select * from courses order by code');
      const routine = await client.query('select * from routine order by day, start_time');
      const tasks = await client.query(
        "select * from tasks order by due_date, coalesce(due_time, '')"
      );
      const attendance = await client.query('select * from attendance order by id');
      const logs = await client.query('select * from attendance_logs order by date desc, id desc');
      const assessments = await client.query('select * from assessments order by id');
      const materials = await client.query('select * from materials order by created_at desc');
      const notes = await client.query('select * from notes order by updated_at desc');

      // Newest first, matching the previous `logs.unshift(...)` behaviour.
      const logsByParent = new Map<string, AttendanceLog[]>();
      for (const row of logs.rows) {
        const list = logsByParent.get(row.attendance_id) ?? [];
        list.push({ id: row.id, date: row.date, status: row.status, note: row.note });
        logsByParent.set(row.attendance_id, list);
      }

      const snapshots = await client
        .query(`select id, label, created_at from snapshots order by created_at desc limit $1`, [MAX_SNAPSHOTS])
        .then(({ rows: srows }) =>
          srows.map((r): SnapshotMeta => ({ id: r.id, label: r.label, createdAt: r.created_at }))
        )
        .catch(() => [] as SnapshotMeta[]);

      return {
        snapshots,
        semesters: semesters.rows.map(
          (r): Semester => ({
            id: r.id,
            name: r.name,
            isCurrent: r.is_current,
            targetGPA: toNumber(r.target_gpa),
          })
        ),
        courses: courses.rows.map(
          (r): Course => ({
            id: r.id,
            code: r.code,
            name: r.name,
            credit: toNumber(r.credit),
            faculty: r.faculty,
            room: r.room,
            section: r.section,
            semesterId: r.semester_id ?? '',
            color: r.color,
            notes: r.notes,
          })
        ),
        routine: routine.rows.map(
          (r): RoutineSlot => ({
            id: r.id,
            courseId: r.course_id,
            day: r.day,
            startTime: r.start_time,
            endTime: r.end_time,
            faculty: r.faculty,
            room: r.room,
            mode: r.mode,
            notes: r.notes,
          })
        ),
        tasks: tasks.rows.map(
          (r): TaskItem => ({
            id: r.id,
            title: r.title,
            courseId: r.course_id,
            type: r.type,
            priority: r.priority,
            status: r.status,
            dueDate: r.due_date,
            dueTime: r.due_time ?? undefined,
            description: r.description,
            notes: r.notes,
            completedAt: r.completed_at ?? undefined,
          })
        ),
        attendance: attendance.rows.map(
          (r): CourseAttendance => ({
            id: r.id,
            courseId: r.course_id,
            totalClasses: toNumber(r.total_classes),
            attended: toNumber(r.attended),
            missed: toNumber(r.missed),
            requiredPercentage: toNumber(r.required_percentage, 75),
            logs: logsByParent.get(r.id) ?? [],
          })
        ),
        assessments: assessments.rows.map(
          (r): Assessment => ({
            id: r.id,
            courseId: r.course_id,
            title: r.title,
            category: r.category,
            maxMarks: toNumber(r.max_marks),
            obtainedMarks: toNumber(r.obtained_marks),
            weightPercent: toNumber(r.weight_percent),
          })
        ),
        materials: materials.rows.map(
          (r): MaterialItem => ({
            id: r.id,
            title: r.title,
            courseId: r.course_id,
            type: r.type,
            url: r.url,
            tags: r.tags ?? [],
            description: r.description,
            isFavorite: r.is_favorite,
            createdAt: r.created_at,
          })
        ),
        notes: notes.rows.map(
          (r): NoteItem => ({
            id: r.id,
            title: r.title,
            courseId: r.course_id,
            topic: r.topic,
            taskId: r.task_id ?? undefined,
            content: r.content,
            tags: r.tags ?? [],
            isPinned: r.is_pinned,
            updatedAt: r.updated_at,
          })
        ),
      };
    });
  } catch (error) {
    // Let the request fail rather than silently handing the UI empty data, which
    // would look to the student like their work had been deleted.
    console.error('Failed to read from Postgres:', error);
    throw error;
  }
}

export async function saveAppData(data: AppData): Promise<void> {
  await withTransaction(async (client) => {
    await writeAll(client, data);
  }).catch((error) => {
    console.error('Failed to write to Postgres, transaction rolled back:', error);
    throw error;
  });
}

export async function resetAppData(): Promise<AppData> {
  const fresh = seedData();
  await saveAppData(fresh);
  return fresh;
}

/**
 * Runs `fn` inside a single Postgres transaction on one pooled client.
 * This is the primitive that makes targeted mutations race-safe: SELECT ...
 * FOR UPDATE inside `fn` serializes concurrent writers, unlike the old
 * read-everything-then-rewrite-everything pattern.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureReady();
  return withClient(async (client) => {
    try {
      await client.query('begin');
      const result = await fn(client);
      await client.query('commit');
      return result;
    } catch (error) {
      try {
        await client.query('rollback');
      } catch {
        // Rollback itself failing means the connection is already dead;
        // the pool will discard it. Nothing more to do here.
      }
      throw error;
    }
  });
}

// ---------------------------------------------------------------------------
// Backup snapshots (undo for catastrophic wipes)
// ---------------------------------------------------------------------------

const MAX_SNAPSHOTS = 5;

function snapshotId(): string {
  return `snap-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

/** Captures the current full dataset as a restorable snapshot. */
export async function createSnapshot(label: string): Promise<{ id: string; label: string }> {
  const data = await getAppData();
  // Snapshots must not nest: restoring nests would balloon payload size.
  const { snapshots: _omit, ...payload } = data;
  const id = snapshotId();
  const createdAt = new Date().toISOString();
  await withTransaction(async (client) => {
    await client.query(
      `insert into snapshots (id, label, created_at, payload) values ($1,$2,$3,$4)`,
      [id, label, createdAt, JSON.stringify(payload)]
    );
    // Keep only the newest snapshots; old backups are pruned automatically.
    await client.query(
      `delete from snapshots where id not in (
         select id from snapshots order by created_at desc limit $1
       )`,
      [MAX_SNAPSHOTS]
    );
  });
  return { id, label };
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  await ensureReady();
  return withClient(async (client) => {
    const { rows } = await client.query(
      `select id, label, created_at from snapshots order by created_at desc limit $1`,
      [MAX_SNAPSHOTS]
    );
    return rows.map((r): SnapshotMeta => ({ id: r.id, label: r.label, createdAt: r.created_at }));
  });
}

/** Replaces the entire live dataset with a snapshot's payload. */
export async function restoreSnapshot(id: string): Promise<void> {
  await withTransaction(async (client) => {
    const { rows } = await client.query(`select payload from snapshots where id = $1`, [id]);
    if (rows.length === 0) throw new Error('Backup not found');
    const payload = rows[0].payload as AppData;
    if (!payload || !Array.isArray(payload.courses) || !Array.isArray(payload.tasks)) {
      throw new Error('Backup payload is corrupt');
    }
    await writeAll(client, payload);
  });
}
