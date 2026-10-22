"""Free local claims-document parser for ROOF/OS.

Docling is MIT-licensed and runs locally. This service extracts document text and
layout only. It does not create ESX, price claims, coverage decisions, or approvals.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
from functools import lru_cache
from urllib.parse import urlparse

import httpx
from docling.document_converter import DocumentConverter
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl

MAX_SOURCE_BYTES = 25 * 1024 * 1024
MAX_OUTPUT_CHARS = 180_000
ALLOWED_SOURCE_ORIGIN = os.environ.get("ALLOWED_SOURCE_ORIGIN", "").rstrip("/")

app = FastAPI(title="ROOF/OS local claims parser", version="0.1.0")


class ParseRequest(BaseModel):
    sourceUrl: HttpUrl
    market: str | None = None


@lru_cache(maxsize=1)
def converter() -> DocumentConverter:
    return DocumentConverter()


def validate_source(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Only HTTPS source URLs are allowed.")
    if not ALLOWED_SOURCE_ORIGIN or f"{parsed.scheme}://{parsed.netloc}" != ALLOWED_SOURCE_ORIGIN:
        raise HTTPException(status_code=403, detail="Source origin is not allowlisted.")


@app.get("/health")
def health() -> dict:
    return {"ok": True, "engine": "docling", "license": "MIT", "maxSourceBytes": MAX_SOURCE_BYTES}


@app.post("/parse")
async def parse_document(payload: ParseRequest) -> dict:
    source_url = str(payload.sourceUrl)
    validate_source(source_url)
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=20.0) as client:
            async with client.stream("GET", source_url) as response:
                if response.status_code != 200:
                    raise HTTPException(status_code=502, detail="Signed source document could not be downloaded.")
                content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    data.extend(chunk)
                    if len(data) > MAX_SOURCE_BYTES:
                        raise HTTPException(status_code=413, detail="Source document exceeds 25 MB.")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Signed source document could not be downloaded.") from exc

    if not data or not data.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="Source document is not a PDF.")

    source_sha256 = hashlib.sha256(data).hexdigest()
    path = ""
    try:
        with tempfile.NamedTemporaryFile(prefix="roofos-claims-", suffix=".pdf", delete=False) as handle:
            handle.write(data)
            path = handle.name
        result = converter().convert(path)
        markdown = result.document.export_to_markdown()
        return {
            "parser": "docling",
            "license": "MIT",
            "sourceSha256": source_sha256,
            "sourceBytes": len(data),
            "contentType": content_type or "application/pdf",
            "market": payload.market,
            "markdown": markdown[:MAX_OUTPUT_CHARS],
            "truncated": len(markdown) > MAX_OUTPUT_CHARS,
            "reviewRequired": True,
            "authority": "document extraction only; human review required",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Docling could not parse the source document.") from exc
    finally:
        if path:
            try:
                os.remove(path)
            except FileNotFoundError:
                pass
