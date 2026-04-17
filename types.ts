export interface User {
  email: string;
  name?: string;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export enum AnalysisGranularity {
  GENERAL = 'general',
  DETAILED = 'detailed'
}

export enum ModelProvider {
  GEMINI = 'gemini',
  LOCAL_GEMMA = 'local_gemma'
}

export interface EmotionSegment {
  startTime: string;
  endTime: string;
  emotion: string;
  confidence: number;
}

export interface SpeechSegment {
  text: string;
  sentiment: string;
  startTime: string;
  endTime: string;
}

export interface Mismatch {
  timestamp: string;
  visualEmotion: string;
  verbalEmotion: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AnalysisResult {
  transcript: string;
  facialEmotions: EmotionSegment[];
  speechAnalysis: SpeechSegment[];
  mismatches: Mismatch[];
  overallSummary: string;
}
