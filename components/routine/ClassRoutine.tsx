'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  User,
  Plus,
  Trash2,
  Sparkles,
  Camera
} from 'lucide-react';
import { Course, RoutineSlot, DayOfWeek } from '@/types';
import { deleteRoutineSlot, recordAttendance } from '@/actions';
import { useMounted } from '@/hooks/use-mounted';
import { useBusy, todayLocalDate } from '@/hooks/use-busy';
import { RoutineUploadModal } from './RoutineUploadModal';

type ClassRoutineProps = {
  courses: Course[];
  routine: RoutineSlot[];
  onOpenAddClass: () => void;
  onRefresh: () => void;
};

const ALL_DAYS: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ClassRoutine({
  courses,
  routine,
  onOpenAddClass,
  onRefresh,
}: ClassRoutineProps) {
  const mounted = useMounted();
  const [, setTick] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

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

  const currentDay: DayOfWeek = mounted ? daysMap[new Date().getDay()] : 'Monday';
  const [userSelectedDay, setUserSelectedDay] = useState<DayOfWeek | 'All' | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'grid'>('timeline');

  const currentTimeStr = mounted
    ? `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`
    : '';

  const { run } = useBusy();

  const handleDelete = (id: string) => {
    if (!confirm('Remove this class slot from your routine?')) return;
    run(async () => {
      try {
        const res = await deleteRoutineSlot(id);
        if (!res.success) {
          alert(res.error || 'Failed to delete slot');
          return;
        }
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  const handleQuickAttendance = (courseId: string, status: 'present' | 'absent') => run(async () => {
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

  // Group slots by day
  const slotsByDay: Record<DayOfWeek, RoutineSlot[]> = useMemo(() => {
    const grouped: Record<DayOfWeek, RoutineSlot[]> = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
      Sunday: [],
    };
    routine.forEach((slot) => {
      if (grouped[slot.day]) {
        grouped[slot.day].push(slot);
      }
    });
    (Object.keys(grouped) as DayOfWeek[]).forEach((dayKey) => {
      grouped[dayKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return grouped;
  }, [routine]);

  // This term's timetable only runs Friday and Saturday. Opening the screen on a
  // day with no classes would show an empty list, so default to today when it has
  // something and otherwise to the next day in the week that does.
  const defaultDay = useMemo<DayOfWeek>(() => {
    if (slotsByDay[currentDay].length > 0) return currentDay;
    const todayIndex = ALL_DAYS.indexOf(currentDay);
    const activeDays = ALL_DAYS.filter((day) => slotsByDay[day].length > 0);
    const upcoming = activeDays.find((day) => ALL_DAYS.indexOf(day) >= todayIndex);
    return upcoming ?? activeDays[0] ?? currentDay;
  }, [currentDay, slotsByDay]);

  const selectedDay = userSelectedDay || defaultDay;

  const displayedDays = selectedDay === 'All' ? ALL_DAYS : [selectedDay];

  return (
    <div className="space-y-4">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            Class Routine & Schedule
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Weekly academic timetable with live room and ongoing session tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Switch Grid/Timeline for desktop */}
          <div className="hidden md:flex rounded-lg border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-100 dark:bg-zinc-800">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-zinc-900 shadow-xs text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Agenda
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-zinc-900 shadow-xs text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400'
              }`}
            >
              Weekly Grid
            </button>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-2.5 sm:px-3 py-2 text-xs font-bold text-white shadow-xs transition-all"
            title="Upload, scan photo, or import your class routine"
          >
            <Camera className="h-4 w-4" />
            <span>Upload Routine</span>
          </button>

          <button
            onClick={onOpenAddClass}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 px-2.5 sm:px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Class</span>
          </button>
        </div>
      </div>

      {/* ROUTINE IMPORTER CALLOUT BANNER (MOBILE FIRST) */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-blue-50/50 p-3 sm:p-4 dark:border-emerald-900/50 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-blue-950/20 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Got your official class routine?
                </span>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  AI Timetable Scanner
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                Snap or upload a photo of your notice, paste timetable text, or load the pre-configured Semester 1 routine in 1 click.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-2 text-xs font-bold shadow-sm transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Upload / Scan Routine Now</span>
          </button>
        </div>
      </div>

      {/* Day Selector Pill Tabs (Touch scrollable for mobile) */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-1">
        <button
          onClick={() => setUserSelectedDay('All')}
          className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
            selectedDay === 'All'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          All Days
        </button>

        {ALL_DAYS.map((day) => {
          const isToday = day === currentDay;
          const isSelected = selectedDay === day;
          const count = slotsByDay[day].length;

          return (
            <button
              key={day}
              onClick={() => setUserSelectedDay(day)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              <span>{day.slice(0, 3)}</span>
              {isToday && (
                <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-600 animate-pulse'}`} />
              )}
              {count > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${isSelected ? 'bg-blue-700' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TIMELINE / AGENDA VIEW */}
      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {displayedDays.map((day) => {
            const daySlots = slotsByDay[day];
            const isToday = day === currentDay;

            return (
              <div key={day} className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span suppressHydrationWarning className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                      {day}
                    </span>
                    {isToday && (
                      <span suppressHydrationWarning className="rounded-md bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {daySlots.length} {daySlots.length === 1 ? 'class' : 'classes'}
                  </span>
                </div>

                {daySlots.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50">
                    No classes scheduled for {day}.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {daySlots.map((slot) => {
                      const course = courses.find((c) => c.id === slot.courseId);
                      const isOngoing = isToday && currentTimeStr !== '' && currentTimeStr >= slot.startTime && currentTimeStr < slot.endTime;

                      return (
                        <div
                          key={slot.id}
                          className={`relative rounded-xl border p-4 shadow-2xs transition-all ${
                            isOngoing
                              ? 'border-blue-500 bg-blue-50/50 ring-2 ring-blue-500/20 dark:border-blue-700 dark:bg-blue-950/30'
                              : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
                          }`}
                        >
                          {/* Card Top: Timing & Live status */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              <Clock className="h-3.5 w-3.5 text-blue-500" />
                              <span>{slot.startTime} – {slot.endTime}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isOngoing && (
                                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider animate-pulse">
                                  Ongoing
                                </span>
                              )}
                              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                                {slot.mode}
                              </span>
                              <button
                                onClick={() => handleDelete(slot.id)}
                                className="text-zinc-400 hover:text-rose-500 transition-colors p-1"
                                title="Remove slot"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Course Name & Code */}
                          <div className="mt-2.5">
                            <h3 
                              className="text-base font-bold"
                              style={{ color: course?.color || '#3b82f6' }}
                            >
                              {course?.code} — {course?.name}
                            </h3>
                          </div>

                          {/* Location & Teacher */}
                          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                              {slot.room || course?.room || 'TBA'}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-zinc-400" />
                              {slot.faculty || course?.faculty || 'Faculty TBA'}
                            </span>
                          </div>

                          {slot.notes && (
                            <p className="mt-2 text-xs text-zinc-500 italic border-l-2 border-zinc-200 dark:border-zinc-700 pl-2">
                              {slot.notes}
                            </p>
                          )}

                          {/* Quick 1-tap Attendance logger on mobile for current or today class */}
                          {isToday && (
                            <div className="mt-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-2 text-[11px]">
                              <span className="text-zinc-500 font-medium">Record attendance:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleQuickAttendance(slot.courseId, 'present')}
                                  className="rounded-md bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-bold"
                                >
                                  + Present
                                </button>
                                <button
                                  onClick={() => handleQuickAttendance(slot.courseId, 'absent')}
                                  className="rounded-md bg-zinc-200 hover:bg-rose-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-zinc-700 dark:text-zinc-300"
                                >
                                  + Absent
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* WEEKLY GRID VIEW (for Desktop) */}
      {viewMode === 'grid' && (
        <div className="hidden md:block overflow-x-auto rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid grid-cols-7 gap-2 min-w-[700px]">
            {ALL_DAYS.map((day) => {
              const daySlots = slotsByDay[day];
              const isToday = day === currentDay;

              return (
                <div key={day} className="space-y-2">
                  <div className={`p-2 text-center rounded-lg font-bold text-xs ${
                    isToday ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                  }`}>
                    {day.slice(0, 3)}
                  </div>

                  <div className="space-y-2 min-h-[200px]">
                    {daySlots.map((slot) => {
                      const course = courses.find((c) => c.id === slot.courseId);
                      return (
                        <div
                          key={slot.id}
                           className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-2 text-xs shadow-2xs dark:border-zinc-700 dark:bg-zinc-800/80"
                        >
                          <div className="font-bold text-[11px] text-zinc-900 dark:text-zinc-100 truncate" style={{ color: course?.color }}>
                            {course?.code}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-medium">
                            {slot.startTime} - {slot.endTime}
                          </div>
                          <div className="mt-1 text-[10px] text-zinc-600 dark:text-zinc-400 truncate">
                            {slot.room || course?.room || 'TBA'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Routine Upload & Semester Setup Modal */}
      {/* key remounts on every open so stale extraction/photo state never leaks across sessions */}
      <RoutineUploadModal
        key={isUploadModalOpen ? 'routine-open' : 'routine-closed'}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onRefresh={onRefresh}
      />
    </div>
  );
}
