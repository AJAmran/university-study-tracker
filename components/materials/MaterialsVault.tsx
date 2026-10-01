'use client';

import React, { useState } from 'react';
import { 
  FolderGit2, 
  Plus, 
  Trash2, 
  Star, 
  ExternalLink, 
  Search, 
  FileText, 
  Video, 
  Github, 
  Link, 
  Tag, 
  Clock,
  Filter
} from 'lucide-react';
import { Course, MaterialItem, MaterialType } from '@/types';
import { toggleMaterialFavorite, deleteMaterial, createMaterial } from '@/actions';

type MaterialsVaultProps = {
  courses: Course[];
  materials: MaterialItem[];
  onRefresh: () => void;
};

export function MaterialsVault({
  courses,
  materials,
  onRefresh,
}: MaterialsVaultProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add material modal
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id || '');
  const [type, setType] = useState<MaterialType>('PDF');
  const [url, setUrl] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [desc, setDesc] = useState('');

  const handleToggleFavorite = async (id: string) => {
    await toggleMaterialFavorite(id);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this study material link?')) {
      await deleteMaterial(id);
      onRefresh();
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMaterial({
      title,
      courseId: courseId || courses[0]?.id,
      type,
      url,
      tags: tagsStr.split(',').map((t) => t.trim()).filter(Boolean),
      description: desc,
      isFavorite: false,
    });
    setIsAddOpen(false);
    setTitle('');
    setUrl('');
    setTagsStr('');
    setDesc('');
    onRefresh();
  };

  const filteredMaterials = materials.filter((m) => {
    if (selectedCourseId !== 'all' && m.courseId !== selectedCourseId) return false;
    if (selectedType !== 'all' && m.type !== selectedType) return false;
    if (showOnlyFavorites && !m.isFavorite) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const course = courses.find((c) => c.id === m.courseId);
      const matchesTitle = m.title.toLowerCase().includes(q);
      const matchesCourse = course?.code.toLowerCase().includes(q) || course?.name.toLowerCase().includes(q);
      const matchesTags = m.tags.some((t) => t.toLowerCase().includes(q));
      const matchesDesc = (m.description || '').toLowerCase().includes(q);
      if (!matchesTitle && !matchesCourse && !matchesTags && !matchesDesc) return false;
    }

    return true;
  });

  const getTypeIcon = (mType: MaterialType) => {
    switch (mType) {
      case 'PDF':
      case 'Lecture Slides':
      case 'Notes':
      case 'Handwritten Notes':
        return <FileText className="h-4 w-4 text-rose-500" />;
      case 'Video':
        return <Video className="h-4 w-4 text-purple-500" />;
      case 'GitHub':
      case 'Lab Code':
        return <Github className="h-4 w-4 text-zinc-800 dark:text-zinc-200" />;
      default:
        return <Link className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FolderGit2 className="h-6 w-6 text-blue-600" />
            Study Materials Vault
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Organized course vault: lecture handouts, lab code, GitHub repos, and drive links.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add Resource</span>
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div className="relative sm:col-span-6">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            type="text"
            placeholder="Search slides, links, topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 pl-9 pr-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

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

        <div className="sm:col-span-3">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="all">All File Types</option>
            <option value="PDF">PDF</option>
            <option value="Lecture Slides">Lecture Slides</option>
            <option value="Notes">Notes</option>
            <option value="GitHub">GitHub</option>
            <option value="Video">Video</option>
            <option value="Lab Code">Lab Code</option>
            <option value="Google Drive">Google Drive</option>
            <option value="External Link">External Link</option>
          </select>
        </div>
      </div>

      {/* Pill tabs for Favorites & All */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowOnlyFavorites(false)}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
            !showOnlyFavorites
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          All Materials ({materials.length})
        </button>

        <button
          onClick={() => setShowOnlyFavorites(true)}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${
            showOnlyFavorites
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
          }`}
        >
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span>Starred Favorites ({materials.filter((m) => m.isFavorite).length})</span>
        </button>
      </div>

      {/* Material Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredMaterials.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <FolderGit2 className="mx-auto h-8 w-8 text-zinc-400" />
            <p className="mt-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              No study materials found
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Add your lecture slides, PDFs, or GitHub repos to this course vault.
            </p>
          </div>
        ) : (
          filteredMaterials.map((mat) => {
            const course = courses.find((c) => c.id === mat.courseId);

            return (
              <div
                key={mat.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                        {getTypeIcon(mat.type)}
                      </div>
                      <div>
                        <span
                          className="text-xs font-bold"
                          style={{ color: course?.color || '#3b82f6' }}
                        >
                          {course?.code}
                        </span>
                        <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          {mat.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleFavorite(mat.id)}
                        className={`p-1 transition-colors ${
                          mat.isFavorite ? 'text-amber-400' : 'text-zinc-300 hover:text-amber-400'
                        }`}
                        title="Star Favorite"
                      >
                        <Star className={`h-4 w-4 ${mat.isFavorite ? 'fill-amber-400' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="p-1 text-zinc-300 hover:text-rose-500"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {mat.title}
                  </h3>

                  {mat.description && (
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                      {mat.description}
                    </p>
                  )}

                  {/* Tags */}
                  {mat.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {mat.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Open link button */}
                <div className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 truncate max-w-[200px]">
                    {mat.url}
                  </span>
                  <a
                    href={mat.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <span>Open Resource</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Material Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              Add Study Material to Vault
            </h2>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 6: Graph Algorithms & Minimum Spanning Trees"
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
                    Type *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  >
                    <option value="PDF">PDF</option>
                    <option value="Lecture Slides">Lecture Slides</option>
                    <option value="Notes">Notes</option>
                    <option value="GitHub">GitHub</option>
                    <option value="Video">Video</option>
                    <option value="Lab Code">Lab Code</option>
                    <option value="Google Drive">Google Drive</option>
                    <option value="External Link">External Link</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  URL / Resource Link *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="graphs, exam, revision"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What is important about this resource..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-white p-2 text-xs text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
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
                  Add Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
