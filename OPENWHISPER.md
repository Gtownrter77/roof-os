# Local open-source Whisper

Speech-to-text no longer calls OpenAI whisper-1.

The worker in workers/whisper runs faster-whisper (MIT), the CTranslate2 build of openai/whisper (MIT). No API key. Audio stays on the machine that runs the worker.

## Run

```bash
docker build -t roofos-whisper workers/whisper
docker run --rm -p 8088:8088 roofos-whisper
```

Set WHISPER_URL=http://127.0.0.1:8088 on the app. processAudioTranscription posts audio there. If the worker is down, the call fails. It does not invent a transcript.

## Languages

Baked in: English, Spanish, Chinese, French.

Korean is optional. It loads only after the operator places a pack at /models/packs/ko/model.bin with a matching SHA256SUMS. The worker checks the checksum before use and never downloads a pack by itself.
