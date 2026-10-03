'use client';

import React, { useState } from 'react';
import {
  Award,
  Plus,
  Trash2,
  TrendingUp,
  Target,
  BarChart2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Course, Assessment, Semester, AssessmentCategory } from '@/types';
import { calculateCourseGrade, calculateSemesterGPA } from '@/lib/calculations';
import { addAssessment, deleteAssessment } from '@/actions';
import { useBusy } from '@/hooks/use-busy';

type GradeTrackerProps = {
  courses: Course[];
  assessments: Assessment[];
  semester?: Semester;
  onRefresh: () => void;
};

export function GradeTracker({
  courses,
  assessments,
  semester,
  onRefresh,
}: GradeTrackerProps) {
  const [targetGPAInput, setTargetGPAInput] = useState<number>(semester?.targetGPA || 3.85);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(courses[0]?.id || null);

  // Quick Add Mark state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selCourseId, setSelCourseId] = useState(courses[0]?.id || '');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<AssessmentCategory>('CT');
  const [obtainedMarks, setObtainedMarks] = useState('18');
  const [maxMarks, setMaxMarks] = useState('20');
  const [weightPercent, setWeightPercent] = useState('15');

  const gpaStats = calculateSemesterGPA(courses, assessments);

  const { run } = useBusy();

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const max = parseFloat(maxMarks);
    const obtained = parseFloat(obtainedMarks);
    if (!Number.isFinite(max) || max < 1) {
      alert('Max marks must be at least 1');
      return;
    }
    if (!Number.isFinite(obtained) || obtained < 0 || obtained > max) {
      alert(`Obtained marks must be between 0 and ${max}`);
      return;
    }
    run(async () => {
      try {
        const res = await addAssessment({
          courseId: selCourseId || courses[0]?.id,
          title,
          category,
          obtainedMarks: obtained,
          maxMarks: max,
          weightPercent: parseFloat(weightPercent) || 0,
        });
        if (!res.success) {
          alert(res.error || 'Failed to save mark');
          return;
        }
        setIsAddOpen(false);
        setTitle('');
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this assessment score?')) return;
    run(async () => {
      try {
        const res = await deleteAssessment(id);
        if (!res.success) {
          alert(res.error || 'Failed to delete');
          return;
        }
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Award className="h-6 w-6 text-blue-600" />
            Marks, Grades & GPA Engine
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Weighted assessment scores, predictive final exam targets, and CGPA projection.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add Mark / Exam</span>
        </button>
      </div>

      {/* GPA Command Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Current Evaluated GPA */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Evaluated GPA</span>
            <Award className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
              {gpaStats.gradedCredits > 0 ? gpaStats.gpa.toFixed(2) : '—'}
            </span>
            <span className="text-xs text-zinc-400">/ 4.00</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {gpaStats.gradedCredits > 0
              ? `Based on ${gpaStats.gradedCredits} of ${gpaStats.totalCredits} graded credits`
              : 'Add assessment marks to calculate your GPA'}
          </p>
        </div>

        {/* Projected Final GPA */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-2xs dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="flex items-center justify-between text-xs text-blue-700 dark:text-blue-300">
            <span className="font-semibold uppercase tracking-wider">Projected Final GPA</span>
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700 dark:text-blue-300">
              {gpaStats.predictedGPA.toFixed(2)}
            </span>
            <span className="text-xs text-blue-500/70">/ 4.00</span>
          </div>
          <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
            Assuming 85% on remaining finals & submissions
          </p>
        </div>

        {/* Target GPA Goal Tracker */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold uppercase tracking-wider">Semester Target Goal</span>
            <Target className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {targetGPAInput.toFixed(2)}
              </span>
              <span className="text-xs text-zinc-400">goal</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <input
                type="number"
                step="0.05"
                min="2.0"
                max="4.0"
                value={targetGPAInput}
                onChange={(e) => setTargetGPAInput(Number(e.target.value))}
                className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-bold"
              />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-zinc-500">
            {gpaStats.predictedGPA >= targetGPAInput
              ? 'On track to meet or exceed your target GPA!'
              : `Need ~${Math.round((targetGPAInput - gpaStats.predictedGPA) * 100)} bonus points across finals`}
          </p>
        </div>
      </div>

      {/* Course-by-Course Assessment Breakdown */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-blue-600" />
          Course Assessment Weight & Marks Breakdown
        </h2>

        {courses.map((course) => {
          const courseAssessments = assessments.filter((a) => a.courseId === course.id);
          const stats = calculateCourseGrade(course.id, assessments);
          const isExpanded = expandedCourseId === course.id;

          return (
            <div
              key={course.id}
              className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 transition-all"
            >
              {/* Collapsible Card Header */}
              <div
                onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                className="cursor-pointer p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="h-3.5 w-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: course.color || '#3b82f6' }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
                        {course.code}
                      </span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                        — {course.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      {course.credit} Credits • {courseAssessments.length} assessments recorded •{' '}
                      {stats.evaluatedWeight}% of 100% evaluated
                    </div>
                  </div>
                </div>

                {/* Score & Letter Grade Pill */}
                <div className="flex items-center justify-between sm:justify-end gap-3">
                  <div className="text-right">
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                        {stats.gradeInfo.letter}
                      </span>
                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        ({stats.currentPercentage}%)
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      GP: {stats.gradeInfo.gradePoint.toFixed(2)}
                    </div>
                  </div>

                  <button className="p-1 text-zinc-400">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Progress bar showing evaluated weight */}
              <div className="px-4 pb-2">
                <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${Math.min(100, stats.evaluatedWeight)}%` }}
                  />
                </div>
              </div>

              {/* Expanded Assessment Items List */}
              {isExpanded && (
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-950/20 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      Recorded Assessments & Weightings
                    </span>
                    <button
                      onClick={() => {
                        setSelCourseId(course.id);
                        setIsAddOpen(true);
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Add to {course.code}
                    </button>
                  </div>

                  {courseAssessments.length === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-400">
                      No assessment marks entered yet for this course.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {courseAssessments.map((ass) => {
                        const pct = ass.maxMarks > 0 ? Math.round((ass.obtainedMarks / ass.maxMarks) * 100) : 0;
                        const weightedContribution = Math.round((pct / 100) * ass.weightPercent * 10) / 10;

                        return (
                          <div
                            key={ass.id}
                            className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-2.5 text-xs shadow-2xs dark:border-zinc-800 dark:bg-zinc-900"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                  {ass.category}
                                </span>
                                <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                  {ass.title}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-zinc-500">
                                Weight: {ass.weightPercent}% of total grade • Contributes +{weightedContribution}%
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="font-extrabold text-zinc-900 dark:text-zinc-100">
                                  {ass.obtainedMarks} / {ass.maxMarks}
                                </div>
                                <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                  {pct}%
                                </div>
                              </div>

                              <button
                                onClick={() => handleDelete(ass.id)}
                                className="p-1 text-zinc-300 hover:text-rose-500"
                                title="Remove score"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Remaining weight summary */}
                  <div className={`rounded-xl border p-2.5 text-xs flex items-center justify-between ${stats.evaluatedWeight > 100 ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' : 'border-dashed border-zinc-200 text-zinc-500 dark:border-zinc-800'}`}>
                    <span>{stats.evaluatedWeight > 100 ? `Over-allocated by ${(Math.round((stats.evaluatedWeight - 100) * 10) / 10)}% — reduce weights:` : 'Remaining Unevaluated Weight (Final Exam/Project):'}</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">
                      {stats.evaluatedWeight > 100 ? `${Math.round(stats.evaluatedWeight * 10) / 10}%` : `${Math.max(0, 100 - stats.evaluatedWeight)}%`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Configurable Grading Scale Reference */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
          University Grading Scale Reference (4.00 Max Scale)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {[
            { range: '80% – 100%', letter: 'A+', gp: '4.00' },
            { range: '75% – 79%', letter: 'A', gp: '3.75' },
            { range: '70% – 74%', letter: 'A-', gp: '3.50' },
            { range: '65% – 69%', letter: 'B+', gp: '3.25' },
            { range: '60% – 64%', letter: 'B', gp: '3.00' },
            { range: '55% – 59%', letter: 'B-', gp: '2.75' },
            { range: '50% – 54%', letter: 'C+', gp: '2.50' },
            { range: '45% – 49%', letter: 'C', gp: '2.25' },
            { range: '40% – 44%', letter: 'D', gp: '2.00' },
            { range: '< 40%', letter: 'F', gp: '0.00' },
          ].map((grade) => (
            <div key={grade.letter} className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 p-2 flex items-center justify-between">
              <div>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{grade.letter}</span>
                <div className="text-[10px] text-zinc-400">{grade.range}</div>
              </div>
              <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                {grade.gp}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Add Assessment Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              Record Assessment Marks
            </h2>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Course *
                </label>
                <select
                  value={selCourseId}
                  onChange={(e) => setSelCourseId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="CT">Class Test (CT)</option>
                    <option value="Assignment">Assignment</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Midterm">Midterm</option>
                    <option value="Final">Final Exam</option>
                    <option value="Lab">Lab Evaluation / Viva</option>
                    <option value="Viva">Viva</option>
                    <option value="Presentation">Presentation</option>
                    <option value="Attendance">Attendance Mark</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Weight % *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    placeholder="e.g. 15"
                    value={weightPercent}
                    onChange={(e) => setWeightPercent(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Assessment Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CT-2: Dynamic Programming"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Obtained Marks *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={obtainedMarks}
                    onChange={(e) => setObtainedMarks(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Total / Max Marks *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                >
                  Save Score
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
