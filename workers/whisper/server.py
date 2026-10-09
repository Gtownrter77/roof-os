"""Local open-source speech-to-text for ROOF/OS.

Engine: SYSTRAN/faster-whisper (MIT), a CTranslate2 build of OpenAI Whisper
(openai/whisper, MIT). No OpenAI API key. Audio stays on this machine.

Baked-in languages: English, Spanish, Chinese, French.
Korean is optional and loads only after a checksum-verified pack is present.
This process never downloads a pack on its own.
"""

from __future__ import annotations

import hashlib
import os
from functools import lru_cache
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel

BAKED_IN = {"en", "es", "zh", "fr"}
OPTIONAL = {"ko"}
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
PACK_DIR = os.environ.get("WHISPER_PACK_DIR", "/models/packs")

app = FastAPI(title="ROOF/OS local Whisper", version="0.1.0")


@lru_cache(maxsize=1)
def model() -> WhisperModel:
    return WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE)


def pack_ready(language: str) -> bool:
    marker = os.path.join(PACK_DIR, language, "SHA256SUMS")
    weight = os.path.join(PACK_DIR, language, "model.bin")
    if not (os.path.isfile(marker) and os.path.isfile(weight)):
        return False
    expected = ""
    with open(marker, "r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip().endswith("model.bin"):
                expected = line.split()[0]
                break
    if not expected:
        return False
    digest = hashlib.sha256()
    with open(weight, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest() == expected


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "engine": "faster-whisper",
        "upstream": "openai/whisper",
        "license": "MIT",
        "model": MODEL_SIZE,
        "bakedIn": sorted(BAKED_IN),
        "optionalReady": sorted(lang for lang in OPTIONAL if pack_ready(lang)),
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
) -> dict:
    code = (language or "en").split("-")[0].lower()
    if code not in BAKED_IN and code not in OPTIONAL:
        raise HTTPException(status_code=400, detail=f"Language {code} is not enabled.")
    if code in OPTIONAL and not pack_ready(code):
        raise HTTPException(
            status_code=409,
            detail=f"Optional pack {code} is not downloaded or failed checksum.",
        )
    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Empty audio.")
    if len(audio) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio exceeds 25 MB.")
    path = "/tmp/roofos-whisper-input"
    with open(path, "wb") as handle:
        handle.write(audio)
    segments, info = model().transcribe(path, language=code, vad_filter=True)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    return {
        "text": text,
        "language": info.language,
        "engine": "faster-whisper",
        "sourced": bool(text),
    }
