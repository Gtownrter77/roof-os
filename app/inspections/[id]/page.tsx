'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { smartBack } from '../../../lib/smart-back'

type ChecklistItem = { key: string; label: string; status: 'pass' | 'review' | 'missing'; detail: string }
type PacketPhoto = { id: string; album: string; caption: string | null; mimeType: string; capturedAt: string | null; uploadStatus: string; hasCaption: boolean; objectPath: string }
type PacketMeasurement = { id: string; sourceType: string; confidence: string; sourceReference: string | null; capturedAt: string; values: Record<string, number | string> }
type Packet = {
  packetVersion: string
  generatedAt: string
  inspection: { id: string; leadId: string | null; status: string; startedAt: string; completedAt: string | null }
  privacy: { storageBucket: string; publicAccess: boolean; urlsIncluded: boolean; note: string }
  photos: PacketPhoto[]
  albumCounts: Record<string, number>
  measurements: PacketMeasurement[]
  agent3: { reviewed: boolean; issueCount: number; issues: string[] }
  checklist: ChecklistItem[]
  blockingIssues: string[]
  reviewItems: string[]
  readyForReview: boolean
}

const STATUS_STYLE: Record<ChecklistItem['status'], string> = {
  pass: 'bg-emerald-400/15 text-emerald-300',
  review: 'bg-amber-400/15 text-amber-200',
  missing: 'bg-red-400/15 text-red-300',
}

export default function InspectionPacketPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [packet, setPacket] = useState<Packet | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }
      const response = await fetch(`/api/inspections/${params.id}/packet`, { cache: 'no-store' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error || 'Could not load the inspection packet.')
        setLoading(false)
        return
      }
      const nextPacket: Packet = body.packet
      setPacket(nextPacket)
      setLoading(false)

      // Short-lived, member-only URLs. Nothing public is stored or returned by the API.
      const entries = await Promise.all(nextPacket.photos.map(async (photo) => {
        const { data } = await supabase.storage.from(nextPacket.privacy.storageBucket).createSignedUrl(photo.objectPath, 300)
        return [photo.id, data?.signedUrl ?? ''] as const
      }))
      setSignedUrls(Object.fromEntries(entries.filter(([, url]) => url)))
    }
    void load()
  }, [params.id, router, supabase])

  return (
    <main className="mx-auto max-w-[1180px] p-4 pb-16 md:p-6">
      <button onClick={() => smartBack(router)} className="mb-3 text-xs text-cyan-300">← Back</button>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ops-label">Inspection evidence</p>
          <h1 className="text-3xl font-black">Review packet</h1>
          <p className="mt-1 text-sm text-slate-400">Private photo metadata, recorded measurements and the Agent 3 checklist.</p>
        </div>
        {packet && (
          <span className={`rounded px-3 py-1.5 text-sm font-semibold ${packet.readyForReview ? 'bg-emerald-400/15 text-emerald-300' : 'bg-red-400/15 text-red-300'}`}>
            {packet.readyForReview ? 'Ready for review' : `${packet.blockingIssues.length} blocking issue${packet.blockingIssues.length === 1 ? '' : 's'}`}
          </span>
        )}
      </header>

      {error && <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300" role="alert">{error}</p>}
      {loading && <div className="glass rounded-xl p-6 text-sm text-slate-400">Loading packet…</div>}

      {packet && (
        <div className="space-y-4">
          <section className="glass rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm text-slate-400">Session {packet.inspection.id.slice(0, 8)} · {packet.inspection.status.replace('_', ' ')}</p>
                <p className="text-xs text-slate-500">Started {new Date(packet.inspection.startedAt).toLocaleString()}{packet.inspection.completedAt ? ` · completed ${new Date(packet.inspection.completedAt).toLocaleString()}` : ''}</p>
              </div>
              {packet.inspection.leadId && (
                <button onClick={() => router.push(`/leads/${packet.inspection.leadId}`)} className="rounded border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-400/60">Open lead</button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">{packet.privacy.note} Packet {packet.packetVersion}, generated {new Date(packet.generatedAt).toLocaleString()}.</p>
          </section>

          <section className="glass rounded-xl p-4">
            <h2 className="mb-3 font-semibold">Checklist</h2>
            <ul className="space-y-2">
              {packet.checklist.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.detail}</p>
                  </div>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[item.status]}`}>{item.status}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-xl p-4">
            <h2 className="mb-3 font-semibold">Photos ({packet.photos.length})</h2>
            {packet.photos.length === 0 && <p className="text-sm text-slate-400">No photos recorded for this inspection.</p>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {packet.photos.map((photo) => (
                <figure key={photo.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/20">
                  {signedUrls[photo.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={signedUrls[photo.id]} alt={photo.caption || `${photo.album} inspection photo`} className="h-40 w-full object-cover" />
                  ) : (
                    <div className="flex h-40 items-center justify-center text-xs text-slate-500">Preview unavailable</div>
                  )}
                  <figcaption className="p-3 text-xs">
                    <p className="font-medium text-slate-200">{photo.caption || 'No caption'}</p>
                    <p className="mt-1 text-slate-500">{photo.album} · {photo.uploadStatus}{photo.capturedAt ? ` · ${new Date(photo.capturedAt).toLocaleString()}` : ''}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section className="glass rounded-xl p-4">
            <h2 className="mb-3 font-semibold">Measurements ({packet.measurements.length})</h2>
            {packet.measurements.length === 0 && <p className="text-sm text-slate-400">No measurement rows. The packet does not estimate missing values.</p>}
            <ul className="space-y-2">
              {packet.measurements.map((measurement) => (
                <li key={measurement.id} className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                  <p className="font-medium text-slate-200">{measurement.sourceType} · {measurement.confidence}</p>
                  <p className="mt-1 text-slate-400">{Object.entries(measurement.values).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'No stated values'}</p>
                  <p className="mt-1 text-slate-500">Captured {new Date(measurement.capturedAt).toLocaleString()}{measurement.sourceReference ? ` · ${measurement.sourceReference}` : ''}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="glass rounded-xl p-4">
            <h2 className="mb-2 font-semibold">Agent 3 evidence review</h2>
            {!packet.agent3.reviewed && <p className="text-sm text-slate-400">Agent 3 has not reviewed this inspection yet. Nothing is inferred in its place.</p>}
            {packet.agent3.reviewed && packet.agent3.issueCount === 0 && <p className="text-sm text-emerald-300">No evidence issues reported.</p>}
            {packet.agent3.reviewed && packet.agent3.issueCount > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-200">
                {packet.agent3.issues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
