export type Priority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Not Started' | 'In Progress' | 'Completed';
export type TaskType =
  | 'Homework'
  | 'Assignment'
  | 'CT'
  | 'Exam'
  | 'Quiz'
  | 'Presentation'
  | 'Project'
  | 'Lab'
  | 'Report'
  | 'Other';

export type ClassMode = 'On Campus' | 'Online' | 'Hybrid';
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type AssessmentCategory =
  | 'CT'
  | 'Assignment'
  | 'Quiz'
  | 'Midterm'
  | 'Final'
  | 'Lab'
  | 'Viva'
  | 'Presentation'
  | 'Attendance'
  | 'Other';

export type MaterialType =
  | 'PDF'
  | 'Lecture Slides'
  | 'Notes'
  | 'Handwritten Notes'
  | 'Video'
  | 'Lab Code'
  | 'Assignment'
  | 'Google Drive'
  | 'GitHub'
  | 'External Link';

export type Semester = {
  id: string;
  name: string;
  isCurrent: boolean;
  targetGPA: number;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  credit: number;
  faculty: string;
  room: string;
  section: string;
  semesterId: string;
  color: string; // Tailwind color token or hex
  notes?: string;
};

export type RoutineSlot = {
  id: string;
  courseId: string;
  day: DayOfWeek;
  startTime: string; // "09:00" (24h)
  endTime: string;   // "10:30" (24h)
  faculty?: string;
  room?: string;
  mode: ClassMode;
  notes?: string;
};

export type TaskItem = {
  id: string;
  title: string;
  courseId: string;
  type: TaskType;
  priority: Priority;
  status: TaskStatus;
  dueDate: string; // YYYY-MM-DD or ISO string
  dueTime?: string; // HH:MM
  description?: string;
  notes?: string;
  completedAt?: string;
};

export type AttendanceLog = {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'cancelled';
  note?: string;
};

export type CourseAttendance = {
  id: string;
  courseId: string;
  totalClasses: number;
  attended: number;
  missed: number;
  requiredPercentage: number; // default 75
  logs?: AttendanceLog[];
};

export type Assessment = {
  id: string;
  courseId: string;
  title: string;
  category: AssessmentCategory;
  maxMarks: number;
  obtainedMarks: number;
  weightPercent: number; // e.g. 20 for 20%
};

export type MaterialItem = {
  id: string;
  title: string;
  courseId: string;
  type: MaterialType;
  url: string;
  tags: string[];
  description?: string;
  isFavorite: boolean;
  createdAt: string;
};

export type NoteItem = {
  id: string;
  title: string;
  courseId: string;
  topic?: string;
  taskId?: string;
  content: string; // Markdown text
  tags: string[];
  isPinned: boolean;
  updatedAt: string;
};

export type Flashcard = {
  id: string;
  question: string;
  answer: string;
  courseCode?: string;
  topic?: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  type: 'mcq' | 'conceptual' | 'true_false';
};

export type SnapshotMeta = {
  id: string;
  label: string;
  createdAt: string;
};

export type AppData = {
  semesters: Semester[];
  courses: Course[];
  routine: RoutineSlot[];
  tasks: TaskItem[];
  attendance: CourseAttendance[];
  assessments: Assessment[];
  materials: MaterialItem[];
  notes: NoteItem[];
  /** Auto/manual backup metadata. Never truncated; populated on read only. */
  snapshots?: SnapshotMeta[];
};

export type ExtractedRoutineSlot = {
  day: DayOfWeek;
  courseCode: string;
  courseName: string;
  credit?: number;
  startTime: string; // "09:00" (24h)
  endTime: string;   // "10:30" (24h)
  room?: string;
  faculty?: string;
  mode?: ClassMode;
  notes?: string;
};
