'use client';

import React, { useEffect, useState } from 'react';
import { 
  X, 
  CheckSquare, 
  Calendar, 
  UserCheck, 
  Award, 
  FolderGit2, 
  FileText,
  Plus
} from 'lucide-react';
import { Course, DayOfWeek, TaskType, Priority, ClassMode, AssessmentCategory, MaterialType } from '@/types';
import { 
  createTask, 
  createRoutineSlot, 
  recordAttendance, 
  addAssessment, 
  createMaterial, 
  createNote 
} from '@/actions';
import { todayLocalDate } from '@/hooks/use-busy';

type QuickActionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  onRefresh: () => void;
  initialAction?: 'task' | 'routine' | 'attendance' | 'mark' | 'material' | 'note';
};

export function QuickActionModal({
  isOpen,
  onClose,
  courses,
  onRefresh,
  initialAction = 'task',
}: QuickActionModalProps) {
  const [activeType, setActiveType] = useState<
    'task' | 'routine' | 'attendance' | 'mark' | 'material' | 'note'
  >(initialAction);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form states for Task
  const [taskTitle, setTaskTitle] = useState('');
  const [taskCourseId, setTaskCourseId] = useState(courses[0]?.id || '');
  const [taskType, setTaskType] = useState<TaskType>('Assignment');
  const [taskPriority, setTaskPriority] = useState<Priority>('High');
  const localToday = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  };
  const [taskDueDate, setTaskDueDate] = useState(localToday());
  const [taskDueTime, setTaskDueTime] = useState('23:59');
  const [taskDesc, setTaskDesc] = useState('');

  // Form states for Routine Slot
  const [rotCourseId, setRotCourseId] = useState(courses[0]?.id || '');
  const [rotDay, setRotDay] = useState<DayOfWeek>('Monday');
  const [rotStartTime, setRotStartTime] = useState('09:00');
  const [rotEndTime, setRotEndTime] = useState('10:30');
  const [rotRoom, setRotRoom] = useState('');
  const [rotFaculty, setRotFaculty] = useState('');
  const [rotMode, setRotMode] = useState<ClassMode>('On Campus');

  // Form states for Attendance
  const [attCourseId, setAttCourseId] = useState(courses[0]?.id || '');
  const [attStatus, setAttStatus] = useState<'present' | 'absent'>('present');

  // Form states for Assessment / Mark
  const [assCourseId, setAssCourseId] = useState(courses[0]?.id || '');
  const [assTitle, setAssTitle] = useState('');
  const [assCategory, setAssCategory] = useState<AssessmentCategory>('CT');
  const [assMaxMarks, setAssMaxMarks] = useState('20');
  const [assObtainedMarks, setAssObtainedMarks] = useState('18');
  const [assWeight, setAssWeight] = useState('15');

  // Form states for Material
  const [matTitle, setMatTitle] = useState('');
  const [matCourseId, setMatCourseId] = useState(courses[0]?.id || '');
  const [matType, setMatType] = useState<MaterialType>('PDF');
  const [matUrl, setMatUrl] = useState('');
  const [matTags, setMatTags] = useState('');
  const [matDesc, setMatDesc] = useState('');

  // Form states for Note
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCourseId, setNoteCourseId] = useState(courses[0]?.id || '');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Sync when reopened with a different action or when courses load
  useEffect(() => {
    if (isOpen) {
      setActiveType(initialAction);
      setErrorMsg('');
      const first = courses[0]?.id || '';
      setTaskCourseId((v) => v || first);
      setRotCourseId((v) => v || first);
      setAttCourseId((v) => v || first);
      setAssCourseId((v) => v || first);
      setMatCourseId((v) => v || first);
      setNoteCourseId((v) => v || first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialAction]);

  // Lock background scroll + Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const resetForms = () => {
    setTaskTitle(''); setTaskDesc('');
    setAssTitle('');
    setMatTitle(''); setMatUrl(''); setMatTags(''); setMatDesc('');
    setNoteTitle(''); setNoteTopic(''); setNoteContent('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // re-entrancy guard: ignore double-Enter/double-tap
    if (courses.length === 0) {
      setErrorMsg('Add a course first before creating entries.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      if (activeType === 'task') {
        if (!taskTitle.trim()) throw new Error('Task title is required');
        const res = await createTask({
          title: taskTitle,
          courseId: taskCourseId || courses[0]?.id,
          type: taskType,
          priority: taskPriority,
          status: 'Not Started',
          dueDate: taskDueDate,
          dueTime: taskDueTime,
          description: taskDesc,
        });
        if (!res.success) throw new Error(res.error);
      } else if (activeType === 'routine') {
        if (rotEndTime <= rotStartTime) throw new Error('End time must be after start time');
        const res = await createRoutineSlot({
          courseId: rotCourseId || courses[0]?.id,
          day: rotDay,
          startTime: rotStartTime,
          endTime: rotEndTime,
          room: rotRoom,
          faculty: rotFaculty,
          mode: rotMode,
        });
        if (!res.success) throw new Error(res.error);
      } else if (activeType === 'attendance') {
        const res = await recordAttendance(attCourseId || courses[0]?.id, attStatus, todayLocalDate());
        if (!res.success) throw new Error(res.error);
      } else if (activeType === 'mark') {
        const max = parseFloat(assMaxMarks);
        const obtained = parseFloat(assObtainedMarks);
        if (!Number.isFinite(max) || max < 1) throw new Error('Max marks must be at least 1');
        if (!Number.isFinite(obtained) || obtained < 0 || obtained > max) throw new Error(`Obtained marks must be between 0 and ${max}`);
        const res = await addAssessment({
          courseId: assCourseId || courses[0]?.id,
          title: assTitle,
          category: assCategory,
          maxMarks: max,
          obtainedMarks: obtained,
          weightPercent: parseFloat(assWeight) || 0,
        });
        if (!res.success) throw new Error(res.error);
      } else if (activeType === 'material') {
        if (!matTitle.trim()) throw new Error('Material title is required');
        if (!matUrl.trim()) throw new Error('Resource link is required');
        if (/^\s*(javascript|data|vbscript)\s*:/i.test(matUrl)) throw new Error('Invalid URL');
        const res = await createMaterial({
          title: matTitle,
          courseId: matCourseId || courses[0]?.id,
          type: matType,
          url: matUrl.trim(),
          tags: Array.from(new Set(matTags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 10),
          description: matDesc,
          isFavorite: false,
        });
        if (!res.success) throw new Error(res.error);
      } else if (activeType === 'note') {
        if (!noteTitle.trim()) throw new Error('Note title is required');
        const res = await createNote({
          title: noteTitle,
          courseId: noteCourseId || courses[0]?.id,
          topic: noteTopic,
          content: noteContent,
          tags: [],
          isPinned: false,
        });
        if (!res.success) throw new Error(res.error);
      }

      onRefresh();
      resetForms();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  const actionTabs = [
    { id: 'task', label: 'Task / CT', icon: CheckSquare },
    { id: 'routine', label: 'Class', icon: Calendar },
    { id: 'attendance', label: 'Attendance', icon: UserCheck },
    { id: 'mark', label: 'Mark', icon: Award },
    { id: 'material', label: 'Material', icon: FolderGit2 },
    { id: 'note', label: 'Note', icon: FileText },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/60 sm:p-3 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Quick add">
      <div 
        className="fixed inset-0" 
        onClick={() => { if (!loading) onClose(); }} 
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[92vh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-2xl border border-zinc-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 transition-all">
        {/* Drag handle for the mobile sheet */}
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
              <Plus className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Quick Action
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close quick add"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Type Select Buttons (Touch friendly) */}
        <div className="mt-3 flex overflow-x-auto no-scrollbar gap-1.5 pb-2">
          {actionTabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveType(tab.id as any);
                  setErrorMsg('');
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 p-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {/* TASK FORM */}
          {activeType === 'task' && (
            <>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Task / CT / Exam Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CT-3: Shortest Path Algorithms"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Course *
                  </label>
                  <select
                    value={taskCourseId}
                    onChange={(e) => setTaskCourseId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name.slice(0, 18)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Type *
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="Assignment">Assignment</option>
                    <option value="CT">Class Test (CT)</option>
                    <option value="Exam">Final Exam</option>
                    <option value="Homework">Homework</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Project">Project</option>
                    <option value="Presentation">Presentation</option>
                    <option value="Lab">Lab Report</option>
                    <option value="Report">Report</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={taskDueTime}
                    onChange={(e) => setTaskDueTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description / Topics
                </label>
                <textarea
                  rows={2}
                  placeholder="Details, chapters to study, or submission instructions..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </>
          )}

          {/* ROUTINE SLOT FORM */}
          {activeType === 'routine' && (
            <>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Course *
                </label>
                <select
                  value={rotCourseId}
                  onChange={(e) => setRotCourseId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Day *
                  </label>
                  <select
                    value={rotDay}
                    onChange={(e) => setRotDay(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Start (HH:MM) *
                  </label>
                  <input
                    type="time"
                    required
                    value={rotStartTime}
                    onChange={(e) => setRotStartTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    End (HH:MM) *
                  </label>
                  <input
                    type="time"
                    required
                    value={rotEndTime}
                    onChange={(e) => setRotEndTime(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Room
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lab 402"
                    value={rotRoom}
                    onChange={(e) => setRotRoom(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Faculty
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Robert"
                    value={rotFaculty}
                    onChange={(e) => setRotFaculty(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Mode
                  </label>
                  <select
                    value={rotMode}
                    onChange={(e) => setRotMode(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="On Campus">On Campus</option>
                    <option value="Online">Online</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* ATTENDANCE FORM */}
          {activeType === 'attendance' && (
            <>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Course *
                </label>
                <select
                  value={attCourseId}
                  onChange={(e) => setAttCourseId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Today&apos;s Status *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAttStatus('present')}
                    className={`py-2.5 rounded-lg font-bold border text-center transition-all ${
                      attStatus === 'present'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    Attended (+1 Present)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttStatus('absent')}
                    className={`py-2.5 rounded-lg font-bold border text-center transition-all ${
                      attStatus === 'absent'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    Missed (+1 Absent)
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ASSESSMENT / MARK FORM */}
          {activeType === 'mark' && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Course *
                  </label>
                  <select
                    value={assCourseId}
                    onChange={(e) => setAssCourseId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.name.slice(0, 15)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={assCategory}
                    onChange={(e) => setAssCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="CT">Class Test (CT)</option>
                    <option value="Assignment">Assignment</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Midterm">Midterm</option>
                    <option value="Final">Final Exam</option>
                    <option value="Lab">Lab Report / Viva</option>
                    <option value="Viva">Viva</option>
                    <option value="Presentation">Presentation</option>
                    <option value="Attendance">Attendance Mark</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Title / Assessment Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm Examination / CT-1"
                  value={assTitle}
                  onChange={(e) => setAssTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Obtained *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={assObtainedMarks}
                    onChange={(e) => setAssObtainedMarks(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Max Marks *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={assMaxMarks}
                    onChange={(e) => setAssMaxMarks(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Weight % *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="e.g. 20"
                    value={assWeight}
                    onChange={(e) => setAssWeight(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>
            </>
          )}

          {/* MATERIAL FORM */}
          {activeType === 'material' && (
            <>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Material Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dynamic Programming Lecture Slides (Chapter 14)"
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Course *
                  </label>
                  <select
                    value={matCourseId}
                    onChange={(e) => setMatCourseId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Type *
                  </label>
                  <select
                    value={matType}
                    onChange={(e) => setMatType(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="Lecture Slides">Lecture Slides</option>
                    <option value="Notes">Notes</option>
                    <option value="Handwritten Notes">Handwritten Notes</option>
                    <option value="Google Drive">Google Drive Link</option>
                    <option value="GitHub">GitHub Repository</option>
                    <option value="Video">Video Lecture</option>
                    <option value="Lab Code">Lab Code</option>
                    <option value="Assignment">Assignment</option>
                    <option value="External Link">External Link</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Resource Link or File Path *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://drive.google.com/... or https://github.com/..."
                  value={matUrl}
                  onChange={(e) => setMatUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="algorithms, graphs, mid-prep"
                  value={matTags}
                  onChange={(e) => setMatTags(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </>
          )}

          {/* NOTE FORM */}
          {activeType === 'note' && (
            <>
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Note Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Theorem Key Formulas & Exceptions"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Course *
                  </label>
                  <select
                    value={noteCourseId}
                    onChange={(e) => setNoteCourseId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Asymptotic Notation"
                    value={noteTopic}
                    onChange={(e) => setNoteTopic(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Content (Markdown supported)
                </label>
                <textarea
                  rows={4}
                  placeholder="Write your quick notes, formulas, or bullet points here..."
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white p-2.5 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-mono"
                />
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{loading ? 'Saving...' : 'Save Entry'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
