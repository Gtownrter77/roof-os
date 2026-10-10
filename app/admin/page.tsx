export default function AdminPage() {
  const tools = [
    { title: 'Main dashboard', path: '/', detail: 'Open the ROOF/OS app' },
    { title: 'Leads', path: '/leads', detail: 'Lead workflow · app sign-in may be required' },
    { title: 'Canvassing', path: '/canvass', detail: 'Map and canvassing workflow · app sign-in may be required' },
    { title: 'Photo estimates', path: '/photo-estimate', detail: 'Photo estimate workflow · app sign-in may be required' },
    { title: 'Reports', path: '/reports', detail: 'Reports · app sign-in may be required' },
    { title: 'Settings', path: '/settings', detail: 'Workspace settings · app sign-in may be required' },
  ]

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">ROOF/OS · DEVELOPER</p>
            <h1 className="mt-1 text-2xl font-black">Developer Console</h1>
          </div>
          <a href="https://github.com/Gtownrter77/roof-os" target="_blank" rel="noreferrer" className="rounded-lg border border-white/15 px-4 py-2 text-sm">GitHub repo</a>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        <section className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-5">
          <h2 className="text-lg font-bold">Open developer access</h2>
          <p className="mt-2 text-sm text-slate-300">This screen is public and does not ask for a username or password. It shows navigation links only; it does not expose customer records, secrets, or admin actions.</p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-bold">App routes</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {tools.map((tool) => (
              <a key={tool.path} href={tool.path} className="block rounded-2xl border border-white/10 bg-slate-900 p-5 transition hover:border-red-400/60">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">{tool.title}</h3>
                  <span aria-hidden="true" className="text-red-400">↗</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">{tool.detail}</p>
                <p className="mt-3 text-xs font-semibold text-cyan-300">{tool.path}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900 p-5">
          <h2 className="font-bold">Build and test status</h2>
          <p className="mt-2 text-sm text-slate-300">Check the current GitHub Actions results before treating a change as verified.</p>
          <a href="https://github.com/Gtownrter77/roof-os/actions" target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-lg bg-red-600 px-4 py-3 font-bold">Open test runs</a>
        </section>
      </div>
    </main>
  )
}
