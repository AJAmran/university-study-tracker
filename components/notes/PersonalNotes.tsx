'use client';

import React, { useState } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Pin,
  Search,
  Edit3,
  Sparkles,
  Copy,
  Check,
  X
} from 'lucide-react';
import { Course, NoteItem } from '@/types';
import { createNote, updateNote, deleteNote, toggleNotePin } from '@/actions';
import { useBusy } from '@/hooks/use-busy';

type PersonalNotesProps = {
  courses: Course[];
  notes: NoteItem[];
  onRefresh: () => void;
  onSendToAI?: (content: string, courseCode?: string) => void;
};

export function PersonalNotes({
  courses,
  notes,
  onRefresh,
  onSendToAI,
}: PersonalNotesProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for non-HTTPS / denied permission
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      } catch {
        alert('Copy failed — select the text manually');
      }
    }
  };

  // Modal / Editor State
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');

  const openNewNote = () => {
    setEditId(null);
    setTitle('');
    setCourseId(courses[0]?.id || '');
    setTopic('');
    setContent('');
    setIsEditing(true);
  };

  const openEditNote = (n: NoteItem) => {
    setEditId(n.id);
    setTitle(n.title);
    setCourseId(n.courseId);
    setTopic(n.topic || '');
    setContent(n.content);
    setIsEditing(true);
  };

  const { run } = useBusy();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId && courses.length === 0) {
      alert('Add a course first before creating notes');
      return;
    }
    run(async () => {
      try {
        const res = editId
          ? await updateNote(editId, { title, courseId, topic, content })
          : await createNote({ title, courseId, topic, content, tags: [], isPinned: false });
        if (!res.success) {
          alert(res.error || 'Failed to save note — your content is preserved');
          return;
        }
        setIsEditing(false);
        onRefresh();
      } catch {
        alert('Network error — your content is preserved. Please try again.');
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm('Delete this note?')) return;
    run(async () => {
      try {
        const res = await deleteNote(id);
        if (!res.success) {
          alert(res.error || 'Failed to delete note');
          return;
        }
        if (activeNote?.id === id) setActiveNote(null);
        onRefresh();
      } catch {
        alert('Network error. Please check your connection and try again.');
      }
    });
  };

  const handleTogglePin = (id: string) => run(async () => {
    try {
      const res = await toggleNotePin(id);
      if (!res.success) {
        alert(res.error || 'Failed to pin note');
        return;
      }
      onRefresh();
    } catch {
      alert('Network error. Please check your connection and try again.');
    }
  });

  const filteredNotes = notes.filter((n) => {
    if (selectedCourseId !== 'all' && n.courseId !== selectedCourseId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const course = courses.find((c) => c.id === n.courseId);
      const matchesTitle = n.title.toLowerCase().includes(q);
      const matchesTopic = (n.topic || '').toLowerCase().includes(q);
      const matchesContent = n.content.toLowerCase().includes(q);
      const matchesCourse = (course?.code || '').toLowerCase().includes(q);
      if (!matchesTitle && !matchesTopic && !matchesContent && !matchesCourse) return false;
    }
    return true;
  });

  // Sort: pinned first, then by updated date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            Academic Notes & Quick Capture
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Fast markdown lecture notes linked to courses and topics.
          </p>
        </div>

        <button
          onClick={openNewNote}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>+ Create Note</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="relative sm:col-span-8">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search note content, topics, concepts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="sm:col-span-4">
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
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {sortedNotes.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <FileText className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No notes found
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Create a fast markdown note for key lecture proofs and concepts.
            </p>
          </div>
        ) : (
          sortedNotes.map((note) => {
            const course = courses.find((c) => c.id === note.courseId);

            return (
              <div
                key={note.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-xs font-bold"
                        style={{ color: course?.color || '#3b82f6' }}
                      >
                        {course?.code}
                      </span>
                      {note.topic && (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 truncate max-w-[120px]">
                          {note.topic}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(note.id, note.content)}
                        className={`p-1 transition-colors ${
                          copiedId === note.id ? 'text-emerald-500 font-bold' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                        }`}
                        title="Copy code/notes"
                      >
                        {copiedId === note.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleTogglePin(note.id)}
                        className={`p-1 transition-colors ${
                          note.isPinned ? 'text-blue-600' : 'text-zinc-300 hover:text-blue-600'
                        }`}
                        title="Pin Note"
                      >
                        <Pin className={`h-4 w-4 ${note.isPinned ? 'fill-blue-600' : ''}`} />
                      </button>
                      <button
                        onClick={() => openEditNote(note)}
                        className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                        title="Edit Note"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-1 text-zinc-400 hover:text-rose-500"
                        title="Delete Note"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div 
                    onClick={() => setActiveNote(note)}
                    className="cursor-pointer"
                  >
                    <h3 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 transition-colors">
                      {note.title}
                    </h3>

                    <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 font-mono whitespace-pre-wrap line-clamp-5 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      {note.content}
                    </div>
                  </div>
                </div>

                {/* Footer with AI Study shortcut */}
                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400">
                    {(() => {
                      const d = new Date(note.updatedAt);
                      return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
                    })()}
                  </span>

                  {onSendToAI && (
                    <button
                      onClick={() => onSendToAI(note.content, course?.code)}
                      className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Quiz / Flashcards with AI</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Note Editor Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              {editId ? 'Edit Academic Note' : 'Create Quick Note'}
            </h2>

            <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Note Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Theorem Key Cases & Limitations"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Course *
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Recurrence Relations"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Note Content (Markdown supported) *
                </label>
                <textarea
                  rows={8}
                  required
                  placeholder="Write formulas, proofs, algorithm invariants, or memory tricks..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                >
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Note Reader Modal */}
      {activeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm animate-fade-in">
          <div className="fixed inset-0" onClick={() => setActiveNote(null)} aria-hidden="true" />
          <div className="relative w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col">
            <div className="flex items-start justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 gap-2">
              <div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                  {courses.find((c) => c.id === activeNote.courseId)?.code} • {activeNote.topic || 'Note'}
                </span>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {activeNote.title}
                </h2>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleCopy(activeNote.id, activeNote.content)}
                  className="flex items-center gap-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-bold shadow-2xs hover:bg-blue-100"
                >
                  {copiedId === activeNote.id ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setActiveNote(null)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed bg-zinc-50 dark:bg-zinc-950/70 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 overflow-x-auto">
                {activeNote.content}
              </pre>
            </div>

            {onSendToAI && (
              <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <span className="text-xs text-zinc-400">Want to generate quiz from this?</span>
                <button
                  onClick={() => {
                    const c = courses.find((crs) => crs.id === activeNote.courseId);
                    onSendToAI(activeNote.content, c?.code);
                    setActiveNote(null);
                  }}
                  className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Practice with AI</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
