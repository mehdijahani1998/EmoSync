import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, AnalysisGranularity } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define the schema for the structured output
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    transcript: {
      type: Type.STRING,
      description: "Full text transcription of the speech in the video.",
    },
    overallSummary: {
      type: Type.STRING,
      description: "A brief summary of the video content and emotional tone.",
    },
    facialEmotions: {
      type: Type.ARRAY,
      description: "Timeline of facial emotions detected!",
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: { type: Type.STRING, description: "Start time (MM:SS)" },
          endTime: { type: Type.STRING, description: "End time (MM:SS)" },
          emotion: { type: Type.STRING, description: "Detected facial emotion. Assign up to two most matching emotions from: Love, Sexual Arousal, Affection, Romance, Joy, Excited, Hope, Relief, Anger, Rage, Furious, Fear, Terror, Pain, Anxiety, Sadness, Grief, Guilt, Shame, Frustration, Surprise, Shock, Amazement, Neutral." },
          confidence: { type: Type.NUMBER, description: "Confidence score 0-1" },
        },
        required: ["startTime", "endTime", "emotion", "confidence"],
      },
    },
    speechAnalysis: {
      type: Type.ARRAY,
      description: "Sentiment analysis of spoken phrases.",
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: { type: Type.STRING, description: "Start time (MM:SS)" },
          endTime: { type: Type.STRING, description: "End time (MM:SS)" },
          text: { type: Type.STRING, description: "The specific phrase spoken" },
          sentiment: { type: Type.STRING, description: "The specific emotion expressed in the text. Assign up to two most matching emotions from: Love, Sexual Arousal, Affection, Romance, Joy, Excited, Hope, Relief, Anger, Rage, Furious, Fear, Terror, Pain, Anxiety, Sadness, Grief, Guilt, Shame, Frustration, Surprise, Shock, Amazement, Neutral." },
        },
        required: ["startTime", "endTime", "text", "sentiment"],
      },
    },
    mismatches: {
      type: Type.ARRAY,
      description: "Instances where facial emotion does not match speech sentiment.",
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: { type: Type.STRING, description: "Time of occurrence (MM:SS)" },
          visualEmotion: { type: Type.STRING, description: "The emotion shown on face" },
          verbalEmotion: { type: Type.STRING, description: "The emotion expressed in words" },
          severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"], description: "Severity of the mismatch" },
        },
        required: ["timestamp", "visualEmotion", "verbalEmotion", "severity"],
      },
    },
  },
  required: ["transcript", "facialEmotions", "speechAnalysis", "mismatches", "overallSummary"],
};

export const analyzeVideo = async (file: File, granularity: AnalysisGranularity = AnalysisGranularity.DETAILED): Promise<AnalysisResult> => {

  try {
    // Convert file to Base64
    const base64Data = await fileToGenerativePart(file);

    // Using gemini-3-flash-preview as it has more generous free-tier limits
    const modelId = "gemini-2.5-flash";

    const facialGranularity = granularity === AnalysisGranularity.DETAILED
      ? "Use very short segments for facial analysis (ideally 2-5 seconds each) to capture micro-expressions and rapid shifts in affect."
      : "Use standard segments for facial analysis (roughly 20-30 seconds each) for a high-level overview.";

    const semanticGranularity = granularity === AnalysisGranularity.DETAILED
      ? "Analyze the semantic meaning of the spoken sentences to determine the specific emotion of the *text itself*."
      : "Analyze the semantic meaning of the spoken sentences in roughly 30-second blocks to determine the specific emotion of the *text itself*.";

    // Construct the prompt
    const prompt = `
      You are an expert Clinical Psychologist specializing in Intensive Short-Term Dynamic Psychotherapy (ISTDP) and Emotionally Focused Therapy (EFT). 
      Your task is to analyze this session video to detect emotional inconsistencies.

      Follow this Chain of Thought for your analysis:
      A. First, identify the raw visual cues (facial muscles, micro-expressions).
      B. Second, transcribe the speech and identify its semantic emotional intent.
      C. Third, look for "Incongruence": Does the somatic expression (Face) match the metabolic intent (Speech)?
      D. Fourth, look for "Internal Conflicts": Are two opposing affects present simultaneously?

      1. Perform high-granularity frame-by-frame analysis to detect facial emotions. 
         CRITICAL: ${facialGranularity}
         Specifically monitor for the following psychological states:
         - Love, Sexual Arousal, Affection, Romance
         - Joy, Excited, Hope, Relief
         - Anger, Rage, Furious, Fear, Terror, Pain, Anxiety
         - Sadness, Grief, Guilt, Shame, Frustration
         - Surprise, Shock, Amazement
         - Neutral
         
         Assign up to two most matching emotions for each segment. Group continuous segments.
         
      2. Transcribe the audio to text.
      
      3. ${semanticGranularity} Use the same specific labels as above where applicable. Apply up to two most matching emotions.
      
      4. CRITICAL: Compare the facial emotion with the spoken emotion at the same timestamps. 
         Identify specific moments where these two emotions mismatch (e.g., smiling while saying something sad, or looking angry while saying something polite).
      
      5. INTERNAL CONTRADICTION: If a single segment contains two emotions that are psychologically contradictory (e.g., Joy and Guilt), ensure both are labeled.
      
      Return the result in strictly structured JSON format.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.2, // Low temperature for more analytical precision
      },
    });

    const textResponse = response.text;
    if (!textResponse) {
      throw new Error("No response from AI model");
    }

    return JSON.parse(textResponse) as AnalysisResult;

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};


// Helper to convert File to Base64 string (stripping the data URL prefix)
const fileToGenerativePart = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:video/mp4;base64, part
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};