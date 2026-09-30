-- Migration 036: Add AI Multimodal Vision Analysis and Content Hash to Photo Estimate Workflows.
-- Strictly additive and non-authoritative. Preserves all existing technician measurements and RLS policies.

alter table public.photo_estimate_workflows
  add column if not exists ai_analysis jsonb default null,
  add column if not exists ai_analyzed_at timestamptz default null,
  add column if not exists ai_model_version text default null,
  add column if not exists ai_content_hash text default null;

comment on column public.photo_estimate_workflows.ai_analysis is
  'Non-authoritative visual detections, roof style, facets, edges, and damage markers extracted from inspection photos.';

comment on column public.photo_estimate_workflows.ai_content_hash is
  'SHA-256 digest of sorted individual image byte hashes for idempotent caching and quota protection.';
