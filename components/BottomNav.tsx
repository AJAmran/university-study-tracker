'use client';

import React, { useEffect, useState } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  CheckSquare, 
  Sparkles, 
  Menu, 
  X,
  BookOpen, 
  UserCheck, 
  Award, 
  FolderGit2, 
  FileText,
  AlertTriangle
} from 'lucide-react';
import { CourseAttendance, TaskItem } from '@/types';
import { calculateAttendanceStats } from '@/lib/calculations';

type BottomNavProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tasks: TaskItem[];
  attendance: CourseAttendance[];
};

export function BottomNav({
  activeTab,
  setActiveTab,
  tasks,
  attendance,
}: BottomNavProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    if (!isMoreOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMoreOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isMoreOpen]);

  // Active uncompleted tasks (capped for badge display)
  const pendingTasksCount = tasks.filter((t) => t.status !== 'Completed').length;
  const badgeLabel = pendingTasksCount > 99 ? '99+' : String(pendingTasksCount);

  // Attendance warning count
  const warningCount = attendance.filter((a) => {
    const stats = calculateAttendanceStats(a);
    return stats.isWarning && a.totalClasses > 0;
  }).length;

  const moreItems = [
    { id: 'courses', label: 'Course Directory', icon: BookOpen, desc: 'Faculty, rooms, and sections' },
    { id: 'attendance', label: 'Attendance Tracker', icon: UserCheck, desc: 'Safe limits & warnings', badge: warningCount > 0 ? `${warningCount} Warn` : undefined },
    { id: 'grades', label: 'Marks & GPA Tracker', icon: Award, desc: 'Weighted grades & CGPA predictions' },
    { id: 'materials', label: 'Materials Vault', icon: FolderGit2, desc: 'Slides, PDFs, code & links' },
    { id: 'notes', label: 'Academic Notes', icon: FileText, desc: 'Quick markdown lecture notes' },
  ];

  return (
    <>
      {/* Mobile More Bottom Sheet */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in" role="dialog" aria-modal="true" aria-label="Academic modules">
          <button
            className="fixed inset-0 cursor-default"
            onClick={() => setIsMoreOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl border-t border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            
            <div className="flex shrink-0 items-center justify-between px-4 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Academic Modules
              </span>
              <button 
                onClick={() => setIsMoreOpen(false)}
                className="-mr-1 p-2 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 overflow-y-auto overscroll-contain px-4 pb-4">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMoreOpen(false);
                    }}
                    className={`flex min-h-11 w-full items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{item.label}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</div>
                      </div>
                    </div>
                    {item.badge && (
                      <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        <AlertTriangle className="h-3 w-3" />
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar on Mobile */}
      <nav 
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 block border-t border-zinc-200 bg-white/95 px-0.5 py-1 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 lg:hidden shadow-lg select-none"
      >
        <div className="mx-auto flex max-w-md items-center justify-between">
          {/* 1. Home */}
          <button
            onClick={() => setActiveTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 text-[9px] min-[400px]:text-[10px] font-medium transition-colors ${
              activeTab === 'dashboard'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'dashboard' ? 'bg-blue-50 dark:bg-blue-950/50' : ''}`}>
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <span className="mt-0.5 truncate max-w-full">Today</span>
          </button>

          {/* 2. Routine */}
          <button
            onClick={() => setActiveTab('routine')}
            aria-current={activeTab === 'routine' ? 'page' : undefined}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 text-[9px] min-[400px]:text-[10px] font-medium transition-colors ${
              activeTab === 'routine'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'routine' ? 'bg-blue-50 dark:bg-blue-950/50' : ''}`}>
              <Calendar className="h-5 w-5" />
            </div>
            <span className="mt-0.5 truncate max-w-full">Routine</span>
          </button>

          {/* 3. Tasks with Badge */}
          <button
            onClick={() => setActiveTab('tasks')}
            aria-current={activeTab === 'tasks' ? 'page' : undefined}
            className={`flex-1 min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 text-[9px] min-[400px]:text-[10px] font-medium transition-colors ${
              activeTab === 'tasks'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <div className={`relative p-1 rounded-lg ${activeTab === 'tasks' ? 'bg-blue-50 dark:bg-blue-950/50' : ''}`}>
              <CheckSquare className="h-5 w-5" />
              {pendingTasksCount > 0 && (
                <span className="absolute -top-0.5 -right-1 flex h-3.5 min-w-[14px] px-0.5 items-center justify-center rounded-full bg-blue-600 text-[8px] font-bold text-white shadow-xs">
                  {badgeLabel}
                </span>
              )}
            </div>
            <span className="mt-0.5 truncate max-w-full">Tasks</span>
          </button>

          {/* 4. AI Study */}
          <button
            onClick={() => setActiveTab('ai')}
            aria-current={activeTab === 'ai' ? 'page' : undefined}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 text-[9px] min-[400px]:text-[10px] font-medium transition-colors ${
              activeTab === 'ai'
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <div className={`p-1 rounded-lg ${activeTab === 'ai' ? 'bg-blue-50 dark:bg-blue-950/50' : ''}`}>
              <Sparkles className="h-5 w-5 text-indigo-500 animate-pulse" />
            </div>
            <span className="mt-0.5 truncate max-w-full">AI Study</span>
          </button>

          {/* 5. More Menu */}
          <button
            onClick={() => setIsMoreOpen(true)}
            aria-expanded={isMoreOpen}
            aria-haspopup="dialog"
            className={`flex-1 min-w-0 relative flex flex-col items-center justify-center py-1 px-0.5 text-[9px] min-[400px]:text-[10px] font-medium transition-colors ${
              moreItems.some((i) => i.id === activeTab)
                ? 'text-blue-600 dark:text-blue-400 font-bold'
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <div className="relative p-1 rounded-lg">
              <Menu className="h-5 w-5" />
              {warningCount > 0 && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" role="img" aria-label="Attendance warning" />
              )}
            </div>
            <span className="mt-0.5 truncate max-w-full">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
