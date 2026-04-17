import os
import cv2
import json
import torch
# PyTorch 2.6+ changed torch.load default to weights_only=True.
# Pyannote's VAD model checkpoint contains omegaconf types, which must be
# explicitly allowlisted as safe globals before whisperx (and pyannote) load.
from omegaconf import DictConfig, ListConfig
from omegaconf.base import ContainerMetadata 
from omegaconf import DictConfig, ListConfig
from omegaconf.base import ContainerMetadata 
from omegaconf.nodes import AnyNode, BooleanNode, FloatNode, IntegerNode, StringNode

import typing
torch.serialization.add_safe_globals([
    DictConfig, ListConfig, ContainerMetadata, 
    AnyNode, BooleanNode, FloatNode, IntegerNode, StringNode,
    typing.Any
])

# If deeper types are still failing, we can bypass weights_only entirely for Pyannote:
_original_load = torch.load
def _unsafe_load(*args, **kwargs):
    kwargs['weights_only'] = False
    return _original_load(*args, **kwargs)
torch.load = _unsafe_load

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import whisperx
from deepface import DeepFace
import ollama

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# torch_device: used for torch-based models (DeepFace, etc.) — MPS is fine here.
# whisper_device: ctranslate2 (faster-whisper backend) does NOT support MPS;
#                 it only accepts 'cpu' or 'cuda', so we always use 'cpu' on Mac.
torch_device = "mps" if torch.backends.mps.is_available() else "cpu"
whisper_device = "cpu"
compute_type = "float32"  # int8/float16 can throw errors on Mac M-chips

print(f"Loading WhisperX model on {whisper_device} (torch device: {torch_device})...")
# Note: True diarization with WhisperX requires a HuggingFace token and the diarize model.
# We currently extract transcribed text segments with precise timestamps only.
whisper_model = whisperx.load_model("base", whisper_device, compute_type=compute_type)
print("Models ready.")

@app.post("/analyze")
async def analyze_video(video: UploadFile = File(...), granularity: str = Form("detailed")):
    temp_path = f"temp_{video.filename}"
    with open(temp_path, "wb") as buffer:
        buffer.write(await video.read())

    try:
        # 1. Transcribe & Diarize (WhisperX)
        print("Transcribing audio with WhisperX...")
        audio = whisperx.load_audio(temp_path)
        result = whisper_model.transcribe(audio)
        
        # 2. Facial Analysis (DeepFace)
        print("Analyzing facial expressions with DeepFace...")
        cap = cv2.VideoCapture(temp_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        face_logs = []
        # Sample 1 frame per second to keep local processing fast
        step = int(fps) if fps > 0 else 30
        
        for i in range(0, frame_count, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            if not ret: break
            
            try:
                # enforce_detection=False prevents crashes if a face isn't perfectly visible
                analysis = DeepFace.analyze(
                    img_path=frame, 
                    actions=['emotion'], 
                    enforce_detection=False
                )
                
                # Format timestamp
                seconds = int(i / fps)
                timestamp = f"{seconds//60:02d}:{seconds%60:02d}"
                
                face_logs.append({
                    "time": timestamp,
                    "emotion": analysis[0]['dominant_emotion'].capitalize()
                })
            except Exception as e:
                continue
                
        cap.release()

        # 3. Merging logic
        print("Merging text and visual data...")
        session_log_lines = []
        
        # Format speech segments
        for segment in result.get("segments", []):
            start_sec = int(segment["start"])
            ts = f"{start_sec//60:02d}:{start_sec%60:02d}"
            text = segment["text"].strip()
            session_log_lines.append(f"Time: {ts} | Speech: '{text}'")
            
        # Format face logs
        for log in face_logs:
            session_log_lines.append(f"Time: {log['time']} | Face: {log['emotion']}")
            
        # Sort log lines chronologically based on Time string
        session_log_lines.sort()
        session_log = "\n".join(session_log_lines)
        
        full_transcript = " ".join([seg["text"].strip() for seg in result.get("segments", [])])

        # 4. Call Local Gemma (via Ollama)
        print("Calling Local Gemma 4...")
        prompt = f"""
        Act as an ISTDP Psychologist analyzing a session video.
        Below is the merged timeline of Speech (what they said) and Face (their detected facial emotion).
        
        SESSION LOG:
        {session_log}
        
        Analyze this log for emotional contradictions.
        
        You MUST return your entire response as a single, valid JSON object matching this schema exactly:
        {{
          "transcript": "Put the full transcript here",
          "overallSummary": "Brief psychological summary of the session",
          "facialEmotions": [ {{"startTime": "00:00", "endTime": "00:05", "emotion": "Joy", "confidence": 0.9}} ],
          "speechAnalysis": [ {{"startTime": "00:00", "endTime": "00:05", "text": "said words", "sentiment": "Joy"}} ],
          "mismatches": [ {{"timestamp": "00:05", "visualEmotion": "Sadness", "verbalEmotion": "Joy", "severity": "HIGH"}} ]
        }}
        """

        response = ollama.chat(model='gemma4', messages=[
            {
                'role': 'user',
                'content': prompt
            }
        ], format='json') # Instructs Ollama to return JSON if supported
        
        result_text = response['message']['content']
        
        # Parse the JSON response
        final_report = json.loads(result_text)
        
        # Ensure the transcript is populated just in case Gemma strips it
        if not final_report.get("transcript"):
            final_report["transcript"] = full_transcript

        return final_report

    except Exception as e:
        print(f"Pipeline error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
