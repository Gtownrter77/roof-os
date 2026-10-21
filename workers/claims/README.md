# ROOF/OS local claims parser

Free local PDF extraction worker. Uses [Docling](https://github.com/docling-project/docling) under MIT. It returns bounded Markdown and provenance metadata for human review. It does not generate Verisk/Xactimate ESX, licensed prices, coverage decisions, or approvals.

Run it on a persistent private host:

```bash
docker build -t roof-os-claims ./workers/claims
docker run --rm -p 8092:8092 \
  -e ALLOWED_SOURCE_ORIGIN=https://<supabase-project>.supabase.co \
  roof-os-claims
```

Set `CLAIMS_DOCUMENT_WORKER_URL` in the web runtime to the private worker URL. The worker must be reachable from the web runtime, must not be publicly open, and must allow only the Supabase Storage origin used by ROOF/OS.

The parser deletes its temporary PDF after conversion. Keep the returned import in `claims_imports` at `ready_for_review` until a person maps and approves the extracted fields.
