'use client'

type ReportItem = { label: string; value: string; source: string }
type ReportPhoto = { id: string; altText: string; caption: string; capturedAt: string; mimeType: string; usability: string }
type ReportSection = { id: string; title: string; statements?: string[]; items?: ReportItem[]; photos?: ReportPhoto[] }
type GoldenReportData = {
  title: string
  status: string
  generatedAt: string
  reportId: string
  sections: ReportSection[]
  footer: { motto: string; text: string; company: string; phone: string }
}

type GoldenReportProps = {
  report: GoldenReportData
  photoUrls: Map<string, string>
  onPrint: () => void
}

export function GoldenReport({ report, photoUrls, onPrint }: GoldenReportProps) {
  return (
    <section className="photo-estimate-report bg-white rounded-lg shadow p-4 mt-4" aria-labelledby="golden-report-title">
      <header className="flex items-start justify-between gap-3 border-b pb-3">
        <div>
          <h2 id="golden-report-title" className="text-xl font-bold">{report.title}</h2>
          <p className="text-sm text-amber-800 mt-1">DRAFT · Generated {new Date(report.generatedAt).toLocaleString()}</p>
          <p className="text-xs text-gray-600">Report ID: {report.reportId}</p>
        </div>
        <button onClick={onPrint} className="border px-3 py-2 rounded text-sm">Print</button>
      </header>

      {report.sections.map((section) => (
        <section key={section.id} className="mt-4 border-b pb-4 last:border-b-0">
          <h3 className="font-semibold text-lg">{section.title}</h3>
          {section.statements?.map((statement, index) => <p key={`${section.id}-statement-${index}`} className="text-sm mt-2">{statement}</p>)}
          {section.items && section.items.length > 0 && <dl className="mt-2 space-y-2">{section.items.map((item) => (
            <div key={item.label} className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-x-3 text-sm">
              <dt className="font-medium">{item.label}</dt>
              <dd><span>{item.value}</span><span className="block text-xs text-gray-600">Source: {item.source}</span></dd>
            </div>
          ))}</dl>}
          {section.photos && section.photos.length > 0 && <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">{section.photos.map((photo, index) => {
            const url = photoUrls.get(photo.id)
            return <li key={photo.id} className="border rounded p-2">
              {url ? <img src={url} alt={photo.altText} className="w-full max-h-72 object-contain rounded" /> : <p className="text-sm">Image unavailable in this session. Photo ID: {photo.id}.</p>}
              <p className="text-sm mt-2">Photo {index + 1}. Caption: {photo.caption}. Date taken: {photo.capturedAt}. File type: {photo.mimeType}. Usability: {photo.usability}</p>
            </li>
          })}</ol>}
        </section>
      ))}

      <footer className="golden-report-footer border-t pt-3 mt-4 text-xs">
        <p className="font-semibold">{report.footer.motto}</p>
        <p>{report.footer.text}</p>
        <p>Contact: {report.footer.company} · {report.footer.phone}</p>
      </footer>
    </section>
  )
}
