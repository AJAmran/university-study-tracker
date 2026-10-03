'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  Check,
  X,
  AlertCircle,
  FileText,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  Zap,
  RefreshCw,
  Trash2,
  Maximize2
} from 'lucide-react';
import { ExtractedRoutineSlot } from '@/types';
import { importExtractedRoutine, applyCurrentSemesterPreset } from '@/actions';

type RoutineUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
};

export function RoutineUploadModal({
  isOpen,
  onClose,
  onRefresh,
}: RoutineUploadModalProps) {
  const [activeTab, setActiveTab] = useState<'photo' | 'text' | 'preset' | 'saved'>('photo');

  // Photo state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [savedRoutinePhoto, setSavedRoutinePhoto] = useState<string | null>(null);

  // Text state
  const [routineText, setRoutineText] = useState('');

  // AI Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [extractedSemester, setExtractedSemester] = useState('Semester 1');
  const [extractedSlots, setExtractedSlots] = useState<ExtractedRoutineSlot[]>([]);
  const [selectedSlotIndices, setSelectedSlotIndices] = useState<Set<number>>(new Set());
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Action loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      // Never fire onClose on an unmounted modal (stale auto-close timer).
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem('unimaster_routine_photo');
      if (stored) {
        setSavedRoutinePhoto(stored);
      }
    } catch {
      // Ignore localStorage issues
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAnalysisError('Please choose an image file (JPEG/PNG/WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAnalysisError('Image is too large — please use a photo under 5MB.');
      return;
    }

    setImageMime(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setImagePreview(result);
        setAnalysisError(null);
        setSuccessMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzePhoto = async (photoDataToAnalyze?: string) => {
    const dataUri = photoDataToAnalyze || imagePreview;
    if (!dataUri) {
      setAnalysisError('Please choose or snap a routine photo first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSuccessMessage(null);

    try {
      // Split base64 from data:image/png;base64,
      const parts = dataUri.split(',');
      const base64 = parts.length > 1 ? parts[1] : parts[0];
      const mime = parts.length > 1 ? (parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg') : imageMime;

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          action: 'parseRoutine',
          payload: {
            imageBase64: base64,
            mimeType: mime,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze routine photo with AI.');
      }

      if (data.slots && data.slots.length > 0) {
        setExtractedSlots(data.slots);
        setExtractedSemester(data.semesterName || 'Semester 1');
        setSelectedSlotIndices(new Set(data.slots.map((_: unknown, idx: number) => idx)));
        setSuccessMessage(`AI successfully extracted ${data.slots.length} class periods! Review and click Import.`);
        
        // Also save to device localStorage for future reference
        try {
          localStorage.setItem('unimaster_routine_photo', dataUri);
          setSavedRoutinePhoto(dataUri);
        } catch {
          // ignore storage limit
        }
      } else {
        setAnalysisError('No class timetable slots could be recognized in this image. Try pasting routine text or using the semester preset.');
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Error communicating with AI parser. Please check your internet or retry.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeText = async () => {
    if (!routineText.trim()) {
      setAnalysisError('Please paste your routine timetable text first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          action: 'parseRoutine',
          payload: {
            text: routineText,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to parse routine text.');
      }

      if (data.slots && data.slots.length > 0) {
        setExtractedSlots(data.slots);
        setExtractedSemester(data.semesterName || 'Semester 1');
        setSelectedSlotIndices(new Set(data.slots.map((_: unknown, idx: number) => idx)));
        setSuccessMessage(`AI parsed ${data.slots.length} classes! Review below and tap Import.`);
      } else {
        setAnalysisError('Could not identify class periods in the text provided. Make sure it contains days and times.');
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Error processing routine text.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleSlotSelection = (index: number) => {
    const next = new Set(selectedSlotIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelectedSlotIndices(next);
  };

  const handleSelectAllSlots = () => {
    if (selectedSlotIndices.size === extractedSlots.length) {
      setSelectedSlotIndices(new Set());
    } else {
      setSelectedSlotIndices(new Set(extractedSlots.map((_, i) => i)));
    }
  };

  const handleImportSelected = async () => {
    const slotsToImport = extractedSlots.filter((_, idx) => selectedSlotIndices.has(idx));
    if (slotsToImport.length === 0) {
      setAnalysisError('Please select at least one class period to import.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await importExtractedRoutine(slotsToImport, replaceExisting, extractedSemester);
      if (res.success) {
        setSuccessMessage(`Successfully imported ${res.addedSlotsCount} classes into your routine!`);
        onRefresh();
        closeTimer.current = setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setAnalysisError(res.error || 'Failed to save routine slots.');
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Error saving routine to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyPreset = async () => {
    if (!confirm('Apply the Semester 1 routine preset? This replaces your current schedule with the official timetable: 5 periods on Friday and 2 online periods on Saturday.')) {
      return;
    }
    setIsSubmitting(true);
    setAnalysisError(null);
    try {
      const res = await applyCurrentSemesterPreset();
      if (res.success) {
        setSuccessMessage('Semester 1 routine timetable loaded successfully!');
        onRefresh();
        closeTimer.current = setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setAnalysisError(res.error || 'Failed to apply the semester preset.');
      }
    } catch (err: any) {
      setAnalysisError(err.message || 'Error setting up the semester preset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSavedPhoto = () => {
    try {
      localStorage.removeItem('unimaster_routine_photo');
      setSavedRoutinePhoto(null);
      if (activeTab === 'saved') {
        setActiveTab('photo');
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 flex flex-col overflow-hidden">
        {/* Mobile drag handle */}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700 sm:hidden" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
                Routine Importer
              </h2>
              <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                AI Schedule Scanner & Timetable Setup
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Tabs (Mobile-Friendly Pill Bar) */}
        <div className="flex overflow-x-auto no-scrollbar gap-1 px-3 py-2 bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => { setActiveTab('photo'); setAnalysisError(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
              activeTab === 'photo'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Camera className="h-3.5 w-3.5" />
            <span>AI Photo Scanner</span>
          </button>

          <button
            onClick={() => { setActiveTab('text'); setAnalysisError(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
              activeTab === 'text'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Paste Text</span>
          </button>

          <button
            onClick={() => { setActiveTab('preset'); setAnalysisError(null); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
              activeTab === 'preset'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Sem 1 Preset</span>
          </button>

          {savedRoutinePhoto && (
            <button
              onClick={() => { setActiveTab('saved'); setAnalysisError(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                activeTab === 'saved'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
              }`}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Routine Photo</span>
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {/* Notifications */}
          {analysisError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{analysisError}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium animate-fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: AI PHOTO SCANNER */}
          {activeTab === 'photo' && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 text-center bg-zinc-50/50 dark:bg-zinc-950/30">
                {imagePreview ? (
                  <div className="space-y-3">
                    <div className="relative mx-auto max-h-56 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-black/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Routine Preview"
                        className="w-full h-auto object-contain max-h-56 mx-auto"
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>Change Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                      <button
                        onClick={() => handleAnalyzePhoto()}
                        disabled={isAnalyzing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 active:scale-95 transition-all"
                      >
                        {isAnalyzing ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Scanning Timetable with AI...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Scan Routine with AI</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        Upload or Snap Your Class Routine
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mt-1">
                        Take a photo of your notice board or choose routine image from phone gallery.
                      </p>
                    </div>

                    <div className="flex flex-col min-[400px]:flex-row items-center justify-center gap-2 pt-2">
                      <label className="w-full min-[400px]:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold cursor-pointer shadow-xs active:scale-95 transition-all">
                        <Camera className="h-4 w-4" />
                        <span>Take Photo / Choose Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>

                      {savedRoutinePhoto && (
                        <button
                          type="button"
                          onClick={() => {
                            setImagePreview(savedRoutinePhoto);
                            handleAnalyzePhoto(savedRoutinePhoto);
                          }}
                          className="w-full min-[400px]:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 px-3 py-2.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                          <span>Use Saved Photo</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {isAnalyzing && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/30 p-4 text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  </div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    Gemini Vision is parsing class codes, rooms, and schedule timings...
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    This usually takes 3 to 6 seconds.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PASTE TEXT */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-1">
                  Paste Class Schedule Text
                </label>
                <textarea
                  value={routineText}
                  onChange={(e) => setRoutineText(e.target.value)}
                  placeholder={`Friday:
08:30 - 10:30 MAT 0541 1203 Mathematics-II (Room 701, RS)
10:30 - 12:00 CSE 0613 1203 Structured Programming (Room 704, MRC)
12:00 - 13:30 CSE 0613 1203 Structured Programming Lab (Room 704, MRC)
14:45 - 16:45 PHY 0533 1203 Physics-II (Room 701, NAJ)
16:45 - 18:45 PHY 0533 1203 Physics-II Lab (Physics Lab JR, NAJ)

Saturday:
19:00 - 21:00 ENG 0231 1201 English-II (Online, TS)
21:00 - 23:00 CSE 0613 1205 Discrete Mathematics (Online, HP)`}
                  rows={6}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 p-3 text-xs sm:text-sm font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">
                  AI will auto-detect days, periods, course codes & teachers.
                </span>
                <button
                  onClick={handleAnalyzeText}
                  disabled={isAnalyzing || !routineText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 active:scale-95 transition-all"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Parsing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Parse with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SEMESTER PRESET */}
          {activeTab === 'preset' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-blue-950/30 dark:to-indigo-950/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-500" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      Semester 1 Weekly Timetable
                    </h3>
                  </div>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                    7 Classes / Week
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5">
                  Five periods on Friday, two online periods on Saturday evening. Nothing scheduled Sunday to Thursday.
                </p>

                <div className="mt-3 grid grid-cols-1 min-[400px]:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-purple-600 dark:text-purple-400">MAT 0541 1203</span>: Mathematics-II
                    <div className="text-[10px] text-zinc-500">3.0 Cr • RS • Room 701</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-blue-600 dark:text-blue-400">CSE 0613 1203</span>: Structured Programming
                    <div className="text-[10px] text-zinc-500">3.0 Cr • MRC • Room 704 + lab</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-amber-600 dark:text-amber-400">PHY 0533 1203</span>: Physics-II
                    <div className="text-[10px] text-zinc-500">3.0 Cr • NAJ • Room 701 + lab</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-pink-600 dark:text-pink-400">ENG 0231 1201</span>: English-II
                    <div className="text-[10px] text-zinc-500">3.0 Cr • TS • Online (Sat)</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">CSE 0613 1205</span>: Discrete Math
                    <div className="text-[10px] text-zinc-500">3.0 Cr • HP • Online (Sat)</div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end">
                  <button
                    onClick={handleApplyPreset}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Applying Semester 1 Timetable...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 text-amber-300" />
                        <span>Apply Semester 1 Preset</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SAVED ROUTINE PHOTO VIEWER */}
          {activeTab === 'saved' && savedRoutinePhoto && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Your Uploaded Official Timetable Document
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setImagePreview(savedRoutinePhoto);
                      setActiveTab('photo');
                      handleAnalyzePhoto(savedRoutinePhoto);
                    }}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-semibold"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Re-scan with AI</span>
                  </button>
                  <button
                    onClick={handleDeleteSavedPhoto}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:underline font-semibold"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1 flex items-center justify-center max-h-[60vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={savedRoutinePhoto}
                  alt="Saved Official Routine"
                  className="w-full h-auto object-contain max-h-[58vh] rounded-xl"
                />
              </div>
            </div>
          )}

          {/* EXTRACTED SLOTS PREVIEW & CONFIRMATION */}
          {extractedSlots.length > 0 && (
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="flex flex-col min-[400px]:flex-row min-[400px]:items-center min-[400px]:justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Extracted Classes ({selectedSlotIndices.size}/{extractedSlots.length} Selected)
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Review extracted slots before importing.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAllSlots}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {selectedSlotIndices.size === extractedSlots.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={(e) => setReplaceExisting(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0"
                    />
                    <span>Replace current routine</span>
                  </label>
                </div>
              </div>

              {/* Slot Cards List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {extractedSlots.map((slot, index) => {
                  const isSelected = selectedSlotIndices.has(index);
                  return (
                    <div
                      key={index}
                      onClick={() => handleToggleSlotSelection(index)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-400 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/30'
                          : 'border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-600 text-white' 
                            : 'border-zinc-300 dark:border-zinc-600'
                        }`}>
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">
                              {slot.courseCode}
                            </span>
                            <span className="text-zinc-500 truncate max-w-[150px] min-[400px]:max-w-[200px]">
                              {slot.courseName}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5 flex-wrap">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {slot.day}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-3 w-3" />
                              {slot.startTime} – {slot.endTime}
                            </span>
                            {slot.room && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <MapPin className="h-3 w-3" />
                                  {slot.room}
                                </span>
                              </>
                            )}
                            {slot.faculty && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <User className="h-3 w-3" />
                                  {slot.faculty}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Confirm Import Button */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleImportSelected}
                  disabled={isSubmitting || selectedSlotIndices.size === 0}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Importing to Timetable...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Save &amp; Apply to My Routine</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

