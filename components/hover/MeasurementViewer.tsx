'use client'

import { viewerCannotMeasure } from '../../lib/hover/viewer.ts'
import type { ViewerModel } from '../../lib/hover/types.ts'

/**
 * Presentation-only overlay. The splat/mesh is a navigation aid; no dimension is
 * computed from it. Values and evidence links come straight from locked records.
 */
export default function MeasurementViewer({ model }: { model: ViewerModel }) {
  if (viewerCannotMeasure && model.measurementSource !== 'measurement-records') return null

  return (
    <section aria-label="Measured exterior model" className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold">3D visual twin</p>
        <p className="text-xs text-slate-600">
          {model.facets.length} modeled facet{model.facets.length === 1 ? '' : 's'} ·
          {' '}{model.splatUrl ? 'Splat preview available' : 'Mesh preview only'}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          The model is for orientation only. Measurements come from locked records with photo evidence.
        </p>
      </div>

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {model.overlays.map((overlay) => (
          <li key={overlay.measurementId} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span>{overlay.label}</span>
            {overlay.evidenceLinks.map((link) => (
              <a key={link.href} href={link.href} className="text-sky-700 underline">
                {link.label}
              </a>
            ))}
          </li>
        ))}
      </ul>
      {model.overlays.length === 0 && (
        <p className="text-sm text-amber-700">
          Relative-only model: no measurements are published for this job.
        </p>
      )}
    </section>
  )
}
