'use client';

import React from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  Sparkles, 
  BookOpen, 
  ArrowRight,
  TrendingUp,
  MapPin,
  User,
  Plus,
  Flame,
  Award,
  Zap,
  Target,
  Camera
} from 'lucide-react';
import { Course, RoutineSlot, TaskItem, CourseAttendance, Assessment, NoteItem, DayOfWeek } from '@/types';
import { 
  calculateAttendanceStats, 
  calculateSemesterGPA, 
  getTaskUrgency, 
  calculateCourseGrade 
} from '@/lib/calculations';
import { toggleTaskComplete, recordAttendance } from '@/actions';
import { fireConfetti } from '@/lib/confetti';
import { useMounted } from '@/hooks/use-mounted';

type PersonalDashboardProps = {
  courses: Course[];
  routine: RoutineSlot[];
  tasks: TaskItem[];
  attendance: CourseAttendance[];
  assessments: Assessment[];
  notes?: NoteItem[];
  onOpenQuickAdd: (action?: any) => void;
  onNavigateTab: (tab: string) => void;
  onRefresh: () => void;
  onOpenRoutineUpload?: () => void;
};

export function PersonalDashboard({
  courses,
  routine,
  tasks,
  attendance,
  assessments,
  notes = [],
  onOpenQuickAdd,
  onNavigateTab,
  onRefresh,
  onOpenRoutineUpload,
}: PersonalDashboardProps) {
  const mounted = useMounted();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const daysMap: Record<number, DayOfWeek> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };

  const currentDayName: DayOfWeek = mounted ? daysMap[new Date().getDay()] : 'Monday';
  const currentTimeStr = mounted
    ? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    : '';

  // Filter today's classes
  const todayClasses = routine
    .filter((slot) => slot.day === currentDayName)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Find currently active class and next upcoming class today
  let currentClass: RoutineSlot | null = null;
  let nextClass: RoutineSlot | null = null;

  if (currentTimeStr) {
    for (const slot of todayClasses) {
      if (currentTimeStr >= slot.startTime && currentTimeStr <= slot.endTime) {
        currentClass = slot;
      } else if (currentTimeStr < slot.startTime && !nextClass) {
        nextClass = slot;
      }
    }
  }

  // Calculate Academic Overview (GPA, credits, warnings)
  const gpaStats = calculateSemesterGPA(courses, assessments);

  // Attendance stats for each course
  const attendanceWithStats = courses.map((course) => {
    const att = attendance.find((a) => a.courseId === course.id) || {
      id: '',
      courseId: course.id,
      totalClasses: 0,
      attended: 0,
      missed: 0,
      requiredPercentage: 75,
    };
    return {
      course,
      att,
      stats: calculateAttendanceStats(att),
    };
  });

  const warnings = attendanceWithStats.filter((item) => item.stats.isWarning && item.att.totalClasses > 0);

  // Group tasks by urgency
  const pendingTasks = tasks.filter((t) => t.status !== 'Completed');
  const overdueTasks: TaskItem[] = [];
  const todayTasks: TaskItem[] = [];
  const tomorrowTasks: TaskItem[] = [];
  const thisWeekTasks: TaskItem[] = [];
  const laterTasks: TaskItem[] = [];

  pendingTasks.forEach((t) => {
    const urgency = getTaskUrgency(t);
    if (urgency.category === 'overdue') overdueTasks.push(t);
    else if (urgency.category === 'today') todayTasks.push(t);
    else if (urgency.category === 'tomorrow') tomorrowTasks.push(t);
    else if (urgency.category === 'this_week') thisWeekTasks.push(t);
    else laterTasks.push(t);
  });

  // GPA is only meaningful once at least one assessment mark has been entered.
  const hasAnyMarks = assessments.some((a) => a.obtainedMarks > 0);

  // Most recently updated pinned note, if the student has any.
  const pinnedNote = notes
    .filter((n) => n.isPinned)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const handleToggleTask = async (taskId: string) => {
    const res = await toggleTaskComplete(taskId);
    if (res.success && res.task?.status === 'Completed') {
      fireConfetti();
    }
    onRefresh();
  };

  const handleQuickAttend = async (courseId: string, status: 'present' | 'absent') => {
    await recordAttendance(courseId, status);
    onRefresh();
  };

  return (
    <div className="space-y-5">
      {/* 1. TOP HERO: What do I need to know right now? */}
      <div className="rounded-2xl border border-blue-100 bg-linear-to-br from-blue-50/80 via-white to-indigo-50/50 p-4 sm:p-5 shadow-xs dark:border-blue-950/40 dark:from-blue-950/20 dark:via-zinc-900 dark:to-indigo-950/20">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span suppressHydrationWarning className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                Command Center • {currentDayName}
              </span>
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Welcome back! Here is your academic focus.
            </h1>
            <p suppressHydrationWarning className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
              {todayClasses.length} {todayClasses.length === 1 ? 'class' : 'classes'} scheduled today •{' '}
              {todayTasks.length + overdueTasks.length} urgent {todayTasks.length + overdueTasks.length === 1 ? 'item' : 'items'} due
            </p>
          </div>

          {/* Quick Action Buttons Row (Mobile thumb-friendly) */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
            {onOpenRoutineUpload && (
              <button
                onClick={onOpenRoutineUpload}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-3 py-2 text-xs font-bold text-white shadow-xs transition-all"
                title="Upload or scan your class routine"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Upload Routine</span>
              </button>
            )}
            <button
              onClick={() => onOpenQuickAdd('task')}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ Task / CT</span>
            </button>
            <button
              onClick={() => onOpenQuickAdd('attendance')}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 active:scale-95 px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              <span>+ Attendance</span>
            </button>
            <button
              onClick={() => onOpenQuickAdd('mark')}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 active:scale-95 px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all"
            >
              <span>+ Mark</span>
            </button>
          </div>
        </div>

        {/* CURRENT & NEXT CLASS HIGHLIGHT CARDS */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Current Class Card */}
          <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-white p-3.5 shadow-xs dark:border-blue-900/60 dark:bg-zinc-900/90">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <Clock className="h-3.5 w-3.5" />
                {currentClass ? 'Class in Session' : 'Current Status'}
              </span>
              {currentClass && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {currentClass.startTime} – {currentClass.endTime}
                </span>
              )}
            </div>

            {currentClass ? (
              <div className="mt-2">
                {(() => {
                  const course = courses.find((c) => c.id === currentClass?.courseId);
                  return (
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                          {course?.code} — {course?.name}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-zinc-400" />
                          {currentClass.room || course?.room || 'Room TBA'}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-zinc-400" />
                          {currentClass.faculty || course?.faculty || 'Faculty TBA'}
                        </span>
                        <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold">
                          {currentClass.mode}
                        </span>
                      </div>
                      {/* 1-tap quick attendance log right here */}
                      <div className="mt-2.5 flex items-center gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-2">
                        <span className="text-[11px] text-zinc-500">Record attendance:</span>
                        <button
                          onClick={() => handleQuickAttend(currentClass!.courseId, 'present')}
                          className="rounded-md bg-emerald-500 hover:bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-semibold"
                        >
                          + Attended
                        </button>
                        <button
                          onClick={() => handleQuickAttend(currentClass!.courseId, 'absent')}
                          className="rounded-md bg-zinc-200 dark:bg-zinc-700 hover:bg-rose-500 hover:text-white px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300"
                        >
                          + Absent
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                No class is taking place at this exact moment.
              </div>
            )}
          </div>

          {/* Next Class Card */}
          <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-3.5 shadow-xs dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                <Calendar className="h-3.5 w-3.5" />
                Up Next Today
              </span>
              {nextClass && (
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                  {nextClass.startTime} – {nextClass.endTime}
                </span>
              )}
            </div>

            {nextClass ? (
              <div className="mt-2">
                {(() => {
                  const course = courses.find((c) => c.id === nextClass?.courseId);
                  return (
                    <div>
                      <div className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                        {course?.code} — {course?.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-zinc-400" />
                          {nextClass.room || course?.room || 'Room TBA'}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-zinc-400" />
                          {nextClass.faculty || course?.faculty}
                        </span>
                      </div>
                      {nextClass.notes && (
                        <p className="mt-1 text-[11px] text-zinc-500 italic">
                          &ldquo;{nextClass.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="mt-2 py-1 text-xs text-zinc-500 dark:text-zinc-400">
                {todayClasses.length > 0
                  ? 'All scheduled classes for today are complete! Great job.'
                  : 'No classes on the schedule for today.'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. ATTENDANCE WARNING ALERT BANNER (If any course < 75%) */}
      {warnings.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-xs font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider">
                Low Attendance Alert ({warnings.length} {warnings.length === 1 ? 'course' : 'courses'} below 75%)
              </h2>
              <div className="mt-1.5 space-y-1.5">
                {warnings.map(({ course, att, stats }) => (
                  <div key={course.id} className="flex flex-wrap items-center justify-between gap-1 text-xs text-rose-900 dark:text-rose-200">
                    <div>
                      <span className="font-bold">{course.code}</span>: current is{' '}
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {stats.percentage}%
                      </span>{' '}
                      ({att.attended}/{att.totalClasses} classes).
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded-md">
                        {stats.statusText}
                      </span>
                      <button
                        onClick={() => handleQuickAttend(course.id, 'present')}
                        className="rounded-md bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 text-[10px] font-bold"
                      >
                        + Log Present
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={() => onNavigateTab('attendance')}
              className="text-xs font-semibold text-rose-700 dark:text-rose-300 hover:underline shrink-0"
            >
              Manage
            </button>
          </div>
        </div>
      )}

      {/* Pinned Note Shortcut */}
      {pinnedNote && (
        <button
          type="button"
          onClick={() => onNavigateTab('notes')}
          className="w-full text-left cursor-pointer rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50/80 via-white to-teal-50/50 p-3.5 shadow-2xs hover:border-emerald-400 dark:border-emerald-900/60 dark:from-emerald-950/20 dark:via-zinc-900 dark:to-teal-950/20 transition-all flex items-center justify-between gap-2.5 active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {pinnedNote.title}
                </span>
                <span className="rounded bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                  Pinned
                </span>
              </div>
              {pinnedNote.topic && (
                <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {pinnedNote.topic}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
            <span className="hidden xs:inline">Open Notes</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>
      )}

      {/* 3. STAT METRICS CARDS: GPA, Tasks Due, Next Exam */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {/* Semester GPA */}
        <button
          type="button"
          onClick={() => onNavigateTab('grades')}
          className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-xs hover:border-blue-400 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 transition-all"
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Current GPA</span>
            <Award className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {hasAnyMarks ? gpaStats.gpa.toFixed(2) : '--'}
            </span>
            <span className="text-xs text-zinc-400">/ 4.00</span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500 flex items-center gap-1">
            {hasAnyMarks ? (
              <>
                <TrendingUp className="h-3 w-3 text-emerald-500" />
                <span>Predicted: {gpaStats.predictedGPA.toFixed(2)}</span>
              </>
            ) : (
              <span>Add marks to see your GPA</span>
            )}
          </div>
        </button>

        {/* Urgent Deadlines Count */}
        <button
          type="button"
          onClick={() => onNavigateTab('tasks')}
          className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-xs hover:border-amber-400 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 transition-all"
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Urgent Tasks</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {overdueTasks.length + todayTasks.length + tomorrowTasks.length}
            </span>
            <span className="text-xs text-zinc-400">pending</span>
          </div>
          <div className="mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
            {overdueTasks.length > 0
              ? `${overdueTasks.length} overdue!`
              : pendingTasks.length === 0
              ? 'Nothing due yet'
              : 'Due today/tomorrow'}
          </div>
        </button>

        {/* Enrolled Courses */}
        <button
          type="button"
          onClick={() => onNavigateTab('courses')}
          className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 text-left shadow-xs hover:border-indigo-400 active:scale-[0.99] dark:border-zinc-800 dark:bg-zinc-900 transition-all"
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Courses</span>
            <BookOpen className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100">
              {courses.length}
            </span>
            <span className="text-xs text-zinc-400">courses</span>
          </div>
          <div className="mt-1 text-[10px] text-zinc-500">
            {gpaStats.totalCredits} Total Credits
          </div>
        </button>

        {/* AI Study Assistant Shortcut */}
        <button
          type="button"
          onClick={() => onNavigateTab('ai')}
          className="cursor-pointer rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-left shadow-xs hover:border-indigo-500 active:scale-[0.99] dark:border-indigo-900/60 dark:bg-indigo-950/20 transition-all"
        >
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">AI Study</span>
            <Sparkles className="h-4 w-4 animate-spin text-indigo-600" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Flashcards & Quiz
            </span>
          </div>
          <div className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
            <span>Instant Prep</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        </button>
      </div>

      {/* 4. MAIN TWO-COLUMN SECTION: Today's Routine Timeline & Urgent Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Today's Routine Timeline (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <h2 suppressHydrationWarning className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Today&apos;s Class Schedule ({currentDayName})
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('routine')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              Full Routine
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          {todayClasses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <Calendar className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                No classes scheduled for {currentDayName}
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Use this free time for assignment prep or revision!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayClasses.map((slot) => {
                const course = courses.find((c) => c.id === slot.courseId);
                const isOngoing = currentTimeStr >= slot.startTime && currentTimeStr <= slot.endTime;
                const isPast = currentTimeStr > slot.endTime;

                return (
                  <div
                    key={slot.id}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${
                      isOngoing
                        ? 'border-blue-500 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/40 ring-1 ring-blue-500'
                        : isPast
                        ? 'border-zinc-200 bg-zinc-50/50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/40'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
                    }`}
                  >
                    {/* Time slot column */}
                    <div className="w-20 shrink-0 text-center">
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                        {slot.startTime}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {slot.endTime}
                      </div>
                      {isOngoing && (
                        <span className="mt-1 inline-block rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          NOW
                        </span>
                      )}
                    </div>

                    {/* Class info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span 
                          className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate"
                          style={{ color: course?.color }}
                        >
                          {course?.code} — {course?.name}
                        </span>
                        <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {slot.mode}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span>Room: {slot.room || course?.room || 'TBA'}</span>
                        <span>•</span>
                        <span>{slot.faculty || course?.faculty}</span>
                      </div>

                      {slot.notes && (
                        <div className="mt-1 text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                          {slot.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Deadlines & Tasks (Urgency sorted: Overdue -> Today -> Tomorrow -> This Week) */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Action Items & Deadlines
              </h2>
            </div>
            <button
              onClick={() => onNavigateTab('tasks')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
            >
              All Tasks ({pendingTasks.length})
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-2">
            {/* OVERDUE SECTION IF ANY */}
            {overdueTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Overdue
                </div>
                {overdueTasks.map((task) => (
                  <TaskCardItem 
                    key={task.id} 
                    task={task} 
                    courses={courses} 
                    onToggle={handleToggleTask} 
                  />
                ))}
              </div>
            )}

            {/* DUE TODAY */}
            {todayTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Due Today
                </div>
                {todayTasks.map((task) => (
                  <TaskCardItem 
                    key={task.id} 
                    task={task} 
                    courses={courses} 
                    onToggle={handleToggleTask} 
                  />
                ))}
              </div>
            )}

            {/* DUE TOMORROW */}
            {tomorrowTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Due Tomorrow
                </div>
                {tomorrowTasks.map((task) => (
                  <TaskCardItem 
                    key={task.id} 
                    task={task} 
                    courses={courses} 
                    onToggle={handleToggleTask} 
                  />
                ))}
              </div>
            )}

            {/* THIS WEEK */}
            {thisWeekTasks.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Coming Up This Week
                </div>
                {thisWeekTasks.map((task) => (
                  <TaskCardItem 
                    key={task.id} 
                    task={task} 
                    courses={courses} 
                    onToggle={handleToggleTask} 
                  />
                ))}
              </div>
            )}

            {pendingTasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                <p className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  All caught up! No pending assignments or CTs.
                </p>
                <button
                  onClick={() => onOpenQuickAdd('task')}
                  className="mt-2 text-xs text-blue-600 hover:underline font-semibold"
                >
                  + Add an upcoming exam or homework
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. COURSE ATTENDANCE & GRADE PROGRESS SNAPSHOT */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Academic Course Health Snapshot
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('courses')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
          >
            All Courses
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {courses.map((course) => {
            const att = attendance.find((a) => a.courseId === course.id) || {
              id: '',
              courseId: course.id,
              totalClasses: 0,
              attended: 0,
              missed: 0,
              requiredPercentage: 75,
            };
            const attStats = calculateAttendanceStats(att);
            const gradeStats = calculateCourseGrade(course.id, assessments);

            return (
              <div
                key={course.id}
                className="rounded-xl border border-zinc-200 p-3 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/60 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                    {course.code}
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-500">
                    {course.credit} Credits
                  </span>
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                  {course.name}
                </div>

                {/* Attendance mini-bar */}
                <div className="mt-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-500">Attendance:</span>
                    <span
                      className={`font-bold ${
                        attStats.isWarning
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {attStats.percentage}% ({att.attended}/{att.totalClasses})
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        attStats.isWarning ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, attStats.percentage)}%` }}
                    />
                  </div>
                </div>

                {/* Grade mini status */}
                <div className="mt-2 flex items-center justify-between text-[10px] border-t border-zinc-100 dark:border-zinc-800 pt-1.5">
                  <span className="text-zinc-500">Current Grade:</span>
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">
                    {gradeStats.assessmentsCount > 0
                      ? `${gradeStats.gradeInfo.letter} (${gradeStats.currentPercentage}%)`
                      : 'Not Evaluated'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TaskCardItem({
  task,
  courses,
  onToggle,
}: {
  task: TaskItem;
  courses: Course[];
  onToggle: (id: string) => void;
}) {
  const course = courses.find((c) => c.id === task.courseId);
  const urgency = getTaskUrgency(task);

  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-white p-2.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 transition-all hover:border-zinc-300">
      <button
        onClick={() => onToggle(task.id)}
        className="mt-0.5 text-zinc-400 hover:text-emerald-600 transition-colors shrink-0"
        title="Mark complete"
      >
        <Circle className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
            {task.title}
          </span>
          <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${urgency.badgeColor}`}>
            {urgency.badgeLabel}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            {course?.code || 'Course'}
          </span>
          <span>•</span>
          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1 py-0.2">
            {task.type}
          </span>
          {task.priority === 'Urgent' && (
            <span className="font-bold text-rose-600 dark:text-rose-400">
              URGENT
            </span>
          )}
          {task.dueTime && <span>at {task.dueTime}</span>}
        </div>
      </div>
    </div>
  );
}
