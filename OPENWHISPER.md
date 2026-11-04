# Local open-source Whisper

Speech-to-text no longer calls OpenAI whisper-1.

The worker in workers/whisper runs faster-whisper (MIT), the CTranslate2 build of openai/whisper (MIT). No API key. Audio stays on the machine that runs the worker.

## Run

```bash
docker build -t roofos-whisper workers/whisper
docker run --rm -p 8088:8088 roofos-whisper
```

Set `WHISPER_WORKER_URL=http://127.0.0.1:8088/transcribe` on the app. The client also accepts a worker base URL (for example, the legacy `WHISPER_URL=http://127.0.0.1:8088`) and appends `/transcribe`; an existing `/transcribe` path is not duplicated. The request is multipart form data with `file` and `language` fields, matching `workers/whisper/server.py`. If the worker is down or returns no transcript, the API reports an explicit unavailable/error response; it does not invent a transcript. The worker URL must be reachable from the server runtime, not just from a user's browser.

## Languages

Baked in: English, Spanish, Chinese, French.

Korean is optional. It loads only after the operator places a pack at /models/packs/ko/model.bin with a matching SHA256SUMS. The worker checks the checksum before use and never downloads a pack by itself.
