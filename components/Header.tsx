'use client';

import React from 'react';
import { useTheme } from './ThemeProvider';
import {
  GraduationCap,
  Sun,
  Moon,
  Plus,
  RotateCcw,
  Sparkles,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { CourseAttendance, Semester } from '@/types';
import { calculateAttendanceStats } from '@/lib/calculations';

import { useMounted } from '@/hooks/use-mounted';

type HeaderProps = {
  semester?: Semester;
  attendance?: CourseAttendance[];
  onOpenQuickAdd: () => void;
  onResetData: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

export function Header({
  semester,
  attendance = [],
  onOpenQuickAdd,
  onResetData,
  activeTab,
  setActiveTab,
}: HeaderProps) {
  const { theme, setTheme, isDark } = useTheme();
  const mounted = useMounted();

  const todayStr = mounted
    ? new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(new Date())
    : 'Today';

  // Count attendance warnings
  const warningsCount = attendance.filter((a) => {
    const stats = calculateAttendanceStats(a);
    return stats.isWarning && a.totalClasses > 0;
  }).length;

  const navItems: Array<{ id: string; label: string; badge?: number; icon?: typeof Sparkles }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'routine', label: 'Routine' },
    { id: 'tasks', label: 'Tasks & Exams' },
    { id: 'courses', label: 'Courses' },
    { id: 'attendance', label: 'Attendance', badge: warningsCount > 0 ? warningsCount : undefined },
    { id: 'grades', label: 'Grades & GPA' },
    { id: 'materials', label: 'Materials' },
    { id: 'notes', label: 'Notes' },
    { id: 'ai', label: 'AI Study', icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 transition-colors">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-1 px-2.5 sm:gap-2 sm:px-6">
        {/* Brand & Semester info */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2 text-left focus-visible:outline-2 focus-visible:outline-blue-500 rounded-lg"
            aria-label="Go to dashboard"
          >
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 shrink-0">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-base tracking-tight text-zinc-900 dark:text-zinc-100">
                  UniMaster<span className="text-blue-600">Pro</span>
                </span>
                <span className="hidden sm:inline-block rounded-md bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900">
                  Personal
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[120px] min-[400px]:max-w-[180px] sm:max-w-none">
                {semester?.name || 'Semester 1'}
              </p>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Links. Hidden below lg so the brand and controls
            never compete for horizontal space on a phone. */}
        <nav className="hidden lg:flex items-center gap-1 text-xs font-medium">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-900'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5 text-blue-500" />}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* Today Date Badge */}
          <div suppressHydrationWarning className="hidden sm:flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <Calendar className="h-3.5 w-3.5 text-blue-500" />
            <span suppressHydrationWarning>{todayStr || 'Today'}</span>
          </div>

          {/* Low Attendance Warning pill if any */}
          {warningsCount > 0 && (
            <button
              onClick={() => setActiveTab('attendance')}
              className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-lg text-xs font-medium"
              title={`${warningsCount} course(s) below target attendance`}
              aria-label={`${warningsCount} courses below target attendance. Go to attendance tracker.`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
              <span className="hidden min-[400px]:inline">{warningsCount} Warning</span>
            </button>
          )}

          {/* Quick Add Button */}
          <button
            onClick={onOpenQuickAdd}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-2.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all"
            aria-label="Add item"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add</span>
          </button>

          {/* Theme switcher */}
          <button
            onClick={() => {
              if (theme === 'system') setTheme(isDark ? 'light' : 'dark');
              else if (theme === 'dark') setTheme('light');
              else setTheme('dark');
            }}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors"
            title={`Toggle theme (current: ${theme})`}
            aria-label={`Toggle theme, current mode ${theme}`}
            aria-pressed={isDark}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
          </button>

          {/* Reset button. Destructive, so it is out of the way on phones. */}
          <button
            onClick={onResetData}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 sm:block dark:hover:text-zinc-200 dark:hover:bg-zinc-900 transition-colors"
            title="Reset to the starter Semester 1 data"
            aria-label="Reset to starter data"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
