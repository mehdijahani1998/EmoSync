import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnalysisResult, Mismatch, EmotionSegment, SpeechSegment } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Pencil, Check, X, ShieldCheck, AlertCircle, ListFilter, Play } from 'lucide-react';

interface AnalysisReportProps {
  data: AnalysisResult;
  videoUrl: string | null;
  onReset: () => void;
}

const AVAILABLE_EMOTIONS = [
  'Love', 'Sexual Arousal', 'Affection', 'Romance',
  'Joy', 'Excited', 'Hope', 'Relief',
  'Anger', 'Rage', 'Furious', 'Fear', 'Terror', 'Pain', 'Anxiety',
  'Sadness', 'Grief', 'Guilt', 'Shame', 'Frustration',
  'Surprise', 'Shock', 'Amazement',
  'Neutral'
];

// Helper to convert timestamp string (MM:SS or HH:MM:SS) to seconds
const timeToSeconds = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
};

const isTimeInRange = (time: string, start: string, end: string): boolean => {
  const t = timeToSeconds(time);
  const s = timeToSeconds(start);
  const e = timeToSeconds(end);
  return t >= s && t <= e;
};

const AnalysisReport: React.FC<AnalysisReportProps> = ({ data, videoUrl, onReset }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [reportData, setReportData] = useState<AnalysisResult>(data);
  const [editingFacialIdx, setEditingFacialIdx] = useState<number | null>(null);
  const [editingSpeechIdx, setEditingSpeechIdx] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  const seekTo = (timestamp: string) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeToSeconds(timestamp);
      videoRef.current.play().catch(() => { });
    }
  };

  // Sync mismatches when facial or speech data changes
  useEffect(() => {
    const updatedMismatches = reportData.mismatches.map(m => {
      const facial = reportData.facialEmotions.find(f => isTimeInRange(m.timestamp, f.startTime, f.endTime));
      const speech = reportData.speechAnalysis.find(s => isTimeInRange(m.timestamp, s.startTime, s.endTime));

      return {
        ...m,
        visualEmotion: facial ? facial.emotion : m.visualEmotion,
        verbalEmotion: speech ? speech.sentiment : m.verbalEmotion,
      };
    });

    // Only update if something actually changed to avoid infinite loops
    if (JSON.stringify(updatedMismatches) !== JSON.stringify(reportData.mismatches)) {
      setReportData(prev => ({ ...prev, mismatches: updatedMismatches }));
    }
  }, [reportData.facialEmotions, reportData.speechAnalysis]);

  // Calculate all potential contradictions based on current logs
  const allContradictions = useMemo(() => {
    const contradictions: any[] = [];

    reportData.speechAnalysis.forEach(s => {
      const sStart = timeToSeconds(s.startTime);
      const sEnd = timeToSeconds(s.endTime);

      // Find facial segments that overlap with this speech segment
      const overlaps = reportData.facialEmotions.filter(f => {
        const fStart = timeToSeconds(f.startTime);
        const fEnd = timeToSeconds(f.endTime);
        return (sStart < fEnd && sEnd > fStart);
      });

      overlaps.forEach(f => {
        const sEmotions = s.sentiment.toLowerCase().split(',').map(e => e.trim()).filter(Boolean).sort();
        const fEmotions = f.emotion.toLowerCase().split(',').map(e => e.trim()).filter(Boolean).sort();

        const isMismatch = JSON.stringify(sEmotions) !== JSON.stringify(fEmotions);

        if (isMismatch) {
          contradictions.push({
            timestamp: f.startTime, // Use facial start time for more precision
            visualEmotion: f.emotion,
            verbalEmotion: s.sentiment,
            text: s.text,
            facialTime: `${f.startTime}-${f.endTime}`,
            speechTime: `${s.startTime}-${s.endTime}`
          });
        }
      });
    });

    return contradictions;
  }, [reportData.facialEmotions, reportData.speechAnalysis]);

  // Transform data to map facial emotion confidence over time
  const chartData = reportData.facialEmotions.map((f, i) => ({
    time: f.startTime,
    confidence: f.confidence,
    visualLabel: f.emotion,
  }));

  // Helper to determine if two emotions in the same segment contradict each other
  const hasInternalContradiction = (emotionsStr: string): boolean => {
    const emotions = emotionsStr.toLowerCase().split(',').map(e => e.trim());

    const positive = ['love', 'sexual', 'arousal', 'affection', 'romance', 'joy', 'excited', 'hope', 'relief'];
    const inhibitory = ['guilt', 'shame', 'sadness', 'grief', 'pain', 'frustration'];

    const hasPositive = emotions.some(e => positive.some(p => e.includes(p)));
    const hasInhibitory = emotions.some(e => inhibitory.some(i => e.includes(i)));

    return hasPositive && hasInhibitory;
  };

  // Helper to determine badge color based on emotion text
  const getEmotionColorClass = (emotion: string) => {
    const e = emotion.toLowerCase();

    // Love & Sexual Excitement -> Pink/Rose
    if (['love', 'sexual', 'arousal', 'affection', 'romance'].some(k => e.includes(k))) {
      return 'bg-pink-100 text-pink-800 border-pink-200';
    }

    // Positive -> Green
    if (['happy', 'joy', 'positive', 'excited', 'hope', 'relief'].some(k => e.includes(k))) {
      return 'bg-green-100 text-green-800 border-green-200';
    }

    // Negative / High Intensity -> Red (Rage, Anger, Fear, Pain, Anxiety)
    if (['anger', 'angry', 'rage', 'furious', 'fear', 'terror', 'pain', 'anxiety', 'anxious'].some(k => e.includes(k))) {
      return 'bg-red-100 text-red-800 border-red-200';
    }

    // Negative / Complex -> Indigo/Purple/Orange (Sadness, Grief, Guilt)
    if (['sad', 'grief', 'grieving', 'guilt', 'shame', 'depression', 'frustration'].some(k => e.includes(k))) {
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }

    // Surprise -> Yellow
    if (['surprise', 'shock', 'amazement'].some(k => e.includes(k))) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }

    return 'bg-gray-200 text-gray-700 border-gray-300';
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analysis Report</h1>
          <p className="text-gray-500 mt-1">Cross-modal analysis complete</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm transition-colors ${isEditMode
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            <ShieldCheck className={`w-4 h-4 mr-2 ${isEditMode ? 'text-white' : 'text-indigo-600'}`} />
            {isEditMode ? 'Exit Supervisor Mode' : 'Supervisor Edit Mode'}
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
          >
            Analyze Another Video
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Video Player & Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black rounded-xl overflow-hidden shadow-lg aspect-video relative">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white">Video Source Unavailable</div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Summary</h3>
            <p className="text-gray-700 leading-relaxed">{reportData.overallSummary}</p>
          </div>
        </div>

        {/* Mismatches Panels */}
        <div className="lg:col-span-1 space-y-6 flex flex-col h-[600px]">
          {/* Detected Mismatches (AI) */}
          <div className="bg-white rounded-xl shadow border border-gray-100 flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-red-50">
              <h3 className="text-lg font-semibold text-red-800 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" /> AI Detected Mismatches
              </h3>
              <p className="text-xs text-red-600 mt-1">
                Significant contradictions detected.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {reportData.mismatches.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                  <p>No significant behavioral mismatches detected.</p>
                </div>
              ) : (
                reportData.mismatches.map((m, idx) => (
                  <div key={idx} className={`p-4 rounded-lg border-l-4 ${m.severity === 'HIGH' ? 'border-red-500 bg-red-50' : 'border-yellow-400 bg-yellow-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <button
                        onClick={() => seekTo(m.timestamp)}
                        className="text-xs font-mono font-bold text-gray-600 bg-white px-2 py-1 rounded border hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center"
                        title="Seek to timestamp"
                      >
                        <Play className="w-2.5 h-2.5 mr-1" />
                        {m.timestamp}
                      </button>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.severity === 'HIGH' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                        {m.severity}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="block text-xs text-gray-500 uppercase">Face</span>
                        <span className={`font-medium ${getEmotionColorClass(m.visualEmotion).split(' ')[1]}`}>{m.visualEmotion}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500 uppercase">Speech</span>
                        <span className={`font-medium ${getEmotionColorClass(m.verbalEmotion).split(' ')[1]}`}>{m.verbalEmotion}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* All Potential Contradictions (Calculated) */}
          <div className="bg-white rounded-xl shadow border border-gray-100 flex flex-col flex-1 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-indigo-50">
              <h3 className="text-lg font-semibold text-indigo-800 flex items-center">
                <ListFilter className="w-5 h-5 mr-2" /> All Potential Contradictions
              </h3>
              <p className="text-xs text-indigo-600 mt-1">
                Every frame where facial and speech labels differ.
              </p>
              <p className="text-[10px] text-indigo-500/80 mt-1">
                The ✦ icon shows internal contradiction in emotions based on facial gestures
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {allContradictions.length === 0 ? (
                <div className="text-center text-gray-500 mt-10">
                  <p className="text-sm">No label mismatches found.</p>
                </div>
              ) : (
                allContradictions.map((c, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                    <div className="flex justify-between items-center mb-2">
                      <button
                        onClick={() => seekTo(c.timestamp)}
                        className="text-[10px] font-mono font-bold text-gray-500 bg-white px-1.5 py-0.5 rounded border hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center"
                        title="Seek to timestamp"
                      >
                        <Play className="w-2 h-2 mr-1" />
                        {c.timestamp}
                      </button>
                      <span className="text-[10px] text-gray-400">Log: {c.facialTime}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-gray-400 uppercase">Face</span>
                        <span className={`font-medium flex items-center ${getEmotionColorClass(c.visualEmotion).split(' ')[1]}`}>
                          {c.visualEmotion}
                          {hasInternalContradiction(c.visualEmotion) && (
                            <span className="ml-1 text-amber-500 font-bold" title="Internal Contradiction Detected">✦</span>
                          )}
                        </span>
                      </div>
                      <div className="h-4 w-px bg-gray-200 mx-2"></div>
                      <div className="flex flex-col text-right">
                        <span className="text-[9px] text-gray-400 uppercase">Speech</span>
                        <span className={`font-medium flex items-center justify-end ${getEmotionColorClass(c.verbalEmotion).split(' ')[1]}`}>
                          {hasInternalContradiction(c.verbalEmotion) && (
                            <span className="mr-1 text-amber-500 font-bold" title="Internal Contradiction Detected">✦</span>
                          )}
                          {c.verbalEmotion}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <p className="text-[11px] text-gray-600 italic line-clamp-1 flex-1">"{c.text}"</p>
                      <span className="text-[9px] text-gray-400 ml-2">Speech: {c.speechTime}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timelines and Transcript */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Timeline Visualization */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Emotional Confidence</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Rate (0-1)</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Detected emotions based on facial gestures and how confident model is about them.
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 1]} hide={false} width={30} tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
                          <p className="text-xs font-semibold text-gray-500">{label}</p>
                          <p className={`text-sm font-bold mt-1 px-2 py-0.5 rounded w-fit ${getEmotionColorClass(payload[0].payload.visualLabel)}`}>
                            {payload[0].payload.visualLabel}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Confidence: {(Number(payload[0].value) * 100).toFixed(1)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line type="monotone" dataKey="confidence" stroke="#4F46E5" strokeWidth={2} dot={{ r: 4, strokeWidth: 2 }} name="Confidence" />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-center text-xs text-gray-400 mt-2">
              Detection confidence over video duration
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wider">Facial Analysis Logs</h4>
            <p className="text-xs text-gray-500">
              The ✦ icon shows internal contradiction in emotions based on facial gestures
            </p>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Emotion</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    {isEditMode && <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Edit</th>}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.facialEmotions.map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{row.startTime} - {row.endTime}</td>
                      <td className="px-3 py-2 text-sm text-gray-900">
                        {editingFacialIdx === i ? (
                          <EmotionSelector
                            selected={row.emotion}
                            onChange={(val) => {
                              const newEmotions = [...reportData.facialEmotions];
                              newEmotions[i] = { ...newEmotions[i], emotion: val };
                              setReportData({ ...reportData, facialEmotions: newEmotions });
                            }}
                          />
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center w-fit ${getEmotionColorClass(row.emotion)}`}>
                            {row.emotion}
                            {hasInternalContradiction(row.emotion) && (
                              <span className="ml-1 text-amber-500 font-bold" title="Internal Contradiction Detected">✦</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {editingFacialIdx === i ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={Math.round(row.confidence * 100)}
                            onChange={(e) => {
                              const newEmotions = [...reportData.facialEmotions];
                              newEmotions[i] = { ...newEmotions[i], confidence: Number(e.target.value) / 100 };
                              setReportData({ ...reportData, facialEmotions: newEmotions });
                            }}
                            className="w-16 px-1 border rounded text-xs"
                          />
                        ) : (
                          `${(row.confidence * 100).toFixed(0)}%`
                        )}
                      </td>
                      {isEditMode && (
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => setEditingFacialIdx(editingFacialIdx === i ? null : i)}
                            className="text-gray-400 hover:text-indigo-600"
                          >
                            {editingFacialIdx === i ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
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

        {/* Transcript */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100 flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Speech Emotion & Transcript</h3>
          <div className="flex-1 overflow-y-auto max-h-[500px] space-y-4 pr-2">
            {reportData.speechAnalysis.map((seg, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-lg relative group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-400">{seg.startTime}</span>
                  <div className="flex items-center space-x-2">
                    {editingSpeechIdx === idx ? (
                      <EmotionSelector
                        selected={seg.sentiment}
                        onChange={(val) => {
                          const newSpeech = [...reportData.speechAnalysis];
                          newSpeech[idx] = { ...newSpeech[idx], sentiment: val };
                          setReportData({ ...reportData, speechAnalysis: newSpeech });
                        }}
                      />
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center w-fit ${getEmotionColorClass(seg.sentiment)}`}>
                        {seg.sentiment}
                        {hasInternalContradiction(seg.sentiment) && (
                          <span className="ml-1 text-amber-500 font-bold" title="Internal Contradiction Detected">✦</span>
                        )}
                      </span>
                    )}
                    {isEditMode && (
                      <button
                        onClick={() => setEditingSpeechIdx(editingSpeechIdx === idx ? null : idx)}
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        {editingSpeechIdx === idx ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-gray-800 text-sm">"{seg.text}"</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Full Transcript</h4>
            <p className="text-xs text-gray-500 leading-relaxed max-h-32 overflow-y-auto">
              {reportData.transcript}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalysisReport;

interface EmotionSelectorProps {
  selected: string;
  onChange: (val: string) => void;
}

const EmotionSelector: React.FC<EmotionSelectorProps> = ({ selected, onChange }) => {
  const currentEmotions = selected.split(', ').filter(Boolean);

  const toggleEmotion = (emotion: string) => {
    let newEmotions;
    if (currentEmotions.includes(emotion)) {
      newEmotions = currentEmotions.filter(e => e !== emotion);
    } else {
      if (currentEmotions.length >= 2) {
        newEmotions = [currentEmotions[1], emotion];
      } else {
        newEmotions = [...currentEmotions, emotion];
      }
    }
    onChange(newEmotions.join(', '));
  };

  return (
    <div className="relative inline-block text-left">
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {AVAILABLE_EMOTIONS.map(e => (
          <button
            key={e}
            onClick={() => toggleEmotion(e)}
            className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${currentEmotions.includes(e)
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
};
