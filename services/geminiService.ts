import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      description: "Timeline of facial emotions detected.",
      items: {
        type: Type.OBJECT,
        properties: {
          startTime: { type: Type.STRING, description: "Start time (MM:SS)" },
          endTime: { type: Type.STRING, description: "End time (MM:SS)" },
          emotion: { type: Type.STRING, description: "Detected facial emotion. Specific target labels: Joy, Anxiety, Rage, Anger, Guilt, Grief, Sadness, Love, Fear, Sexual Excitement, Neutral." },
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
          sentiment: { type: Type.STRING, description: "The specific emotion expressed in the text. Specific target labels: Joy, Anxiety, Rage, Anger, Guilt, Grief, Sadness, Love, Fear, Sexual Excitement, Neutral." },
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
          description: { type: Type.STRING, description: "Explanation of the mismatch" },
          severity: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH"], description: "Severity of the mismatch" },
        },
        required: ["timestamp", "visualEmotion", "verbalEmotion", "description", "severity"],
      },
    },
  },
  required: ["transcript", "facialEmotions", "speechAnalysis", "mismatches", "overallSummary"],
};

export const analyzeVideo = async (file: File): Promise<AnalysisResult> => {
  try {
    // Convert file to Base64
    const base64Data = await fileToGenerativePart(file);

    // Using gemini-3-flash-preview as it is the current valid model for multimodal tasks
    const modelId = "gemini-3-flash-preview"; 
    
    // Construct the prompt
    const prompt = `
      Analyze this video for a behavioral psychology report. 
      
      1. Perform frame-by-frame analysis to detect facial emotions. Specifically monitor for the following psychological states:
         - Joy
         - Anxiety
         - Rage / Anger
         - Guilt
         - Grief / Sadness
         - Love
         - Fear
         - Sexual Excitement
         - Neutral
         Group continuous segments.
         
      2. Transcribe the audio to text.
      
      3. Analyze the semantic meaning of the spoken sentences to determine the specific emotion of the *text itself*. Use the same specific labels as above (Joy, Anxiety, Rage, Guilt, Grief, Love, Fear, Sexual Excitement) where applicable, or standard sentiments.
      
      4. CRITICAL: Compare the facial emotion with the spoken emotion at the same timestamps. Identify specific moments where they mismatch (e.g., smiling while saying something sad, or looking angry while saying something polite).
      
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