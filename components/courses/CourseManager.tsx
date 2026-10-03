'use client';

import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  MapPin,
  User,
  Clock,
  CheckSquare,
  Trash2,
  Edit3,
  FolderGit2,
  History,
  Save,
  X
} from 'lucide-react';
import { Course, CourseAttendance, RoutineSlot, TaskItem, Assessment, MaterialItem, SnapshotMeta } from '@/types';
import { createCourse, updateCourse, deleteCourse, backupNow, restoreBackup } from '@/actions';
import { useBusy } from '@/hooks/use-busy';
import { calculateAttendanceStats, calculateCourseGrade } from '@/lib/calculations';

type CourseManagerProps = {
  courses: Course[];
  routine: RoutineSlot[];
  tasks: TaskItem[];
  attendance: CourseAttendance[];
  assessments: Assessment[];
  materials: MaterialItem[];
  snapshots?: SnapshotMeta[];
  onRefresh: () => void;
};

export function CourseManager({
  courses,
  routine,
  tasks,
  attendance,
  assessments,
  materials,
  snapshots = [],
  onRefresh,
}: CourseManagerProps) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credit, setCredit] = useState('3');
  const [faculty, setFaculty] = useState('');
  const [room, setRoom] = useState('');
  const [section, setSection] = useState('A');
  const [color, setColor] = useState('#3b82f6');
  const [notesText, setNotesText] = useState('');
  const [formError, setFormError] = useState('');

  const openAdd = () => {
    setCode('');
    setName('');
    setCredit('3');
    setFaculty('');
    setRoom('');
    setSection('A');
    setColor('#3b82f6');
    setNotesText('');
    setFormError('');
    setIsAddOpen(true);
  };

  const openEdit = (course: Course) => {
    setSelectedCourse(course);
    setCode(course.code);
    setName(course.name);
    setCredit(String(course.credit));
    setFaculty(course.faculty || '');
    setRoom(course.room || '');
    setSection(course.section || 'A');
    setColor(course.color || '#3b82f6');
    setNotesText(course.notes || '');
    setFormError('');
    setIsEditOpen(true);
  };

  const { run } = useBusy();

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const creditNum = parseFloat(credit);
    if (!Number.isFinite(creditNum) || creditNum < 0.5 || creditNum > 10) {
      setFormError('Credit must be between 0.5 and 10');
      return;
    }
    setFormError('');
    run(async () => {
      try {
        const res = await createCourse({
          code,
          name,
          credit: creditNum,
          faculty,
          room,
          section,
          color,
          notes: notesText,
        });
        if (!res.success) {
          setFormError(res.error || 'Failed to save course');
          return;
        }
        setIsAddOpen(false);
        onRefresh();
      } catch {
        setFormError('Network error. Please check your connection and try again.');
      }
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    const creditNum = parseFloat(credit);
    if (!Number.isFinite(creditNum) || creditNum < 0.5 || creditNum > 10) {
      setFormError('Credit must be between 0.5 and 10');
      return;
    }
    setFormError('');
    run(async () => {
      try {
        const res = await updateCourse(selectedCourse.id, {
          code,
          name,
          credit: creditNum,
          faculty,
          room,
          section,
          color,
          notes: notesText,
        });
        if (!res.success) {
          setFormError(res.error || 'Failed to save course');
          return;
        }
        setIsEditOpen(false);
        onRefresh();
      } catch {
        setFormError('Network error. Please check your connection and try again.');
      }
    });
  };

  const handleDelete = (courseId: string) => {
    if (!confirm('Delete this course and its associated classes, tasks, and marks? A backup is saved automatically and can be restored.')) return;
    run(async () => {
      try {
        const res = await deleteCourse(courseId);
        if (!res.success) {
          alert(res.error || 'Failed to delete course');
          return;
        }
        if (selectedCourse?.id === courseId) setSelectedCourse(null);
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  const latestBackup = snapshots[0];

  const handleBackup = () => run(async () => {
    try {
      const res = await backupNow();
      if (!res.success) {
        alert(res.error || 'Backup failed');
        return;
      }
      onRefresh();
    } catch {
      alert('Network error. Please check your connection and try again.');
    }
  });

  const handleRestore = () => {
    if (!latestBackup) {
      alert('No backup available yet.');
      return;
    }
    if (!confirm(`Restore backup "${latestBackup.label}"? Your current data will be replaced (a pre-restore backup is saved automatically).`)) return;
    run(async () => {
      try {
        const pre = await backupNow();
        if (!pre.success) {
          alert(pre.error || 'Could not create safety backup. Restore cancelled.');
          return;
        }
        const res = await restoreBackup(latestBackup.id);
        if (!res.success) {
          alert(res.error || 'Restore failed');
          return;
        }
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  const colorOptions = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Course Management
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {courses.length} enrolled university courses • Connected with routine, grades, and materials
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBackup}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 active:scale-95 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all"
            title="Save a restorable backup of all your data"
          >
            <Save className="h-4 w-4" />
            <span>Backup</span>
          </button>
          <button
            onClick={handleRestore}
            disabled={!latestBackup}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 active:scale-95 px-3 py-2 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-all disabled:opacity-40"
            title={latestBackup ? `Restore backup from ${new Date(latestBackup.createdAt).toLocaleString()}` : 'No backup available yet'}
          >
            <History className="h-4 w-4" />
            <span>Restore</span>
          </button>
          <button
            onClick={openAdd}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add New Course</span>
          </button>
        </div>
      </div>
      {latestBackup && (
        <p className="text-[11px] text-zinc-400">
          Latest backup: {latestBackup.label} • {(() => { const d = new Date(latestBackup.createdAt); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(); })()}
        </p>
      )}

      {/* Courses Cards Grid */}
      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <BookOpen className="mx-auto h-8 w-8 text-zinc-400" />
          <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">No courses yet</p>
          <p className="text-xs text-zinc-500 mt-1">Add your first course to build your routine, tasks and GPA tracking.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {courses.map((course) => {
          const courseRoutine = routine.filter((r) => r.courseId === course.id);
          const courseTasks = tasks.filter((t) => t.courseId === course.id && t.status !== 'Completed');
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
          const courseMaterials = materials.filter((m) => m.courseId === course.id);

          return (
            <div
              key={course.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Course Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: course.color || '#3b82f6' }}
                    />
                    <span className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                      {course.code}
                    </span>
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      Sec {course.section || 'A'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {course.credit} Cr
                    </span>
                    <button
                      onClick={() => openEdit(course)}
                      className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="Edit Course"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(course.id)}
                      className="p-1 text-zinc-400 hover:text-rose-500"
                      title="Delete Course"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <h2 className="mt-1 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {course.name}
                </h2>

                {/* Faculty & Room */}
                <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-zinc-400" />
                    {course.faculty || 'Faculty TBA'}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                    {course.room || 'Room TBA'}
                  </span>
                </div>

                {course.notes && (
                  <p className="mt-2 text-[11px] text-zinc-500 italic line-clamp-2">
                    {course.notes}
                  </p>
                )}

                {/* Micro Stats Grid */}
                <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs border-t border-zinc-100 dark:border-zinc-800 pt-2.5">
                  <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 font-medium">Attendance</span>
                    <div className="mt-0.5 flex items-baseline justify-between">
                      <span className={`font-bold ${attStats.isWarning ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {attStats.percentage}%
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {att.attended}/{att.totalClasses}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-zinc-50 p-2 dark:bg-zinc-800/60">
                    <span className="text-[10px] text-zinc-400 font-medium">Current Grade</span>
                    <div className="mt-0.5 flex items-baseline justify-between">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {gradeStats.assessmentsCount > 0 ? gradeStats.gradeInfo.letter : 'N/A'}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {gradeStats.assessmentsCount > 0 ? `${gradeStats.currentPercentage}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connected Modules Footer Tags */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {courseRoutine.length} weekly slots
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckSquare className="h-3 w-3" />
                  {courseTasks.length} pending tasks
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <FolderGit2 className="h-3 w-3" />
                  {courseMaterials.length} materials
                </span>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Add / Edit Course Modal */}
      {(isAddOpen || isEditOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {isAddOpen ? 'Add New Course' : 'Edit Course'}
              </h2>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setIsEditOpen(false);
                }}
                className="text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={isAddOpen ? handleSaveAdd : handleSaveEdit} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSE 221"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Credit *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    required
                    value={credit}
                    onChange={(e) => setCredit(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              {formError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-medium text-rose-600 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-400">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Course Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Algorithms & Data Structures"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Faculty
                  </label>
                  <input
                    type="text"
                    placeholder="Dr. Robert"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Room
                  </label>
                  <input
                    type="text"
                    placeholder="Lab 402"
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Section
                  </label>
                  <input
                    type="text"
                    placeholder="A"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Color badge picker */}
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Course Color Accent
                </label>
                <div className="flex items-center gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`h-6 w-6 rounded-full transition-transform ${
                        color === c ? 'scale-125 ring-2 ring-blue-500 ring-offset-2' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Course Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Key topics, syllabus notes, or office hours..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setIsEditOpen(false);
                  }}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                >
                  {isAddOpen ? 'Add Course' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
