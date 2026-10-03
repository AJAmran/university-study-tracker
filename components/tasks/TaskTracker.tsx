'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Circle,
  CheckCircle2,
  Plus,
  Trash2,
  Calendar,
  Search
} from 'lucide-react';
import { Course, TaskItem } from '@/types';
import { toggleTaskComplete, deleteTask } from '@/actions';
import { getTaskUrgency } from '@/lib/calculations';
import { fireConfetti } from '@/lib/confetti';
import { useBusy } from '@/hooks/use-busy';

type TaskTrackerProps = {
  courses: Course[];
  tasks: TaskItem[];
  onOpenAddTask: () => void;
  onRefresh: () => void;
};

type FilterCategory = 'all' | 'today' | 'upcoming' | 'overdue' | 'completed';

export function TaskTracker({
  courses,
  tasks,
  onOpenAddTask,
  onRefresh,
}: TaskTrackerProps) {
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const { run } = useBusy();

  const handleToggle = (id: string) => run(async () => {
    try {
      const res = await toggleTaskComplete(id);
      if (!res.success) {
        alert(res.error || 'Failed to update task');
        return;
      }
      if (res.task?.status === 'Completed') {
        fireConfetti();
      }
      onRefresh();
    } catch {
      alert('Network error. Please check your connection and try again.');
    }
  });

  const handleDelete = (id: string) => {
    if (!confirm('Delete this task?')) return;
    run(async () => {
      try {
        const res = await deleteTask(id);
        if (!res.success) {
          alert(res.error || 'Failed to delete task');
          return;
        }
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  // Filter and sort tasks
  const filteredTasks = tasks.filter((task) => {
    const urgency = getTaskUrgency(task);

    // Category filter
    if (filterCategory === 'today' && urgency.category !== 'today') return false;
    if (filterCategory === 'upcoming' && (urgency.category === 'overdue' || urgency.category === 'today' || urgency.category === 'completed' || task.status === 'Completed')) return false;
    if (filterCategory === 'overdue' && urgency.category !== 'overdue') return false;
    if (filterCategory === 'completed' && task.status !== 'Completed') return false;

    // Course filter
    if (selectedCourseId !== 'all' && task.courseId !== selectedCourseId) return false;

    // Type filter
    if (selectedType !== 'all' && task.type !== selectedType) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const course = courses.find((c) => c.id === task.courseId);
      const matchesTitle = task.title.toLowerCase().includes(q);
      const matchesCourse = (course?.code || '').toLowerCase().includes(q) || (course?.name || '').toLowerCase().includes(q);
      const matchesDesc = (task.description || '').toLowerCase().includes(q);
      if (!matchesTitle && !matchesCourse && !matchesDesc) return false;
    }

    return true;
  });

  // Sort: Overdue first, then upcoming by due date, completed at the end
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.status === 'Completed' && b.status !== 'Completed') return 1;
    if (a.status !== 'Completed' && b.status === 'Completed') return -1;
    const dateCmp = (a.dueDate || '').localeCompare(b.dueDate || '');
    if (dateCmp !== 0) return dateCmp;
    return (a.dueTime || '').localeCompare(b.dueTime || '');
  });

  // Count metrics for quick filter badges
  const overdueCount = tasks.filter((t) => getTaskUrgency(t).category === 'overdue').length;
  const todayCount = tasks.filter((t) => getTaskUrgency(t).category === 'today').length;
  const pendingCount = tasks.filter((t) => t.status !== 'Completed').length;

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-blue-600" />
            Tasks, CTs & Exams
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {pendingCount} active academic deadlines • Auto-urgency tracking
          </p>
        </div>

        <button
          onClick={onOpenAddTask}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add Task / CT</span>
        </button>
      </div>

      {/* Search and Secondary Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        {/* Search */}
        <div className="relative sm:col-span-6">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search assignments, CT topics, courses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Course Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All Types</option>
            <option value="CT">Class Tests (CT)</option>
            <option value="Exam">Final Exam</option>
            <option value="Assignment">Assignment</option>
            <option value="Homework">Homework</option>
            <option value="Project">Project</option>
            <option value="Quiz">Quiz</option>
            <option value="Lab">Lab Report</option>
            <option value="Presentation">Presentation</option>
            <option value="Report">Report</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Urgency Pill Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-1">
        {[
          { id: 'all', label: 'All Tasks', count: tasks.length },
          { id: 'today', label: 'Due Today', count: todayCount, badgeColor: 'bg-amber-500 text-white' },
          { id: 'upcoming', label: 'Upcoming', count: pendingCount - overdueCount - todayCount },
          { id: 'overdue', label: 'Overdue', count: overdueCount, badgeColor: 'bg-rose-500 text-white' },
          { id: 'completed', label: 'Completed', count: tasks.filter((t) => t.status === 'Completed').length },
        ].map((tab) => {
          const isSelected = filterCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id as any)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-blue-700 text-white' : tab.badgeColor || 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task List Cards */}
      <div className="space-y-2">
        {sortedTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <CheckCircle2 className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No tasks found for this filter
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Add a new task or adjust your filters above.
            </p>
          </div>
        ) : (
          sortedTasks.map((task) => {
            const course = courses.find((c) => c.id === task.courseId);
            const urgency = getTaskUrgency(task);
            const isCompleted = task.status === 'Completed';

            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 rounded-xl border p-3.5 shadow-2xs transition-all ${
                  isCompleted
                    ? 'border-zinc-200 bg-zinc-50/60 opacity-60 dark:border-zinc-700 dark:bg-zinc-900/40'
                    : urgency.category === 'overdue'
                    ? 'border-rose-300 bg-rose-50/30 dark:border-rose-900/50 dark:bg-rose-950/20'
                    : urgency.category === 'today'
                    ? 'border-amber-300 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20'
                    : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                {/* 1-Tap Toggle Circle */}
                <button
                  onClick={() => handleToggle(task.id)}
                  className={`mt-0.5 shrink-0 transition-transform active:scale-75 ${
                    isCompleted
                      ? 'text-emerald-500'
                      : 'text-zinc-400 hover:text-emerald-500 dark:text-zinc-500'
                  }`}
                  title={isCompleted ? 'Mark incomplete' : 'Mark completed'}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <h3
                      className={`text-sm font-bold truncate ${
                        isCompleted
                          ? 'line-through text-zinc-400 dark:text-zinc-500'
                          : 'text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      {task.title}
                    </h3>

                    {/* Urgency Badge */}
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${urgency.badgeColor}`}
                    >
                      {urgency.badgeLabel}
                    </span>
                  </div>

                  {/* Course & Metadata row */}
                  <div className="mt-1 flex flex-wrap items-center gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span
                      className="font-semibold"
                      style={{ color: course?.color || '#3b82f6' }}
                    >
                      {course?.code}
                    </span>
                    <span>•</span>
                    <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                      {task.type}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Calendar className="h-3 w-3 text-zinc-400" />
                      {task.dueDate} {task.dueTime ? `(${task.dueTime})` : ''}
                    </span>
                    {task.priority === 'Urgent' && (
                      <span className="rounded bg-rose-500 text-white font-extrabold text-[9px] px-1.5 py-0.2">
                        URGENT
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {task.notes && (
                    <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-800/60 p-1.5 rounded">
                      Note: {task.notes}
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(task.id)}
                  className="shrink-0 p-1 text-zinc-300 hover:text-rose-500 transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
