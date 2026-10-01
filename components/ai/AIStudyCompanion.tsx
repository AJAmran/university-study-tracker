'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  HelpCircle, 
  FileText, 
  Layers, 
  CheckCircle, 
  Calendar, 
  Send, 
  RotateCcw, 
  BookOpen, 
  Lightbulb, 
  Check, 
  X, 
  ArrowRight,
  RefreshCw,
  Copy,
  Zap
} from 'lucide-react';
import { Course, Flashcard, QuizQuestion, RoutineSlot, TaskItem } from '@/types';
import { fireConfetti } from '@/lib/confetti';

type AIStudyCompanionProps = {
  courses: Course[];
  tasks: TaskItem[];
  routine: RoutineSlot[];
  initialContent?: string;
  initialCourseCode?: string;
};

type AITab = 'tutor' | 'flashcards' | 'quiz' | 'summarize' | 'studyPlan';

export function AIStudyCompanion({
  courses,
  tasks,
  routine,
  initialContent = '',
  initialCourseCode = '',
}: AIStudyCompanionProps) {
  const [activeTab, setActiveTab] = useState<AITab>('tutor');

  // Shared Course Context
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    courses.find((c) => c.code === initialCourseCode)?.id || courses[0]?.id || ''
  );

  // 1. TUTOR CHAT STATE
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: "Hello! I'm UniMaster AI, your personal academic tutor. Ask me to explain difficult concepts, derive formulas, trace algorithms, or prepare for upcoming CTs!",
    },
  ]);
  const [tutorInput, setTutorInput] = useState('');
  const [isTutorLoading, setIsTutorLoading] = useState(false);

  // 2. FLASHCARDS STATE
  const [flashcardTopic, setFlashcardTopic] = useState(
    initialContent || 'Dynamic Programming: Knapsack & Longest Common Subsequence'
  );
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isCardsLoading, setIsCardsLoading] = useState(false);
  const [masteredCards, setMasteredCards] = useState<string[]>([]);

  // 3. QUIZ STATE
  const [quizTopic, setQuizTopic] = useState(
    initialContent || 'SQL Transactions, ACID Properties & Indexing'
  );
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // 4. SUMMARIZER STATE
  const [summaryInput, setSummaryInput] = useState(initialContent || '');
  const [summaryTitle, setSummaryTitle] = useState('Lecture Summary');
  const [summaryResult, setSummaryResult] = useState<{
    summary: string;
    keyPoints: string[];
    definitions: { term: string; definition: string }[];
    examTips: string[];
  } | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 5. STUDY PLANNER STATE
  const [studyPlan, setStudyPlan] = useState<{
    planOverview: string;
    dailySchedule: Array<{
      day: string;
      focusCourses: string[];
      timeSlots: Array<{ time: string; activity: string; priority: string }>;
    }>;
    proTips: string[];
  } | null>(null);
  const [isPlanLoading, setIsPlanLoading] = useState(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  // 1. Handle Ask Tutor
  const handleAskTutor = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tutorInput.trim() || isTutorLoading) return;

    const userText = tutorInput;
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setTutorInput('');
    setIsTutorLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          payload: {
            question: userText,
            context: {
              courseName: selectedCourse?.name,
              courseCode: selectedCourse?.code,
            },
          },
        }),
      });

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: data.answer || 'No response.' },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Sorry, I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsTutorLoading(false);
    }
  };

  // 2. Handle Generate Flashcards
  const handleGenerateCards = async () => {
    if (!flashcardTopic.trim() || isCardsLoading) return;
    setIsCardsLoading(true);
    setIsCardFlipped(false);
    setActiveCardIndex(0);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'flashcards',
          payload: {
            content: flashcardTopic,
            count: 6,
            courseCode: selectedCourse?.code,
          },
        }),
      });

      const data = await res.json();
      if (data.flashcards) {
        setFlashcards(data.flashcards);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCardsLoading(false);
    }
  };

  // 3. Handle Generate Quiz
  const handleGenerateQuiz = async () => {
    if (!quizTopic.trim() || isQuizLoading) return;
    setIsQuizLoading(true);
    setQuizAnswers({});
    setQuizSubmitted(false);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'quiz',
          payload: {
            content: quizTopic,
            count: 4,
          },
        }),
      });

      const data = await res.json();
      if (data.questions) {
        setQuizQuestions(data.questions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsQuizLoading(false);
    }
  };

  // 4. Handle Summarize
  const handleSummarize = async () => {
    if (!summaryInput.trim() || isSummarizing) return;
    setIsSummarizing(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'summarize',
          payload: {
            content: summaryInput,
            title: summaryTitle,
          },
        }),
      });

      const data = await res.json();
      setSummaryResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSummarizing(false);
    }
  };

  // 5. Handle Study Plan
  const handleGeneratePlan = async () => {
    setIsPlanLoading(true);

    try {
      const pendingTasksList = tasks
        .filter((t) => t.status !== 'Completed')
        .map((t) => {
          const c = courses.find((course) => course.id === t.courseId);
          return {
            title: t.title,
            courseCode: c?.code,
            dueDate: t.dueDate,
            priority: t.priority,
          };
        });

      const routineList = routine.map((r) => {
        const c = courses.find((course) => course.id === r.courseId);
        return {
          day: r.day,
          startTime: r.startTime,
          endTime: r.endTime,
          courseCode: c?.code,
        };
      });

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'studyPlan',
          payload: {
            tasks: pendingTasksList,
            routine: routineList,
          },
        }),
      });

      const data = await res.json();
      setStudyPlan(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlanLoading(false);
    }
  };

  const navTabs = [
    { id: 'tutor', label: 'AI Tutor', icon: HelpCircle },
    { id: 'flashcards', label: 'Flashcards', icon: Layers },
    { id: 'quiz', label: 'Quiz Mode', icon: CheckCircle },
    { id: 'summarize', label: 'Summarize', icon: FileText },
    { id: 'studyPlan', label: 'Study Plan', icon: Calendar },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500 animate-pulse" />
            AI Study Companion
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Personalized academic reasoning, interactive flashcards, quiz generator & study planner.
          </p>
        </div>

        {/* Course Context Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-medium">Context:</span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white py-1.5 px-3 text-xs font-semibold text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 shadow-2xs"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} ({c.name.slice(0, 18)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-1">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. AI TUTOR CHAT */}
      {activeTab === 'tutor' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col h-[520px]">
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs max-w-[85%] whitespace-pre-wrap leading-relaxed shadow-2xs ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-zinc-200/60 dark:border-zinc-700'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isTutorLoading && (
              <div className="flex items-center gap-2 text-xs text-zinc-400 p-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                <span>UniMaster AI is reasoning...</span>
              </div>
            )}
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="mt-2 flex overflow-x-auto no-scrollbar gap-1.5 pb-2">
            {[
              `Explain the main concept of ${selectedCourse?.name || 'this course'} simply`,
              `What are high-yield exam questions for ${selectedCourse?.code}?`,
              `Give me an intuitive real-world analogy for dynamic programming`,
              `How should I prepare for my upcoming CT?`,
            ].map((sugg, i) => (
              <button
                key={i}
                onClick={() => {
                  setTutorInput(sugg);
                }}
                className="shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[10px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200"
              >
                {sugg.slice(0, 38)}...
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleAskTutor} className="mt-1 flex items-center gap-2">
            <input
              type="text"
              placeholder={`Ask a question tailored to ${selectedCourse?.code || 'your studies'}...`}
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            <button
              type="submit"
              disabled={isTutorLoading || !tutorInput.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* 2. FLASHCARDS GENERATOR & INTERACTIVE VIEWER */}
      {activeTab === 'flashcards' && (
        <div className="space-y-4">
          {/* Topic Generator Box */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Topic or concept to turn into flashcards..."
                value={flashcardTopic}
                onChange={(e) => setFlashcardTopic(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                onClick={handleGenerateCards}
                disabled={isCardsLoading}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50"
              >
                {isCardsLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{isCardsLoading ? 'Generating Cards...' : 'Generate Flashcards'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Card Presentation */}
          {flashcards.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                  Card {activeCardIndex + 1} of {flashcards.length}
                </span>
                <span>
                  Mastered: {masteredCards.length} / {flashcards.length}
                </span>
              </div>

              {/* 3D Flip Card */}
              <div
                onClick={() => setIsCardFlipped(!isCardFlipped)}
                className="cursor-pointer min-h-[220px] rounded-2xl border-2 border-indigo-200 bg-linear-to-br from-indigo-50/40 via-white to-purple-50/30 p-6 text-center shadow-md dark:border-indigo-900/60 dark:from-zinc-900 dark:via-zinc-900 dark:to-indigo-950/40 flex flex-col items-center justify-center transition-all hover:scale-[1.01]"
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {isCardFlipped ? 'Answer' : 'Question (Click to reveal answer)'}
                </span>

                <div className="mt-3 text-base font-bold text-zinc-900 dark:text-zinc-100 max-w-md">
                  {isCardFlipped
                    ? flashcards[activeCardIndex]?.answer
                    : flashcards[activeCardIndex]?.question}
                </div>

                <div className="mt-4 text-[10px] text-zinc-400">
                  Topic: {flashcards[activeCardIndex]?.topic || 'Academic'}
                </div>
              </div>

              {/* Navigation & Self-Score Controls */}
              <div className="flex items-center justify-between">
                <button
                  disabled={activeCardIndex === 0}
                  onClick={() => {
                    setIsCardFlipped(false);
                    setActiveCardIndex((p) => Math.max(0, p - 1));
                  }}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Previous
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const id = flashcards[activeCardIndex]?.id;
                      if (!masteredCards.includes(id)) {
                        setMasteredCards([...masteredCards, id]);
                      }
                      if (activeCardIndex + 1 < flashcards.length) {
                        setIsCardFlipped(false);
                        setActiveCardIndex((p) => p + 1);
                      } else {
                        fireConfetti();
                      }
                    }}
                    className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Got it!</span>
                  </button>
                </div>

                <button
                  disabled={activeCardIndex + 1 >= flashcards.length}
                  onClick={() => {
                    setIsCardFlipped(false);
                    setActiveCardIndex((p) => Math.min(flashcards.length - 1, p + 1));
                  }}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Next
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <Layers className="mx-auto h-8 w-8 text-zinc-400" />
              <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                No flashcards created yet
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Enter any chapter topic above to generate a high-yield study deck!
              </p>
            </div>
          )}
        </div>
      )}

      {/* 3. INTERACTIVE QUIZ MODE */}
      {activeTab === 'quiz' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Topic for Quiz (e.g. Relational Calculus, Dijkstra's algorithm)..."
                value={quizTopic}
                onChange={(e) => setQuizTopic(e.target.value)}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <button
                onClick={handleGenerateQuiz}
                disabled={isQuizLoading}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50"
              >
                {isQuizLoading ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>{isQuizLoading ? 'Creating Quiz...' : 'Generate Quiz'}</span>
              </button>
            </div>
          </div>

          {quizQuestions.length > 0 && (
            <div className="space-y-3">
              {quizQuestions.map((q, qIndex) => {
                const selectedOpt = quizAnswers[qIndex];
                const isAnswered = selectedOpt !== undefined;
                const isCorrect = isAnswered && selectedOpt === q.correctIndex;

                return (
                  <div
                    key={q.id || qIndex}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        {qIndex + 1}. {q.question}
                      </h3>
                      {quizSubmitted && (
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            isCorrect
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isCorrect ? 'Correct +1' : 'Incorrect'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {q.options.map((opt, optIdx) => {
                        let btnStyle = 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800';

                        if (selectedOpt === optIdx) {
                          btnStyle = 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold';
                        }
                        if (quizSubmitted) {
                          if (optIdx === q.correctIndex) {
                            btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 font-bold';
                          } else if (selectedOpt === optIdx) {
                            btnStyle = 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => {
                              if (!quizSubmitted) {
                                setQuizAnswers({ ...quizAnswers, [qIndex]: optIdx });
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all ${btnStyle}`}
                          >
                            <span className="font-semibold text-zinc-400 mr-1.5">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="mt-2 text-[11px] text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                        <span className="font-bold text-zinc-800 dark:text-zinc-200">Explanation: </span>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Submit Quiz button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-zinc-500">
                  {Object.keys(quizAnswers).length} of {quizQuestions.length} answered
                </span>
                {!quizSubmitted ? (
                  <button
                    onClick={() => {
                      setQuizSubmitted(true);
                      fireConfetti();
                    }}
                    className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-xs"
                  >
                    Submit & Check Answers
                  </button>
                ) : (
                  <button
                    onClick={handleGenerateQuiz}
                    className="rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900 px-4 py-2 text-xs font-bold shadow-xs"
                  >
                    Try Another Quiz
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. SUMMARIZER (LECTURE & NOTES) */}
      {activeTab === 'summarize' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Topic Title
              </label>
              <input
                type="text"
                value={summaryTitle}
                onChange={(e) => setSummaryTitle(e.target.value)}
                placeholder="e.g. Linear Algebra: Orthogonality & Gram-Schmidt"
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Paste Lecture Text, Slide Content, or Notes
              </label>
              <textarea
                rows={5}
                value={summaryInput}
                onChange={(e) => setSummaryInput(e.target.value)}
                placeholder="Paste the raw text of lecture notes, syllabus chapter, or proof..."
                className="w-full rounded-xl border border-zinc-200 bg-white p-3 text-xs text-zinc-900 outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 font-mono"
              />
            </div>

            <button
              onClick={handleSummarize}
              disabled={isSummarizing || !summaryInput.trim()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50"
            >
              {isSummarizing ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              <span>{isSummarizing ? 'Analyzing & Summarizing...' : 'Summarize for Exams'}</span>
            </button>
          </div>

          {summaryResult && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Executive Summary
                </h3>
                <p className="mt-1 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {summaryResult.summary}
                </p>
              </div>

              {summaryResult.keyPoints?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Key Exam Points
                  </h3>
                  <ul className="mt-1 space-y-1 text-xs text-zinc-600 dark:text-zinc-400 list-disc list-inside">
                    {summaryResult.keyPoints.map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {summaryResult.definitions?.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Important Definitions
                  </h3>
                  <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {summaryResult.definitions.map((def, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{def.term}: </span>
                        <span className="text-zinc-600 dark:text-zinc-400">{def.definition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {summaryResult.examTips?.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
                  <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-600" />
                    High-Yield Exam Tips
                  </h3>
                  <ul className="mt-1 space-y-1 text-xs text-amber-900 dark:text-amber-200 list-disc list-inside">
                    {summaryResult.examTips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. STUDY PLANNER */}
      {activeTab === 'studyPlan' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Personalized Weekly Study Planner
              </h2>
              <p className="text-xs text-zinc-500">
                Generates a realistic schedule combining your upcoming deadlines and free class slots.
              </p>
            </div>

            <button
              onClick={handleGeneratePlan}
              disabled={isPlanLoading}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 px-4 py-2 text-xs font-semibold text-white shadow-xs disabled:opacity-50"
            >
              {isPlanLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Calendar className="h-3.5 w-3.5" />
              )}
              <span>{isPlanLoading ? 'Calculating Schedule...' : 'Generate Optimized Plan'}</span>
            </button>
          </div>

          {studyPlan && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 text-xs dark:border-indigo-900 dark:bg-indigo-950/20">
                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                  Strategic Overview:
                </span>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {studyPlan.planOverview}
                </p>
              </div>

              {/* Daily Schedule Blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {studyPlan.dailySchedule?.map((dayObj, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900 space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      <span className="font-extrabold text-xs text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                        {dayObj.day}
                      </span>
                      <div className="flex gap-1">
                        {dayObj.focusCourses?.map((fc) => (
                          <span key={fc} className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-bold">
                            {fc}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {dayObj.timeSlots?.map((slot, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 text-xs"
                        >
                          <div>
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">
                              {slot.activity}
                            </div>
                            <div className="text-[10px] text-zinc-400">{slot.time}</div>
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                              slot.priority === 'High'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {slot.priority}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {studyPlan.proTips?.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                    Study Efficiency Tips:
                  </h4>
                  <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 list-disc list-inside">
                    {studyPlan.proTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
