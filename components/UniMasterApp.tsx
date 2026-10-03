'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppData } from '@/types';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { QuickActionModal } from '@/components/QuickActionModal';
import { RoutineUploadModal } from '@/components/routine/RoutineUploadModal';
import { PersonalDashboard } from '@/components/dashboard/PersonalDashboard';
import { ClassRoutine } from '@/components/routine/ClassRoutine';
import { TaskTracker } from '@/components/tasks/TaskTracker';
import { CourseManager } from '@/components/courses/CourseManager';
import { AttendanceTracker } from '@/components/attendance/AttendanceTracker';
import { GradeTracker } from '@/components/grades/GradeTracker';
import { MaterialsVault } from '@/components/materials/MaterialsVault';
import { PersonalNotes } from '@/components/notes/PersonalNotes';
import { AIStudyCompanion } from '@/components/ai/AIStudyCompanion';
import { resetDatabase } from '@/actions';

type UniMasterAppProps = {
  initialData: AppData;
};

export type QuickAddAction = 'task' | 'routine' | 'attendance' | 'mark' | 'material' | 'note';

export function UniMasterApp({ initialData }: UniMasterAppProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isRoutineUploadOpen, setIsRoutineUploadOpen] = useState(false);
  const [quickAddAction, setQuickAddAction] = useState<QuickAddAction>('task');

  // AI contextual transfer from notes/materials
  const [aiContextContent, setAiContextContent] = useState('');
  const [aiContextCourseCode, setAiContextCourseCode] = useState('');

  const currentSemester = initialData.semesters.find((s) => s.isCurrent) || initialData.semesters[0];

  const handleRefresh = () => {
    router.refresh();
  };

  const handleOpenQuickAdd = (action: QuickAddAction = 'task') => {
    setQuickAddAction(action);
    setIsQuickAddOpen(true);
  };

  const handleResetData = async () => {
    if (confirm('Reset to the starter Semester 1 data? This clears your tasks, marks, notes and attendance records. A backup is saved automatically and can be restored from Courses.')) {
      try {
        const res = await resetDatabase();
        if (!res.success) {
          alert('Reset failed — please try again');
          return;
        }
        router.refresh();
      } catch {
        alert('Reset failed — please try again');
      }
    }
  };

  const handleSendToAI = (content: string, courseCode?: string) => {
    setAiContextContent(content.slice(0, 12000));
    setAiContextCourseCode(courseCode || '');
    setActiveTab('ai');
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Top Header */}
      <Header
        semester={currentSemester}
        attendance={initialData.attendance}
        onOpenQuickAdd={() => handleOpenQuickAdd('task')}
        onResetData={handleResetData}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Bottom padding clears the fixed mobile nav (h-14) plus the home
          indicator, so the last card is never trapped under the bar. */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pt-3 sm:px-6 sm:pt-6 pb-28 sm:pb-12">
        {activeTab === 'dashboard' && (
          <PersonalDashboard
            courses={initialData.courses}
            routine={initialData.routine}
            tasks={initialData.tasks}
            attendance={initialData.attendance}
            assessments={initialData.assessments}
            notes={initialData.notes}
            onOpenQuickAdd={handleOpenQuickAdd}
            onNavigateTab={setActiveTab}
            onRefresh={handleRefresh}
            onOpenRoutineUpload={() => setIsRoutineUploadOpen(true)}
          />
        )}

        {activeTab === 'routine' && (
          <ClassRoutine
            courses={initialData.courses}
            routine={initialData.routine}
            onOpenAddClass={() => handleOpenQuickAdd('routine')}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'tasks' && (
          <TaskTracker
            courses={initialData.courses}
            tasks={initialData.tasks}
            onOpenAddTask={() => handleOpenQuickAdd('task')}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'courses' && (
          <CourseManager
            courses={initialData.courses}
            routine={initialData.routine}
            tasks={initialData.tasks}
            attendance={initialData.attendance}
            assessments={initialData.assessments}
            materials={initialData.materials}
            snapshots={initialData.snapshots ?? []}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'attendance' && (
          <AttendanceTracker
            courses={initialData.courses}
            attendance={initialData.attendance}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'grades' && (
          <GradeTracker
            courses={initialData.courses}
            assessments={initialData.assessments}
            semester={currentSemester}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'materials' && (
          <MaterialsVault
            courses={initialData.courses}
            materials={initialData.materials}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'notes' && (
          <PersonalNotes
            courses={initialData.courses}
            notes={initialData.notes}
            onRefresh={handleRefresh}
            onSendToAI={handleSendToAI}
          />
        )}

        {activeTab === 'ai' && (
          <AIStudyCompanion
            courses={initialData.courses}
            tasks={initialData.tasks}
            routine={initialData.routine}
            initialContent={aiContextContent}
            initialCourseCode={aiContextCourseCode}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tasks={initialData.tasks}
        attendance={initialData.attendance}
      />

      {/* Floating Quick Action Modal */}
      <QuickActionModal
        key={isQuickAddOpen ? quickAddAction : 'closed'}
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        courses={initialData.courses}
        onRefresh={handleRefresh}
        initialAction={quickAddAction}
      />

      {/* Routine Timetable AI Scanner & Semester Setup Modal */}
      {/* key remounts on every open so stale extraction/photo state never leaks across sessions */}
      <RoutineUploadModal
        key={isRoutineUploadOpen ? 'routine-open' : 'routine-closed'}
        isOpen={isRoutineUploadOpen}
        onClose={() => setIsRoutineUploadOpen(false)}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
