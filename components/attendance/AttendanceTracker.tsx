'use client';

import React, { useState } from 'react';
import {
  UserCheck,
  AlertTriangle,
  Plus,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { Course, CourseAttendance } from '@/types';
import { calculateAttendanceStats } from '@/lib/calculations';
import { recordAttendance, updateAttendanceTarget } from '@/actions';
import { useBusy, todayLocalDate } from '@/hooks/use-busy';

type AttendanceTrackerProps = {
  courses: Course[];
  attendance: CourseAttendance[];
  onRefresh: () => void;
};

export function AttendanceTracker({
  courses,
  attendance,
  onRefresh,
}: AttendanceTrackerProps) {
  const [editingTargetCourseId, setEditingTargetCourseId] = useState<string | null>(null);
  const [targetVal, setTargetVal] = useState<number>(75);

  const { run } = useBusy();

  const handleRecord = (courseId: string, status: 'present' | 'absent') => run(async () => {
    try {
      const res = await recordAttendance(courseId, status, todayLocalDate());
      if (!res.success) {
        alert(res.error || 'Failed to record attendance');
        return;
      }
      onRefresh();
    } catch {
      alert('Network error. Please check your connection and try again.');
    }
  });

  const handleSaveTarget = (courseId: string) => {
    const pct = Math.round(Number(targetVal));
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      alert('Target must be between 1 and 100');
      return;
    }
    run(async () => {
      try {
        const res = await updateAttendanceTarget(courseId, pct);
        if (!res.success) {
          alert(res.error || 'Failed to update target');
          return;
        }
        setEditingTargetCourseId(null);
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  // Overall attendance calculation across all courses
  let totalAttendedAll = 0;
  let totalClassesAll = 0;
  let warningCount = 0;

  attendance.forEach((a) => {
    totalAttendedAll += a.attended;
    totalClassesAll += a.totalClasses;
    const stats = calculateAttendanceStats(a);
    if (stats.isWarning && a.totalClasses > 0) warningCount++;
  });

  const overallPct = totalClassesAll > 0 ? Math.round((totalAttendedAll / totalClassesAll) * 100 * 10) / 10 : null;

  return (
    <div className="space-y-4">
      {/* Header & Overall Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-blue-600" />
            Attendance Tracker
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real-time threshold calculations, safe miss limits, and single-tap attendance recording.
          </p>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 flex items-center gap-2">
            <span className="text-xs text-zinc-500">Overall:</span>
            <span className={`text-sm font-black ${overallPct === null ? 'text-zinc-500' : overallPct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {overallPct === null ? '—' : `${overallPct}%`}
            </span>
            <span className="text-[10px] text-zinc-400">({totalAttendedAll}/{totalClassesAll})</span>
          </div>

          {warningCount > 0 && (
            <div className="flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>{warningCount} Below target</span>
            </div>
          )}
        </div>
      </div>

      {/* Course Attendance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {courses.map((course) => {
          const record = attendance.find((a) => a.courseId === course.id) || {
            id: '',
            courseId: course.id,
            totalClasses: 0,
            attended: 0,
            missed: 0,
            requiredPercentage: 75,
          };
          const stats = calculateAttendanceStats(record);
          const requiredPct = record.requiredPercentage || 75;

          return (
            <div
              key={course.id}
              className={`rounded-2xl border p-4 shadow-2xs transition-all ${
                stats.isWarning && record.totalClasses > 0
                  ? 'border-rose-300 bg-rose-50/20 dark:border-rose-900/60 dark:bg-rose-950/20'
                  : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
              }`}
            >
              {/* Top Row: Course Code & Required % */}
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className="text-base font-extrabold tracking-tight"
                    style={{ color: course.color || '#3b82f6' }}
                  >
                    {course.code}
                  </span>
                  <h3 className="text-xs text-zinc-600 dark:text-zinc-400 font-medium truncate max-w-[200px] sm:max-w-xs">
                    {course.name}
                  </h3>
                </div>

                <div className="text-right">
                  <div className="flex items-baseline justify-end gap-1">
                    <span
                      className={`text-2xl font-black ${
                        stats.isWarning && record.totalClasses > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {stats.percentage}%
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center justify-end gap-1">
                    <span>Target: {requiredPct}%</span>
                    <button
                      onClick={() => {
                        setEditingTargetCourseId(course.id);
                        setTargetVal(requiredPct);
                      }}
                      className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      title="Change target threshold"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Edit Target Inline if open */}
              {editingTargetCourseId === course.id && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs">
                  <span className="text-zinc-600 dark:text-zinc-300">Set Target %:</span>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={targetVal}
                    onChange={(e) => setTargetVal(Number(e.target.value))}
                    className="w-16 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                  <button
                    onClick={() => handleSaveTarget(course.id)}
                    className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingTargetCourseId(null)}
                    className="text-zinc-400 text-[10px]"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Progress Bar */}
              <div className="mt-3 space-y-1">
                <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.isWarning && record.totalClasses > 0
                        ? 'bg-rose-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, stats.percentage)}%` }}
                  />
                </div>
              </div>

              {/* Class Counter Breakdown */}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-zinc-50 p-1.5 dark:bg-zinc-800/60">
                  <div className="text-[10px] text-zinc-500 font-medium">Attended</div>
                  <div className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    {record.attended}
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-50 p-1.5 dark:bg-zinc-800/60">
                  <div className="text-[10px] text-zinc-500 font-medium">Missed</div>
                  <div className="font-extrabold text-rose-600 dark:text-rose-400">
                    {record.missed}
                  </div>
                </div>

                <div className="rounded-lg bg-zinc-50 p-1.5 dark:bg-zinc-800/60">
                  <div className="text-[10px] text-zinc-500 font-medium">Total Held</div>
                  <div className="font-extrabold text-zinc-800 dark:text-zinc-200">
                    {record.totalClasses}
                  </div>
                </div>
              </div>

              {/* Predictive Status Pill */}
              <div className="mt-3 flex items-center justify-between text-xs">
                <div
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 ${
                    stats.isWarning && record.totalClasses > 0
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {stats.isWarning && record.totalClasses > 0 ? (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span>{stats.statusText}</span>
                </div>
              </div>

              {/* 1-Tap Attendance Buttons */}
              <div className="mt-3.5 grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  onClick={() => handleRecord(course.id, 'present')}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 py-2 text-xs font-bold text-white shadow-xs transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>+ Present</span>
                </button>
                <button
                  onClick={() => handleRecord(course.id, 'absent')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 hover:bg-rose-500 hover:text-white hover:border-rose-500 active:scale-95 py-2 text-xs font-bold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-rose-600 dark:hover:text-white transition-all"
                >
                  <span>+ Absent</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
