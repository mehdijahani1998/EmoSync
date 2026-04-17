<div align="center">

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Local Gemma Pipeline (optional)

The "Local Gemma 4" provider requires a running Python backend. Ollama must also be installed and have the `gemma3` model pulled (`ollama pull gemma3`).

1. Create and activate a virtual environment:
   ```bash
   python3 -m venv penv && source penv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   python local_pipeline.py
   ```
   The API will be available at `http://localhost:8000`.
