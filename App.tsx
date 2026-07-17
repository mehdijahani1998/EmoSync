import React, { useState, useRef } from 'react';
import { User, AnalysisResult, AnalysisStatus, AnalysisGranularity } from './types';
import Auth from './components/Auth';
import AnalysisReport from './components/AnalysisReport';
import { analyzeVideo } from './services/geminiService';
// DEV-ONLY ▼ remove this import before shipping to production
import { DUMMY_RESULT } from './dummyResult';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<AnalysisGranularity>(AnalysisGranularity.DETAILED);


  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    setUser(null);
    handleReset();
  };

  const handleReset = () => {
    setStatus(AnalysisStatus.IDLE);
    setResult(null);
    setVideoUrl(null);
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // DEV-ONLY ▼ remove this handler before shipping to production
  const handleUseDummyResult = () => {
    setErrorMsg(null);
    setVideoUrl(null);
    setResult(DUMMY_RESULT);
    setStatus(AnalysisStatus.COMPLETE);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      setErrorMsg("File too large. Please upload a video smaller than 200MB for this demo.");
      return;
    }

    try {
      setErrorMsg(null);
      setStatus(AnalysisStatus.UPLOADING);

      // Create local URL for preview
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      setStatus(AnalysisStatus.PROCESSING);

      // Call Service
      const analysisData = await analyzeVideo(file, granularity);

      setResult(analysisData);
      setStatus(AnalysisStatus.COMPLETE);

    } catch (err: any) {
      console.error(err);
      setStatus(AnalysisStatus.ERROR);
      setErrorMsg(err.message || "Failed to analyze video. Please try a shorter clip.");
    }
  };

  const handleSelectSampleVideo = async (filename: string) => {
    try {
      setErrorMsg(null);
      setStatus(AnalysisStatus.UPLOADING);

      const sampleUrl = `/videos/${filename}`;
      setVideoUrl(sampleUrl);

      setStatus(AnalysisStatus.PROCESSING);

      // Fetch the video file to get a File/Blob object
      const response = await fetch(sampleUrl);
      if (!response.ok) {
        throw new Error(`Failed to load sample video: ${response.statusText}`);
      }
      const blob = await response.blob();

      // Determine file type
      const mimeType = filename.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
      const file = new File([blob], filename, { type: mimeType });

      // Call Service
      const analysisData = await analyzeVideo(file, granularity);

      setResult(analysisData);
      setStatus(AnalysisStatus.COMPLETE);

    } catch (err: any) {
      console.error(err);
      setStatus(AnalysisStatus.ERROR);
      setErrorMsg(err.message || "Failed to analyze sample video.");
    }
  };

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      {status !== AnalysisStatus.COMPLETE && (
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <span className="text-indigo-600 text-2xl mr-2">◉</span>
                <h1 className="text-xl font-bold tracking-tight text-gray-900">EmoSync</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500 hidden sm:block">Welcome, {user.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-sm font-medium text-gray-600 hover:text-red-600 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={status === AnalysisStatus.COMPLETE ? 'h-screen overflow-hidden' : 'py-10'}>
        {status === AnalysisStatus.IDLE || status === AnalysisStatus.ERROR ? (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="px-6 py-8 sm:p-10 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-100 mb-6">
                  <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Upload Video for Analysis</h3>
                <p className="mt-2 text-gray-500 max-w-xl mx-auto">
                  Our advanced AI will detect frame-by-frame facial emotions, transcribe speech, and identify contradictions between what is shown and what is said.
                </p>

                <div className="mt-8 flex flex-col items-center space-y-6">

                  <div className="flex flex-col space-y-2 items-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Analysis Depth</span>
                    <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
                      <button
                        onClick={() => setGranularity(AnalysisGranularity.GENERAL)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${granularity === AnalysisGranularity.GENERAL
                          ? 'bg-white shadow-sm text-indigo-600 border border-gray-200'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        General
                      </button>
                      <button
                        onClick={() => setGranularity(AnalysisGranularity.DETAILED)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${granularity === AnalysisGranularity.DETAILED
                          ? 'bg-white shadow-sm text-indigo-600 border border-gray-200'
                          : 'text-gray-500 hover:text-gray-700'
                          }`}
                      >
                        Detailed
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 max-w-md mt-1.5 leading-relaxed text-center">
                      The difference between General and Detailed analysis is in the granularity of the result. If you choose "Detailed", the webapp pays more attention to each second of the video. It also takes longer to process and for you to see the result.
                    </p>
                  </div>

                  <div className="pt-2">
                    <label htmlFor="video-upload" className="relative cursor-pointer bg-indigo-600 rounded-md font-medium text-white hover:bg-indigo-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-12 py-4 shadow-lg transition-all transform hover:scale-105 inline-block text-lg">
                      <span>Select Video File</span>
                      <input
                        id="video-upload"
                        name="video-upload"
                        type="file"
                        accept="video/*"
                        className="sr-only"
                        onChange={handleFileUpload}
                        ref={fileInputRef}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-400">MP4, WEBM, MOV supported. Max 200MB.</p>

                  {(import.meta as any).env?.DEV && (
                    <>
                      <div className="relative w-full flex items-center justify-center py-2">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                          <div className="w-full border-t border-amber-300"></div>
                        </div>
                        <div className="relative bg-white px-4 text-xs font-semibold text-amber-500 uppercase tracking-wider">
                          Dev tools
                        </div>
                      </div>
                      <button
                        id="use-dummy-result-btn"
                        onClick={handleUseDummyResult}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-dashed border-amber-400 text-amber-600 bg-amber-50 hover:bg-amber-100 hover:border-amber-500 transition-all text-sm font-semibold shadow-sm"
                        title="DEV-ONLY: skip video upload and load a pre-built dummy result"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Use Dummy Result
                        <span className="ml-1 text-xs font-normal opacity-70">(dev only)</span>
                      </button>
                    </>
                  )}

                  {/* OR Divider */}
                  <div className="relative w-full flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative bg-white px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Or try with a demo video
                    </div>
                  </div>

                  {/* Demo Videos Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
                    <button
                      onClick={() => handleSelectSampleVideo('dummy-test.mov')}
                      className="group flex flex-col items-start p-3 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left overflow-hidden bg-white"
                    >
                      <img
                        src="/images/dummy-thumbnail.png"
                        alt="Psychology Intake Test"
                        className="w-full h-32 object-cover rounded-lg mb-3 border border-gray-100 group-hover:scale-[1.02] transition-transform duration-300"
                      />
                      <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span>Demo Video 1</span>
                      </div>
                      <span className="text-xs text-gray-400 mt-1">This is a very simple recording to just show how the webapp works. It's a short clip so it quickly gives you a showcase. But don't expect much.</span>
                    </button>

                    <button
                      onClick={() => handleSelectSampleVideo('serious-test.mp4')}
                      className="group flex flex-col items-start p-3 rounded-xl border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left overflow-hidden bg-white"
                    >
                      <img
                        src="/images/serious-thumbnail.png"
                        alt="In-Depth Emotion Tracking"
                        className="w-full h-32 object-cover rounded-lg mb-3 border border-gray-100 group-hover:scale-[1.02] transition-transform duration-300"
                      />
                      <div className="flex items-center space-x-2 text-indigo-600 font-semibold text-sm">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                        <span>Demo Video 2</span>
                      </div>
                      <span className="text-xs text-gray-400 mt-1">This is a recoding of an actual therapy session. It takes longer to see the results. Try it if you want to see a serious result.</span>
                    </button>
                  </div>
                </div>

                {status === AnalysisStatus.ERROR && errorMsg && (
                  <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
                    <strong className="font-bold">Error: </strong>
                    <span className="block sm:inline">{errorMsg}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : status === AnalysisStatus.PROCESSING || status === AnalysisStatus.UPLOADING ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh]">
            <div className="relative">
              <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-indigo-600"></div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600 font-bold text-xs">AI</div>
            </div>
            <h2 className="mt-6 text-xl font-semibold text-gray-900">
              {status === AnalysisStatus.UPLOADING ? 'Preparing Video...' : 'Analyzing Emotions...'}
            </h2>
            <p className="mt-2 text-gray-500 text-sm max-w-md text-center">
              Processing facial expressions and speech sentiment. This may take a moment depending on video length.
            </p>
          </div>
        ) : (
          result && <AnalysisReport data={result} videoUrl={videoUrl} onReset={handleReset} user={user} onLogout={handleLogout} />
        )}
      </main>
    </div>
  );
};

export default App;
