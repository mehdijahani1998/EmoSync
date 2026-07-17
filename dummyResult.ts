// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY: Dummy result for testing the Analysis page without uploading a video.
// Remove this file (and its import in App.tsx) before shipping to production.
// ─────────────────────────────────────────────────────────────────────────────

import { AnalysisResult } from './types';

export const DUMMY_RESULT: AnalysisResult = {
  transcript:
    "I'm doing really well, everything is fine. There's nothing to worry about at all. " +
    'Work has been going great and I feel completely in control. My relationship is strong. ' +
    'I just feel so happy, honestly. I\'ve never felt better in my life. There are a few small ' +
    'stressors but nothing significant, I handle it easily. I\'m sleeping fine. Yeah, everything ' +
    'is good. No issues at all.',

  facialEmotions: [
    { startTime: '0:00', endTime: '0:05', emotion: 'Neutral',     confidence: 0.82 },
    { startTime: '0:05', endTime: '0:12', emotion: 'Anxiety',     confidence: 0.71 },
    { startTime: '0:12', endTime: '0:20', emotion: 'Sadness',     confidence: 0.65 },
    { startTime: '0:20', endTime: '0:28', emotion: 'Fear',        confidence: 0.58 },
    { startTime: '0:28', endTime: '0:35', emotion: 'Neutral',     confidence: 0.77 },
    { startTime: '0:35', endTime: '0:44', emotion: 'Frustration', confidence: 0.69 },
    { startTime: '0:44', endTime: '0:52', emotion: 'Sadness',     confidence: 0.74 },
    { startTime: '0:52', endTime: '1:00', emotion: 'Grief',       confidence: 0.61 },
    { startTime: '1:00', endTime: '1:08', emotion: 'Anxiety',     confidence: 0.80 },
    { startTime: '1:08', endTime: '1:15', emotion: 'Neutral',     confidence: 0.73 },
    { startTime: '1:15', endTime: '1:22', emotion: 'Shame',       confidence: 0.55 },
    { startTime: '1:22', endTime: '1:30', emotion: 'Neutral',     confidence: 0.88 },
  ],

  speechAnalysis: [
    {
      text: "I'm doing really well, everything is fine.",
      sentiment: 'Joy',
      startTime: '0:00',
      endTime: '0:08',
    },
    {
      text: "There's nothing to worry about at all.",
      sentiment: 'Relief',
      startTime: '0:08',
      endTime: '0:16',
    },
    {
      text: 'Work has been going great and I feel completely in control.',
      sentiment: 'Hope',
      startTime: '0:16',
      endTime: '0:28',
    },
    {
      text: 'My relationship is strong.',
      sentiment: 'Joy',
      startTime: '0:28',
      endTime: '0:35',
    },
    {
      text: 'I just feel so happy, honestly.',
      sentiment: 'Joy',
      startTime: '0:35',
      endTime: '0:44',
    },
    {
      text: "I've never felt better in my life.",
      sentiment: 'Excited',
      startTime: '0:44',
      endTime: '0:52',
    },
    {
      text: "There are a few small stressors but nothing significant, I handle it easily.",
      sentiment: 'Relief',
      startTime: '0:52',
      endTime: '1:05',
    },
    {
      text: "I'm sleeping fine. Yeah, everything is good. No issues at all.",
      sentiment: 'Neutral',
      startTime: '1:05',
      endTime: '1:30',
    },
  ],

  mismatches: [
    {
      timestamp: '0:07',
      visualEmotion: 'Anxiety',
      verbalEmotion: 'Joy',
      severity: 'HIGH',
    },
    {
      timestamp: '0:15',
      visualEmotion: 'Sadness',
      verbalEmotion: 'Relief',
      severity: 'HIGH',
    },
    {
      timestamp: '0:40',
      visualEmotion: 'Frustration',
      verbalEmotion: 'Joy',
      severity: 'MEDIUM',
    },
    {
      timestamp: '0:48',
      visualEmotion: 'Sadness',
      verbalEmotion: 'Excited',
      severity: 'HIGH',
    },
    {
      timestamp: '0:56',
      visualEmotion: 'Grief',
      verbalEmotion: 'Relief',
      severity: 'MEDIUM',
    },
    {
      timestamp: '1:03',
      visualEmotion: 'Anxiety',
      verbalEmotion: 'Relief',
      severity: 'MEDIUM',
    },
    {
      timestamp: '1:17',
      visualEmotion: 'Shame',
      verbalEmotion: 'Neutral',
      severity: 'LOW',
    },
  ],

  overallSummary:
    'The subject consistently presents a positive verbal narrative — asserting happiness, control, and wellness — ' +
    'while their facial expressions reveal significant underlying distress. Multiple HIGH-severity mismatches ' +
    'were detected between 0:05 and 0:52 where visible anxiety, sadness, and grief directly contradict verbal ' +
    'claims of joy and relief. The pattern suggests suppression of negative affect and possible emotional masking. ' +
    'The subject may benefit from further clinical evaluation to explore discrepancies between self-reported ' +
    'wellbeing and observed emotional state.',
};
