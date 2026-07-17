import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnalysisResult, EmotionSegment, SpeechSegment, User } from '../types';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import {
  Pencil, Check, X, ShieldCheck, AlertCircle, ListFilter,
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Info,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisReportProps {
  data: AnalysisResult;
  videoUrl: string | null;
  onReset: () => void;
  user: User;
  onLogout: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_EMOTIONS = [
  'Love', 'Sexual Arousal', 'Affection', 'Romance',
  'Joy', 'Excited', 'Hope', 'Relief',
  'Anger', 'Rage', 'Furious', 'Fear', 'Terror', 'Pain', 'Anxiety',
  'Sadness', 'Grief', 'Guilt', 'Shame', 'Frustration',
  'Surprise', 'Shock', 'Amazement',
  'Neutral',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const timeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
};

const isTimeInRange = (time: string, start: string, end: string): boolean => {
  const t = timeToSeconds(time);
  return t >= timeToSeconds(start) && t <= timeToSeconds(end);
};

const formatTime = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

// ─── EmotionSelector ──────────────────────────────────────────────────────────

interface EmotionSelectorProps {
  selected: string;
  onChange: (val: string) => void;
}

const EmotionSelector: React.FC<EmotionSelectorProps> = ({ selected, onChange }) => {
  const current = selected.split(', ').filter(Boolean);
  const toggle = (emotion: string) => {
    let next: string[];
    if (current.includes(emotion)) {
      next = current.filter(e => e !== emotion);
    } else {
      next = current.length >= 2 ? [current[1], emotion] : [...current, emotion];
    }
    onChange(next.join(', '));
  };
  return (
    <div className="flex flex-wrap gap-1 max-w-[220px] p-1.5 bg-white border border-indigo-200 rounded-lg shadow-lg z-20">
      {AVAILABLE_EMOTIONS.map(e => (
        <button
          key={e}
          onClick={() => toggle(e)}
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            current.includes(e)
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AnalysisReport: React.FC<AnalysisReportProps> = ({ data, videoUrl, onReset, user, onLogout }) => {

  // ── State ──────────────────────────────────────────────────────────────────

  // Preserved from original
  const [isEditMode, setIsEditMode] = useState(false);
  const [reportData, setReportData] = useState<AnalysisResult>(data);
  const [editingFacialIdx, setEditingFacialIdx] = useState<number | null>(null);

  // Video playback
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Script interaction
  const [selectedScriptIdx, setSelectedScriptIdx] = useState<number | null>(null);
  const [hoveredScriptIdx, setHoveredScriptIdx] = useState<number | null>(null);

  // Mismatch filters
  const [mismatchFilterType, setMismatchFilterType] = useState<'all' | 'definite' | 'potential'>('all');
  const [mismatchFilterFace, setMismatchFilterFace] = useState<string[]>([]);
  const [mismatchFilterSpeech, setMismatchFilterSpeech] = useState<string[]>([]);

  // Detected Emotion Analysis editing
  const [showSummary, setShowSummary] = useState(false);
  const [speechNotes, setSpeechNotes] = useState<Record<number, string>>({});
  const [isEditingSentiment, setIsEditingSentiment] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  // ── Refs ───────────────────────────────────────────────────────────────────

  const videoRef = useRef<HTMLVideoElement>(null);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simTimeRef = useRef(0);

  // ── Derived: max duration for simulated mode ────────────────────────────────

  const computedMaxDuration = useMemo(() => {
    if (videoUrl) return 0;
    return Math.max(
      0,
      ...reportData.facialEmotions.map(f => timeToSeconds(f.endTime)),
      ...reportData.speechAnalysis.map(s => timeToSeconds(s.endTime)),
    );
  }, [videoUrl, reportData.facialEmotions, reportData.speechAnalysis]);

  // ── Effects ────────────────────────────────────────────────────────────────

  // Sync mismatches when facial/speech data changes (original logic preserved)
  useEffect(() => {
    const updated = reportData.mismatches.map(m => {
      const facial = reportData.facialEmotions.find(f => isTimeInRange(m.timestamp, f.startTime, f.endTime));
      const speech = reportData.speechAnalysis.find(s => isTimeInRange(m.timestamp, s.startTime, s.endTime));
      return {
        ...m,
        visualEmotion: facial ? facial.emotion : m.visualEmotion,
        verbalEmotion: speech ? speech.sentiment : m.verbalEmotion,
      };
    });
    if (JSON.stringify(updated) !== JSON.stringify(reportData.mismatches)) {
      setReportData(prev => ({ ...prev, mismatches: updated }));
    }
  }, [reportData.facialEmotions, reportData.speechAnalysis]);

  // Set video duration for simulated mode
  useEffect(() => {
    if (!videoUrl && computedMaxDuration > 0) {
      setVideoDuration(computedMaxDuration);
    }
  }, [computedMaxDuration, videoUrl]);

  // Real video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoaded = () => setVideoDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoUrl]);

  // Simulated timer (when no real video)
  useEffect(() => {
    if (videoUrl) return;
    if (isPlaying) {
      simTimerRef.current = setInterval(() => {
        simTimeRef.current += 0.1;
        if (simTimeRef.current >= computedMaxDuration) {
          // Self-clear before state updates to avoid double-fire
          clearInterval(simTimerRef.current!);
          simTimerRef.current = null;
          simTimeRef.current = 0;
          setCurrentTime(computedMaxDuration);
          setIsPlaying(false);
          return;
        }
        setCurrentTime(parseFloat(simTimeRef.current.toFixed(1)));
      }, 100);
    }
    return () => {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, [isPlaying, videoUrl, computedMaxDuration]);

  // Reset edit state when selected script segment changes
  useEffect(() => {
    setIsEditingSentiment(false);
    setIsEditingNote(false);
  }, [selectedScriptIdx]);

  // ── Memos ──────────────────────────────────────────────────────────────────

  // All potential contradictions (original logic preserved)
  const allContradictions = useMemo(() => {
    const result: any[] = [];
    reportData.speechAnalysis.forEach(s => {
      const sStart = timeToSeconds(s.startTime);
      const sEnd = timeToSeconds(s.endTime);
      reportData.facialEmotions
        .filter(f => sStart < timeToSeconds(f.endTime) && sEnd > timeToSeconds(f.startTime))
        .forEach(f => {
          const sE = s.sentiment.toLowerCase().split(',').map(e => e.trim()).filter(Boolean).sort();
          const fE = f.emotion.toLowerCase().split(',').map(e => e.trim()).filter(Boolean).sort();
          if (JSON.stringify(sE) !== JSON.stringify(fE)) {
            result.push({
              timestamp: f.startTime,
              visualEmotion: f.emotion,
              verbalEmotion: s.sentiment,
              text: s.text,
              facialTime: `${f.startTime}–${f.endTime}`,
            });
          }
        });
    });
    return result;
  }, [reportData.facialEmotions, reportData.speechAnalysis]);

  // Active facial segment index based on currentTime (defaults to 0 at start)
  const activeFacialIdx = useMemo(() => {
    if (!reportData.facialEmotions.length) return -1;
    const idx = reportData.facialEmotions.findIndex(
      f => currentTime >= timeToSeconds(f.startTime) && currentTime <= timeToSeconds(f.endTime),
    );
    return idx >= 0 ? idx : 0;
  }, [currentTime, reportData.facialEmotions]);

  // Active speech segment index based on currentTime (defaults to 0 at start)
  const activeSpeechIdx = useMemo(() => {
    if (!reportData.speechAnalysis.length) return -1;
    const idx = reportData.speechAnalysis.findIndex(
      s => currentTime >= timeToSeconds(s.startTime) && currentTime <= timeToSeconds(s.endTime),
    );
    return idx >= 0 ? idx : 0;
  }, [currentTime, reportData.speechAnalysis]);

  // Contradiction rate for current segment
  const contradictionRate = useMemo(() => {
    if (activeFacialIdx < 0) return 'NONE';
    const facial = reportData.facialEmotions[activeFacialIdx];
    const confirmed = reportData.mismatches.find(m =>
      isTimeInRange(m.timestamp, facial.startTime, facial.endTime),
    );
    if (confirmed) return confirmed.severity;
    const potential = allContradictions.some(c =>
      isTimeInRange(c.timestamp, facial.startTime, facial.endTime),
    );
    return potential ? 'POTENTIAL' : 'NONE';
  }, [activeFacialIdx, reportData.facialEmotions, reportData.mismatches, allContradictions]);

  // Unique emotion lists for filters
  const uniqueFacialEmotions = useMemo(
    () => [...new Set(reportData.facialEmotions.map(f => f.emotion))].sort(),
    [reportData.facialEmotions],
  );
  const uniqueSpeechEmotions = useMemo(
    () => [...new Set(reportData.speechAnalysis.map(s => s.sentiment))].sort(),
    [reportData.speechAnalysis],
  );

  // Combined mismatch list (definite + potential)
  const allMismatchesForDisplay = useMemo(() => {
    const confirmedTs = new Set(reportData.mismatches.map(m => m.timestamp));
    return {
      definite: reportData.mismatches.map(m => ({ ...m, kind: 'definite' as const })),
      potential: allContradictions
        .filter(c => !confirmedTs.has(c.timestamp))
        .map(c => ({ ...c, severity: 'POTENTIAL' as any, kind: 'potential' as const })),
    };
  }, [reportData.mismatches, allContradictions]);

  // Filtered + sorted mismatch list (definite first, then potential, each chronological)
  const filteredMismatches = useMemo(() => {
    let { definite, potential } = allMismatchesForDisplay;
    if (mismatchFilterType === 'definite') potential = [];
    if (mismatchFilterType === 'potential') definite = [];
    if (mismatchFilterFace.length) {
      definite = definite.filter(m => mismatchFilterFace.includes(m.visualEmotion));
      potential = potential.filter(m => mismatchFilterFace.includes(m.visualEmotion));
    }
    if (mismatchFilterSpeech.length) {
      definite = definite.filter(m => mismatchFilterSpeech.includes(m.verbalEmotion));
      potential = potential.filter(m => mismatchFilterSpeech.includes(m.verbalEmotion));
    }
    const byTime = (a: any, b: any) => timeToSeconds(a.timestamp) - timeToSeconds(b.timestamp);
    return [...definite.sort(byTime), ...potential.sort(byTime)];
  }, [allMismatchesForDisplay, mismatchFilterType, mismatchFilterFace, mismatchFilterSpeech]);

  // Chart data for confidence line
  const chartData = useMemo(
    () => reportData.facialEmotions.map(f => ({ time: f.startTime, confidence: f.confidence, label: f.emotion })),
    [reportData.facialEmotions],
  );
  const currentChartLabel = activeFacialIdx >= 0 ? reportData.facialEmotions[activeFacialIdx]?.startTime : null;

  // Derived selected-segment values
  const activeFacial = activeFacialIdx >= 0 ? reportData.facialEmotions[activeFacialIdx] : null;
  const activeSpeech = activeSpeechIdx >= 0 ? reportData.speechAnalysis[activeSpeechIdx] : null;
  const selectedSpeech = selectedScriptIdx !== null ? reportData.speechAnalysis[selectedScriptIdx] : null;
  const selectedFacial = selectedSpeech
    ? reportData.facialEmotions.find(f => isTimeInRange(selectedSpeech.startTime, f.startTime, f.endTime))
    : undefined;

  // ── Helper Functions ───────────────────────────────────────────────────────

  const hasInternalContradiction = (s: string): boolean => {
    const emotions = s.toLowerCase().split(',').map(e => e.trim());
    const pos = ['love', 'sexual', 'arousal', 'affection', 'romance', 'joy', 'excited', 'hope', 'relief'];
    const neg = ['guilt', 'shame', 'sadness', 'grief', 'pain', 'frustration'];
    return (
      emotions.some(e => pos.some(p => e.includes(p))) &&
      emotions.some(e => neg.some(n => e.includes(n)))
    );
  };

  const getEmotionColorClass = (emotion: string): string => {
    const e = emotion.toLowerCase();
    if (['love', 'sexual', 'arousal', 'affection', 'romance'].some(k => e.includes(k)))
      return 'bg-pink-100 text-pink-800 border-pink-200';
    if (['happy', 'joy', 'positive', 'excited', 'hope', 'relief'].some(k => e.includes(k)))
      return 'bg-green-100 text-green-800 border-green-200';
    if (['anger', 'angry', 'rage', 'furious', 'fear', 'terror', 'pain', 'anxiety', 'anxious'].some(k => e.includes(k)))
      return 'bg-red-100 text-red-800 border-red-200';
    if (['sad', 'grief', 'guilt', 'shame', 'depression', 'frustration'].some(k => e.includes(k)))
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (['surprise', 'shock', 'amazement'].some(k => e.includes(k)))
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-gray-200 text-gray-700 border-gray-300';
  };

  const getSeverityConfig = (s: string) => {
    switch (s) {
      case 'HIGH':      return { label: 'High',      badge: 'bg-red-100 text-red-700 border-red-300',       border: 'border-l-red-500',    dot: 'bg-red-500 w-3 h-3' };
      case 'MEDIUM':    return { label: 'Medium',    badge: 'bg-orange-100 text-orange-700 border-orange-300', border: 'border-l-orange-400', dot: 'bg-orange-400 w-2.5 h-2.5' };
      case 'LOW':       return { label: 'Low',       badge: 'bg-yellow-100 text-yellow-700 border-yellow-300', border: 'border-l-yellow-400', dot: 'bg-yellow-400 w-2 h-2' };
      case 'POTENTIAL': return { label: 'Potential', badge: 'bg-blue-50 text-blue-600 border-blue-200',      border: 'border-l-blue-400',   dot: 'bg-blue-400 w-2 h-2' };
      default:          return { label: 'None',      badge: 'bg-gray-100 text-gray-500 border-gray-200',     border: 'border-l-gray-300',   dot: 'bg-gray-300 w-2 h-2' };
    }
  };

  const getRateConfig = (rate: string) => {
    switch (rate) {
      case 'HIGH':      return { label: 'High',              cls: 'bg-red-50 border-red-300 text-red-700',       dot: 'bg-red-500' };
      case 'MEDIUM':    return { label: 'Medium',            cls: 'bg-orange-50 border-orange-300 text-orange-700', dot: 'bg-orange-400' };
      case 'LOW':       return { label: 'Low',               cls: 'bg-yellow-50 border-yellow-300 text-yellow-700', dot: 'bg-yellow-400' };
      case 'POTENTIAL': return { label: 'Potential Mismatch', cls: 'bg-blue-50 border-blue-300 text-blue-700',   dot: 'bg-blue-400' };
      default:          return { label: 'No Mismatch',       cls: 'bg-green-50 border-green-300 text-green-700', dot: 'bg-green-500' };
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const seekToTime = (t: number) => {
    const safe = Math.max(0, Math.min(videoDuration, t));
    if (videoRef.current && videoUrl) {
      videoRef.current.currentTime = safe;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      simTimeRef.current = safe;
      setCurrentTime(safe);
      setIsPlaying(true);
    }
  };

  const seekTo = (ts: string) => seekToTime(timeToSeconds(ts));

  const handlePlayPause = () => {
    if (videoRef.current && videoUrl) {
      isPlaying ? videoRef.current.pause() : videoRef.current.play().catch(() => {});
    } else {
      setIsPlaying(p => !p);
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekToTime(ratio * videoDuration);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    if (videoRef.current) videoRef.current.volume = v;
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (videoRef.current) videoRef.current.volume = next ? 0 : volume;
  };

  const toggleFaceFilter = (e: string) =>
    setMismatchFilterFace(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  const toggleSpeechFilter = (e: string) =>
    setMismatchFilterSpeech(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);

  // ── Derived display values ─────────────────────────────────────────────────

  const rateConf = getRateConfig(contradictionRate);
  const timelineProgress = videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-100">

      {/* ━━━ Unified Navbar ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-none bg-white border-b border-gray-200 shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center">
              <span className="text-indigo-600 text-xl mr-1.5">◉</span>
              <h1 className="text-lg font-bold tracking-tight text-gray-900">EmoSync</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditMode(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                isEditMode
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {isEditMode ? 'Exit Supervisor Mode' : 'Supervisor Mode'}
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Analyze Another
            </button>

            <div className="h-4 w-px bg-gray-200 mx-2 hidden sm:block" />
            <span className="text-xs text-gray-500 hidden sm:block">Welcome, {user.name}</span>
            <div className="h-4 w-px bg-gray-200 mx-2 hidden sm:block" />

            <button
              onClick={onLogout}
              className="text-xs font-semibold text-gray-505 hover:text-red-600 transition-colors px-2 py-1.5"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* ━━━ Dashboard Body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 flex gap-2 p-2 overflow-hidden min-h-0">

        {/* ══ LEFT COLUMN (35%) ══════════════════════════════════════════════ */}
        <div className="w-[35%] flex flex-col gap-2 min-w-0">

          {/* ── Video Player + Controls + Timeline ── */}
          <div className="flex-none bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

            {/* Video */}
            <div className="bg-gray-950 aspect-video relative">
              {videoUrl ? (
                <video ref={videoRef} src={videoUrl} className="w-full h-full object-contain" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/20 select-none">
                  <Play className="w-10 h-10" />
                  <span className="text-xs tracking-wider">SIMULATED MODE</span>
                </div>
              )}
            </div>

            {/* Custom Controls */}
            <div className="bg-gray-900 px-3 py-2 flex items-center gap-2.5">
              <button
                onClick={() => seekToTime(Math.max(0, currentTime - 10))}
                className="text-white/50 hover:text-white transition-colors"
                title="Rewind 10s"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={handlePlayPause}
                className="text-white hover:text-indigo-300 transition-colors"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button
                onClick={() => seekToTime(Math.min(videoDuration, currentTime + 10))}
                className="text-white/50 hover:text-white transition-colors"
                title="Forward 10s"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <span className="flex-1 text-center text-white/40 text-[11px] font-mono">
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </span>
              <button onClick={toggleMute} className="text-white/50 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range" min="0" max="1" step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 accent-indigo-400 cursor-pointer"
              />
            </div>

            {/* Timeline Bar */}
            <div className="px-3 pt-2 pb-1.5 bg-gray-50 border-t border-gray-100">
              <div
                className="relative h-7 cursor-pointer select-none"
                onClick={handleTimelineClick}
                title="Click to seek"
              >
                {/* Track */}
                <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${timelineProgress}%`, transition: 'width 0.1s linear' }}
                  />
                </div>

                {/* Confirmed mismatch dots */}
                {reportData.mismatches.map((m, i) => {
                  const pct = videoDuration > 0 ? (timeToSeconds(m.timestamp) / videoDuration) * 100 : 0;
                  const cfg = getSeverityConfig(m.severity);
                  return (
                    <button
                      key={`cm-${i}`}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full shadow-sm z-10 hover:scale-150 transition-transform ${cfg.dot}`}
                      style={{ left: `${pct}%` }}
                      onClick={e => { e.stopPropagation(); seekTo(m.timestamp); }}
                      title={`${cfg.label}: ${m.visualEmotion} vs ${m.verbalEmotion} @ ${m.timestamp}`}
                    />
                  );
                })}

                {/* Potential contradiction dots */}
                {allMismatchesForDisplay.potential.map((c, i) => {
                  const pct = videoDuration > 0 ? (timeToSeconds(c.timestamp) / videoDuration) * 100 : 0;
                  return (
                    <button
                      key={`pm-${i}`}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 z-10 hover:scale-150 transition-transform"
                      style={{ left: `${pct}%` }}
                      onClick={e => { e.stopPropagation(); seekTo(c.timestamp); }}
                      title={`Potential: ${c.visualEmotion} vs ${c.verbalEmotion} @ ${c.timestamp}`}
                    />
                  );
                })}

                {/* Playhead */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-indigo-500 rounded-full shadow-md pointer-events-none z-20"
                  style={{ left: `${timelineProgress}%`, transition: 'left 0.1s linear' }}
                />
              </div>
            </div>
          </div>

          {/* ── Segment Emotion Analysis ── */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
            <div className="flex-none px-3 py-2 border-b border-gray-100 bg-slate-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Segment Emotion Analysis</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {activeFacial ? `${activeFacial.startTime} – ${activeFacial.endTime}` : '—'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {/* Caption */}
              {activeSpeech && (
                <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2.5 italic leading-relaxed">
                  "{activeSpeech.text}"
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {/* Facial / Non-verbal */}
                <div className="bg-red-50/40 border border-red-100 rounded-lg p-2">
                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Facial / Non-verbal
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeFacial
                      ? activeFacial.emotion.split(',').map((e, i) => (
                          <span
                            key={i}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center ${getEmotionColorClass(e.trim())}`}
                          >
                            {e.trim()}
                            {hasInternalContradiction(e.trim()) && <span className="ml-0.5 text-amber-500">✦</span>}
                          </span>
                        ))
                      : <span className="text-[10px] text-gray-400">—</span>
                    }
                  </div>
                </div>

                {/* Speech / Verbal */}
                <div className="bg-green-50/40 border border-green-100 rounded-lg p-2">
                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Speech / Verbal
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {activeSpeech
                      ? activeSpeech.sentiment.split(',').map((e, i) => (
                          <span
                            key={i}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium inline-flex items-center ${getEmotionColorClass(e.trim())}`}
                          >
                            {e.trim()}
                            {hasInternalContradiction(e.trim()) && <span className="ml-0.5 text-amber-500">✦</span>}
                          </span>
                        ))
                      : <span className="text-[10px] text-gray-400">—</span>
                    }
                  </div>
                </div>
              </div>

              {/* Contradiction Rate */}
              <div className="pt-0.5">
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                  Contradiction Rate
                </span>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${rateConf.cls}`}>
                  <span className={`w-2 h-2 rounded-full flex-none ${rateConf.dot}`} />
                  {rateConf.label}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══ MIDDLE COLUMN (35%) ════════════════════════════════════════════ */}
        <div className="w-[35%] flex flex-col gap-2 min-w-0">

          {/* ── Facial Analysis Logs ── */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
            <div className="flex-none px-3 py-2 border-b border-gray-100 bg-slate-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Facial Analysis Logs</h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                ✦ = internal contradiction · <span className="text-red-400">red line</span> = current position
              </p>
            </div>

            {/* Chart (left) + Table (right) */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Chart */}
              <div className="w-[46%] flex-none border-r border-gray-100 p-2 flex flex-col min-h-0">
                <p className="text-[9px] text-gray-400 uppercase tracking-wider mb-1 flex-none">Confidence</p>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 7 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 7 }} width={26} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white p-1.5 border border-gray-200 shadow rounded text-[10px]">
                              <span className={`px-1.5 py-0.5 rounded w-fit block ${getEmotionColorClass(d.label)}`}>{d.label}</span>
                              <p className="text-gray-500 mt-0.5">{(Number(payload[0].value) * 100).toFixed(0)}%</p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="confidence"
                        stroke="#4F46E5"
                        strokeWidth={1.5}
                        dot={{ r: 2, strokeWidth: 0, fill: '#4F46E5' }}
                        activeDot={{ r: 3 }}
                      />
                      {currentChartLabel && (
                        <ReferenceLine x={currentChartLabel} stroke="#EF4444" strokeWidth={1.5} strokeDasharray="3 2" />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-gray-400 font-semibold uppercase tracking-wider">Time</th>
                      <th className="px-2 py-1.5 text-left text-gray-400 font-semibold uppercase tracking-wider">Emotion</th>
                      <th className="px-2 py-1.5 text-left text-gray-400 font-semibold uppercase tracking-wider">Conf.</th>
                      {isEditMode && <th className="px-2 py-1.5 w-6" />}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.facialEmotions.map((row, i) => (
                      <tr
                        key={i}
                        className={`border-b border-gray-50 transition-colors ${
                          i === activeFacialIdx ? 'bg-indigo-50/60' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-2 py-1.5 font-mono text-gray-500 whitespace-nowrap">
                          {row.startTime}
                        </td>
                        <td className="px-2 py-1.5">
                          {editingFacialIdx === i ? (
                            <EmotionSelector
                              selected={row.emotion}
                              onChange={val => {
                                const ne = [...reportData.facialEmotions];
                                ne[i] = { ...ne[i], emotion: val };
                                setReportData(prev => ({ ...prev, facialEmotions: ne }));
                              }}
                            />
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded-full border text-[9px] font-medium inline-flex items-center w-fit ${getEmotionColorClass(row.emotion)}`}>
                              {row.emotion}
                              {hasInternalContradiction(row.emotion) && <span className="ml-0.5 text-amber-500">✦</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-gray-400">
                          {editingFacialIdx === i ? (
                            <input
                              type="number" min="0" max="100"
                              value={Math.round(row.confidence * 100)}
                              onChange={e => {
                                const ne = [...reportData.facialEmotions];
                                ne[i] = { ...ne[i], confidence: Number(e.target.value) / 100 };
                                setReportData(prev => ({ ...prev, facialEmotions: ne }));
                              }}
                              className="w-12 px-1 border border-gray-200 rounded text-[10px]"
                            />
                          ) : `${(row.confidence * 100).toFixed(0)}%`}
                        </td>
                        {isEditMode && (
                          <td className="px-2 py-1.5 text-right">
                            <button
                              onClick={() => setEditingFacialIdx(editingFacialIdx === i ? null : i)}
                              className="text-gray-300 hover:text-indigo-600 transition-colors"
                            >
                              {editingFacialIdx === i ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── List of All Mismatches ── */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
            <div className="flex-none px-3 py-2 border-b border-gray-100 bg-slate-50 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-none" />
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">All Mismatches</h3>
              <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {filteredMismatches.length}
              </span>
            </div>

            {/* Filters */}
            <div className="flex-none px-3 py-2 border-b border-gray-100 bg-gray-50/40 space-y-1.5">
              {/* Confidence type */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] font-semibold text-gray-400 uppercase w-16 flex-none">Confidence</span>
                {(['all', 'definite', 'potential'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setMismatchFilterType(t)}
                    className={`text-[10px] px-2 py-0.5 rounded-full border capitalize font-medium transition-colors ${
                      mismatchFilterType === t
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {/* Facial emotion filter */}
              {uniqueFacialEmotions.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] font-semibold text-gray-400 uppercase w-16 flex-none">Face</span>
                  {uniqueFacialEmotions.map(e => (
                    <button
                      key={e}
                      onClick={() => toggleFaceFilter(e)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                        mismatchFilterFace.includes(e)
                          ? getEmotionColorClass(e)
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {/* Speech emotion filter */}
              {uniqueSpeechEmotions.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[9px] font-semibold text-gray-400 uppercase w-16 flex-none">Speech</span>
                  {uniqueSpeechEmotions.map(e => (
                    <button
                      key={e}
                      onClick={() => toggleSpeechFilter(e)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                        mismatchFilterSpeech.includes(e)
                          ? getEmotionColorClass(e)
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mismatch list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filteredMismatches.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-gray-400 flex-col gap-2">
                  <ListFilter className="w-6 h-6 text-gray-300" />
                  No mismatches match the current filters.
                </div>
              ) : (
                filteredMismatches.map((m: any, idx) => {
                  const cfg = getSeverityConfig(m.kind === 'potential' ? 'POTENTIAL' : m.severity);
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border-l-4 ${cfg.border} border border-gray-100 bg-white p-2.5 hover:shadow-sm transition-shadow`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          onClick={() => seekTo(m.timestamp)}
                          className="flex items-center gap-1 text-[10px] font-mono font-bold text-gray-500 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 px-1.5 py-0.5 rounded transition-colors"
                          title="Play from this timestamp"
                        >
                          <Play className="w-2.5 h-2.5" />
                          {m.timestamp}
                        </button>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px]">
                        <div>
                          <span className="block text-[9px] text-gray-400 uppercase mb-0.5">Face</span>
                          <span className={`font-medium ${getEmotionColorClass(m.visualEmotion).split(' ')[1]}`}>
                            {m.visualEmotion}
                          </span>
                        </div>
                        <div className="w-px h-5 bg-gray-200 flex-none" />
                        <div>
                          <span className="block text-[9px] text-gray-400 uppercase mb-0.5">Speech</span>
                          <span className={`font-medium ${getEmotionColorClass(m.verbalEmotion).split(' ')[1]}`}>
                            {m.verbalEmotion}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* ══ RIGHT COLUMN (30%) ══════════════════════════════════════════════ */}
        <div className="w-[30%] flex flex-col gap-2 min-w-0">

          {/* ── Script Panel ── */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
            <div className="flex-none px-3 py-2 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Script</h3>
                <p className="text-[10px] text-gray-400 mt-0.5">Hover to highlight · Click for details</p>
              </div>
              <button
                onClick={() => setShowSummary(true)}
                className="flex items-center gap-1 px-2.5 py-1.25 text-[10px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-sm"
              >
                <Info className="w-3.5 h-3.5" />
                Overall Summary
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-gray-700 leading-loose">
                {reportData.speechAnalysis.map((seg, idx) => {
                  const isHov = hoveredScriptIdx === idx;
                  const isSel = selectedScriptIdx === idx;
                  const isAct = idx === activeSpeechIdx;
                  return (
                    <span
                      key={idx}
                      onClick={() => setSelectedScriptIdx(idx)}
                      onMouseEnter={() => setHoveredScriptIdx(idx)}
                      onMouseLeave={() => setHoveredScriptIdx(null)}
                      title={`${seg.startTime}–${seg.endTime} · ${seg.sentiment}`}
                      className={`cursor-pointer rounded px-0.5 transition-colors ${
                        isSel
                          ? 'bg-indigo-100 underline decoration-indigo-400 decoration-dotted underline-offset-2'
                          : isHov
                            ? 'bg-slate-100'
                            : isAct
                              ? 'bg-blue-50'
                              : ''
                      }`}
                    >
                      {seg.text}{' '}
                    </span>
                  );
                })}
              </p>
            </div>
          </div>

          {/* ── Detected Emotion Analysis Panel ── */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden min-h-0">
            <div className="flex-none px-3 py-2 border-b border-gray-100 bg-slate-50">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Detected Emotion Analysis
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {selectedSpeech
                  ? `Segment: ${selectedSpeech.startTime} – ${selectedSpeech.endTime}`
                  : 'Select a script segment above'}
              </p>
            </div>

            {!selectedSpeech ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-300">
                <ListFilter className="w-8 h-8" />
                <p className="text-xs">Click a script segment to inspect</p>
              </div>
            ) : (
              <div className="flex-1 flex min-h-0 overflow-hidden">

                {/* Main content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">

                  {/* Selected text */}
                  <div className="text-xs text-gray-700 bg-indigo-50 border border-indigo-100 rounded-lg p-2.5 italic leading-relaxed">
                    "{selectedSpeech.text}"
                  </div>

                  {/* Detected emotions */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                      Detected Emotions &amp; Analysis
                    </span>

                    {/* Speech sentiment */}
                    <div>
                      <span className="text-[9px] text-gray-400 block mb-1">Speech</span>
                      <div className="flex flex-wrap gap-1 items-center">
                        {isEditMode && isEditingSentiment ? (
                          <EmotionSelector
                            selected={selectedSpeech.sentiment}
                            onChange={val => {
                              const ns = [...reportData.speechAnalysis];
                              ns[selectedScriptIdx!] = { ...ns[selectedScriptIdx!], sentiment: val };
                              setReportData(prev => ({ ...prev, speechAnalysis: ns }));
                            }}
                          />
                        ) : (
                          selectedSpeech.sentiment.split(',').map((e, i) => (
                            <span
                              key={i}
                              className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${getEmotionColorClass(e.trim())}`}
                            >
                              {e.trim()}
                            </span>
                          ))
                        )}
                        {isEditMode && (
                          <button
                            onClick={() => setIsEditingSentiment(v => !v)}
                            className="text-gray-300 hover:text-indigo-600 transition-colors ml-1"
                          >
                            {isEditingSentiment ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Analysis note */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                        Analysis Note
                      </span>
                      {isEditMode && (
                        <button
                          onClick={() => {
                            if (isEditingNote) {
                              setSpeechNotes(prev => ({ ...prev, [selectedScriptIdx!]: noteText }));
                              setIsEditingNote(false);
                            } else {
                              setNoteText(speechNotes[selectedScriptIdx!] || '');
                              setIsEditingNote(true);
                            }
                          }}
                          className="text-gray-300 hover:text-indigo-600 transition-colors"
                        >
                          {isEditingNote ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    {isEditingNote ? (
                      <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Add analysis note for this segment..."
                        className="w-full text-xs border border-gray-200 rounded-lg p-2 resize-none focus:ring-1 focus:ring-indigo-400 focus:outline-none"
                        rows={3}
                      />
                    ) : (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {speechNotes[selectedScriptIdx!] || (
                          <span className="text-gray-300 italic">
                            {isEditMode ? 'Click ✎ to add a note.' : 'No analysis note.'}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right sidebar: timestamp + confidence */}
                <div className="w-20 flex-none border-l border-gray-100 bg-gray-50 p-2.5 flex flex-col gap-3">
                  <div>
                    <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                      Timestamp
                    </span>
                    <button
                      onClick={() => seekTo(selectedSpeech.startTime)}
                      className="flex items-center gap-0.5 text-[10px] font-mono text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 hover:border-indigo-400 px-1.5 py-1 rounded-lg w-full justify-center transition-colors shadow-sm"
                      title="Play from this timestamp"
                    >
                      <Play className="w-2 h-2 flex-none" />
                      {selectedSpeech.startTime}
                    </button>
                  </div>
                  {selectedFacial && (
                    <div>
                      <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Confidence
                      </span>
                      {isEditMode ? (
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={Math.round(selectedFacial.confidence * 100)}
                            onChange={e => {
                              const facialIdx = reportData.facialEmotions.findIndex(
                                f => f.startTime === selectedFacial.startTime && f.endTime === selectedFacial.endTime
                              );
                              if (facialIdx >= 0) {
                                const ne = [...reportData.facialEmotions];
                                ne[facialIdx] = {
                                  ...ne[facialIdx],
                                  confidence: Number(e.target.value) / 100,
                                };
                                setReportData(prev => ({ ...prev, facialEmotions: ne }));
                              }
                            }}
                            className="w-14 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold text-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-[9px] text-gray-400">%</span>
                        </div>
                      ) : (
                        <>
                          <p className="text-center leading-none">
                            <span className="text-xl font-bold text-indigo-600">
                              {(selectedFacial.confidence * 100).toFixed(0)}
                            </span>
                            <span className="text-[9px] text-gray-400">%</span>
                          </p>
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-1.5">
                            <div
                              className="bg-indigo-400 h-1 rounded-full transition-all"
                              style={{ width: `${selectedFacial.confidence * 100}%` }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ━━━ Overall Summary Modal ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowSummary(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 border border-gray-100 animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold text-gray-900">Overall Summary</h3>
              </div>
              <button
                onClick={() => setShowSummary(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{reportData.overallSummary}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisReport;
