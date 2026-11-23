'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import RoofrRoofsnapForm from '../../../components/RoofrRoofsnapForm'

// The query string is the only intake: a certified photo and its inspection
// are identified by id. There is deliberately no typed-address lookup here.
function MashupInner() {
  const search = useSearchParams()
  const photoId = search.get('photoId') || ''
  const inspectionId = search.get('inspectionId') || ''
  return <RoofrRoofsnapForm photoId={photoId} inspectionId={inspectionId} />
}

export default function MashupMeasurePage() {
  return (
    <Suspense fallback={<p className="p-4 text-sm text-slate-400">Loading measurement workspace…</p>}>
      <MashupInner />
    </Suspense>
  )
}
