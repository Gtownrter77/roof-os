#!/usr/bin/env bash
set -euo pipefail
# Only GitHub Actions runners should run heavyweight Docling.
test "$GITHUB_ACTIONS" = true || { echo 'Refusing heavyweight local Docling test' >&2; exit 1; }
command -v docker >/dev/null
docker build -t roofos-docling-ci -f workers/claims/Dockerfile workers/claims

name=roofos-docling-ci
cleanup() {
  docker logs "$name" --tail 40 2>/dev/null || true
  docker rm -f "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker run -d --name "$name" --publish 127.0.0.1:8092:8092 \
  --env ALLOWED_SOURCE_ORIGIN=https://synthetic.invalid roofos-docling-ci

for attempt in $(seq 1 60); do
  if curl --silent --show-error --fail http://127.0.0.1:8092/health >/tmp/roofos-health.json 2>/dev/null; then
    break
  fi
  sleep 2
done
grep -q '"engine":"docling"' /tmp/roofos-health.json || {
  echo 'Docling server did not become healthy' >&2
  exit 1
}
status=$(curl --silent --output /tmp/roofos-forbidden.json --write-out '%{http_code}' \
  --header 'content-type: application/json' \
  --data '{"sourceUrl":"https://forbidden.invalid/claim.pdf"}' \
  http://127.0.0.1:8092/parse)
test "$status" = 403 || { echo "Origin isolation failed: HTTP $status" >&2; exit 1; }

python3 - <<'PY'
from pathlib import Path
path = Path('/tmp/roofos-synthetic-claim.pdf')
line = b'BT /F1 14 Tf 72 720 Td (Roof OS Synthetic Claim Scope) Tj ET'
objects = [
 b'<< /Type /Catalog /Pages 2 0 R >>',
 b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
 b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
 b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 b'<< /Length %d >>\nstream\n' % len(line) + line + b'\nendstream'
]
pdf = bytearray(b'%PDF-1.4\n')
offsets = [0]
for number, obj in enumerate(objects, 1):
 offsets.append(len(pdf))
 pdf.extend(('%d 0 obj\n' % number).encode() + obj + b'\nendobj\n')
xref = len(pdf)
pdf.extend(('xref\n0 %d\n' % len(offsets)).encode())
pdf.extend(b'0000000000 65535 f \n')
for offset in offsets[1:]:
 pdf.extend(('%010d 00000 n \n' % offset).encode())
pdf.extend(('trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(offsets), xref)).encode())
path.write_bytes(pdf)
print('Generated synthetic PDF:', len(pdf), 'bytes')
PY

docker cp /tmp/roofos-synthetic-claim.pdf "$name":/tmp/roofos-synthetic-claim.pdf
docker exec "$name" python -c '
from server import converter
result = converter().convert("/tmp/roofos-synthetic-claim.pdf")
markdown = result.document.export_to_markdown()
assert "synthetic claim scope" in markdown.lower(), f"Unexpected Docling text: {markdown[:400]!r}"
print("DOCLING RUNTIME PASS: real synthetic PDF extraction")
'
echo '**Docling runtime PASS:** container built, real synthetic PDF extracted, forbidden origin rejected.' >> "$GITHUB_STEP_SUMMARY"
