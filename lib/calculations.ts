import { Assessment, Course, CourseAttendance, TaskItem } from '@/types';

export type AttendanceStats = {
  percentage: number;
  isWarning: boolean;
  classesNeededFor75: number;
  maxCanMiss: number;
  statusText: string;
};

export function calculateAttendanceStats(att: CourseAttendance): AttendanceStats {
  // Postgres numeric columns can come back as strings; coerce here so the
  // comparisons below stay numeric rather than doing lexicographic compares.
  const totalClasses = Number(att.totalClasses) || 0;
  const attended = Number(att.attended) || 0;
  const requiredPercentage = Number(att.requiredPercentage) || 75;

  if (totalClasses === 0) {
    return {
      percentage: 100,
      isWarning: false,
      classesNeededFor75: 0,
      maxCanMiss: 0,
      statusText: 'No classes recorded yet',
    };
  }

  const percentage = Math.round((attended / totalClasses) * 100 * 10) / 10;
  const isWarning = percentage < requiredPercentage;

  const targetRatio = requiredPercentage / 100;

  let classesNeededFor75 = 0;
  let maxCanMiss = 0;

  if (percentage < requiredPercentage) {
    // (attended + x) / (totalClasses + x) >= targetRatio
    // attended + x >= targetRatio * totalClasses + targetRatio * x
    // x * (1 - targetRatio) >= targetRatio * totalClasses - attended
    const needed = (targetRatio * totalClasses - attended) / (1 - targetRatio);
    classesNeededFor75 = Math.max(0, Math.ceil(needed));
  } else {
    // attended / (totalClasses + y) >= targetRatio
    // attended >= targetRatio * totalClasses + targetRatio * y
    // y <= (attended - targetRatio * totalClasses) / targetRatio
    const canMiss = (attended - targetRatio * totalClasses) / targetRatio;
    maxCanMiss = Math.max(0, Math.floor(canMiss));
  }

  let statusText = 'Safe attendance';
  if (isWarning) {
    statusText = `Attend next ${classesNeededFor75} ${classesNeededFor75 === 1 ? 'class' : 'classes'} to reach ${requiredPercentage}%!`;
  } else if (maxCanMiss > 0) {
    statusText = `You can safely miss ${maxCanMiss} more ${maxCanMiss === 1 ? 'class' : 'classes'}`;
  } else {
    statusText = 'On the borderline! Do not miss next class.';
  }

  return {
    percentage,
    isWarning,
    classesNeededFor75,
    maxCanMiss,
    statusText,
  };
}

export type GradeInfo = {
  letter: string;
  gradePoint: number;
  label: string;
};

export function marksToGrade(pct: number): GradeInfo {
  if (pct >= 80) return { letter: 'A+', gradePoint: 4.0, label: 'Outstanding' };
  if (pct >= 75) return { letter: 'A', gradePoint: 3.75, label: 'Excellent' };
  if (pct >= 70) return { letter: 'A-', gradePoint: 3.5, label: 'Very Good' };
  if (pct >= 65) return { letter: 'B+', gradePoint: 3.25, label: 'Good' };
  if (pct >= 60) return { letter: 'B', gradePoint: 3.0, label: 'Satisfactory' };
  if (pct >= 55) return { letter: 'B-', gradePoint: 2.75, label: 'Above Average' };
  if (pct >= 50) return { letter: 'C+', gradePoint: 2.5, label: 'Average' };
  if (pct >= 45) return { letter: 'C', gradePoint: 2.25, label: 'Pass' };
  if (pct >= 40) return { letter: 'D', gradePoint: 2.0, label: 'Conditional Pass' };
  return { letter: 'F', gradePoint: 0.0, label: 'Fail' };
}

export type CourseGradeStats = {
  courseId: string;
  evaluatedWeight: number;
  obtainedWeight: number;
  currentPercentage: number;
  gradeInfo: GradeInfo;
  predictedGradeInfo: GradeInfo;
  assessmentsCount: number;
};

export function calculateCourseGrade(
  courseId: string,
  assessments: Assessment[],
  targetRemainingScorePercent: number = 85
): CourseGradeStats {
  const courseAssessments = assessments.filter((a) => a.courseId === courseId);

  if (courseAssessments.length === 0) {
    return {
      courseId,
      evaluatedWeight: 0,
      obtainedWeight: 0,
      currentPercentage: 0,
      gradeInfo: marksToGrade(0),
      predictedGradeInfo: marksToGrade(targetRemainingScorePercent),
      assessmentsCount: 0,
    };
  }

  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const a of courseAssessments) {
    if (a.maxMarks > 0) {
      const scoreRatio = Math.min(1.2, a.obtainedMarks / a.maxMarks);
      weightedScoreSum += scoreRatio * a.weightPercent;
      totalWeight += a.weightPercent;
    }
  }

  const currentPercentage = totalWeight > 0 ? (weightedScoreSum / totalWeight) * 100 : 0;
  const gradeInfo = marksToGrade(currentPercentage);

  // Predicted grade assuming unassigned weight scores at targetRemainingScorePercent
  const remainingWeight = Math.max(0, 100 - totalWeight);
  const predictedTotalScore = weightedScoreSum + (targetRemainingScorePercent / 100) * remainingWeight;
  const predictedGradeInfo = marksToGrade(predictedTotalScore);

  return {
    courseId,
    evaluatedWeight: Math.round(totalWeight * 10) / 10,
    obtainedWeight: Math.round(weightedScoreSum * 10) / 10,
    currentPercentage: Math.round(currentPercentage * 10) / 10,
    gradeInfo,
    predictedGradeInfo,
    assessmentsCount: courseAssessments.length,
  };
}

export function calculateSemesterGPA(
  courses: Course[],
  assessments: Assessment[]
): {
  gpa: number;
  predictedGPA: number;
  totalCredits: number;
  gradedCredits: number;
} {
  let totalGradePoints = 0;
  let totalCredits = 0;
  let gradedCredits = 0;
  let predictedGradePoints = 0;

  for (const course of courses) {
    totalCredits += course.credit;
    const stats = calculateCourseGrade(course.id, assessments);
    if (stats.assessmentsCount > 0) {
      gradedCredits += course.credit;
      totalGradePoints += stats.gradeInfo.gradePoint * course.credit;
    }
    predictedGradePoints += stats.predictedGradeInfo.gradePoint * course.credit;
  }

  const gpa = gradedCredits > 0 ? Math.round((totalGradePoints / gradedCredits) * 100) / 100 : 0;
  const predictedGPA = totalCredits > 0 ? Math.round((predictedGradePoints / totalCredits) * 100) / 100 : 0;

  return {
    gpa,
    predictedGPA,
    totalCredits,
    gradedCredits,
  };
}

export type TaskUrgencyCategory = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'completed';

export function getTaskUrgency(task: TaskItem): {
  category: TaskUrgencyCategory;
  daysRemaining: number;
  badgeLabel: string;
  badgeColor: string;
} {
  if (task.status === 'Completed') {
    return {
      category: 'completed',
      daysRemaining: 0,
      badgeLabel: 'Done',
      badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      category: 'overdue',
      daysRemaining: diffDays,
      badgeLabel: `${Math.abs(diffDays)}d overdue`,
      badgeColor: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    };
  }
  if (diffDays === 0) {
    return {
      category: 'today',
      daysRemaining: 0,
      badgeLabel: 'Due Today',
      badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    };
  }
  if (diffDays === 1) {
    return {
      category: 'tomorrow',
      daysRemaining: 1,
      badgeLabel: 'Due Tomorrow',
      badgeColor: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    };
  }
  if (diffDays <= 7) {
    return {
      category: 'this_week',
      daysRemaining: diffDays,
      badgeLabel: `In ${diffDays} days`,
      badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    };
  }
  return {
    category: 'later',
    daysRemaining: diffDays,
    badgeLabel: `In ${diffDays} days`,
    badgeColor: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/30',
  };
}
