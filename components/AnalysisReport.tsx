import React from 'react';
import { AnalysisResult, Mismatch } from '../types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface AnalysisReportProps {
  data: AnalysisResult;
  videoUrl: string | null;
  onReset: () => void;
}

const AnalysisReport: React.FC<AnalysisReportProps> = ({ data, videoUrl, onReset }) => {
  
  // Transform data to map facial emotion confidence over time
  const chartData = data.facialEmotions.map((f, i) => ({
    time: f.startTime,
    confidence: f.confidence,
    visualLabel: f.emotion,
  }));

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
        <button 
          onClick={onReset}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 shadow-sm"
        >
          Analyze Another Video
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Video Player & Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black rounded-xl overflow-hidden shadow-lg aspect-video relative">
            {videoUrl ? (
              <video src={videoUrl} controls className="w-full h-full object-contain" />
            ) : (
              <div className="flex items-center justify-center h-full text-white">Video Source Unavailable</div>
            )}
          </div>
          
          <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
             <h3 className="text-lg font-semibold text-gray-900 mb-2">Executive Summary</h3>
             <p className="text-gray-700 leading-relaxed">{data.overallSummary}</p>
          </div>
        </div>

        {/* Mismatches Panel */}
        <div className="bg-white rounded-xl shadow border border-gray-100 flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-100 bg-red-50 rounded-t-xl">
            <h3 className="text-lg font-semibold text-red-800 flex items-center">
              <span className="mr-2">⚠️</span> Detected Mismatches
            </h3>
            <p className="text-xs text-red-600 mt-1">
              Moments where facial expression contradicts speech sentiment.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {data.mismatches.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                <p>No significant behavioral mismatches detected.</p>
              </div>
            ) : (
              data.mismatches.map((m, idx) => (
                <div key={idx} className={`p-4 rounded-lg border-l-4 ${m.severity === 'HIGH' ? 'border-red-500 bg-red-50' : 'border-yellow-400 bg-yellow-50'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono font-bold text-gray-600 bg-white px-2 py-1 rounded border">{m.timestamp}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.severity === 'HIGH' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'}`}>
                      {m.severity}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <span className="block text-xs text-gray-500 uppercase">Face</span>
                      <span className={`font-medium ${getEmotionColorClass(m.visualEmotion).split(' ')[1]}`}>{m.visualEmotion}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-gray-500 uppercase">Speech</span>
                      <span className={`font-medium ${getEmotionColorClass(m.verbalEmotion).split(' ')[1]}`}>{m.verbalEmotion}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 italic border-t border-gray-200 pt-2 mt-2">"{m.description}"</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Timelines and Transcript */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Timeline Visualization */}
        <div className="bg-white rounded-xl shadow p-6 border border-gray-100">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-semibold text-gray-900">Emotional Confidence</h3>
             <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">Rate (0-1)</span>
           </div>
           <div className="h-64 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <LineChart data={chartData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="time" />
                 <YAxis domain={[0, 1]} hide={false} width={30} tick={{fontSize: 12}} />
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
             <div className="max-h-60 overflow-y-auto border rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Emotion</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.facialEmotions.map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">{row.startTime} - {row.endTime}</td>
                        <td className="px-3 py-2 text-sm text-gray-900">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getEmotionColorClass(row.emotion)}`}>
                            {row.emotion}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-500">{(row.confidence * 100).toFixed(0)}%</td>
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
             {data.speechAnalysis.map((seg, idx) => (
               <div key={idx} className="bg-gray-50 p-3 rounded-lg">
                 <div className="flex items-center justify-between mb-1">
                   <span className="text-xs font-mono text-gray-400">{seg.startTime}</span>
                   <span className={`text-xs px-2 py-0.5 rounded-full border ${getEmotionColorClass(seg.sentiment)}`}>
                     {seg.sentiment}
                   </span>
                 </div>
                 <p className="text-gray-800 text-sm">"{seg.text}"</p>
               </div>
             ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Full Transcript</h4>
            <p className="text-xs text-gray-500 leading-relaxed max-h-32 overflow-y-auto">
              {data.transcript}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AnalysisReport;