import Link from 'next/link'

type TourItem = {
  title: string
  href: string
  description: string
}

const ADMIN_TOUR: TourItem[] = [
  {
    title: 'Leads and CRM',
    href: '/leads',
    description: 'Start with a real opportunity. Create a lead only when you choose to enter one.',
  },
  {
    title: 'Inspections and photo evidence',
    href: '/inspections',
    description: 'Open an inspection from a lead, capture actual evidence, and review the packet.',
  },
  {
    title: 'Measurements',
    href: '/measure',
    description: 'Review measurement tools and their evidence requirements before relying on quantities.',
  },
  {
    title: 'Estimates and approval',
    href: '/estimate',
    description: 'Review estimates. Pricing, customer acceptance, and deposit records remain explicit human actions.',
  },
  {
    title: 'Production jobs',
    href: '/jobs',
    description: 'Jobs appear after an accepted estimate is deliberately handed off; this tour creates none.',
  },
  {
    title: 'Calendar and scheduling',
    href: '/calendar',
    description: 'Review the scheduling workspace. This tour does not assign crews or schedule work.',
  },
  {
    title: 'Warranty and closeout',
    href: '/warranty',
    description: 'Review warranty records and their evidence requirements. This tour does not register or change a warranty.',
  },
  {
    title: 'Workspace defaults',
    href: '/settings',
    description: 'Review locale, service ZIP, preferred brands, and catalog preferences through the existing owner authorization flow.',
  },
]

const TEAM_TOUR: TourItem[] = [
  {
    title: 'Leads and CRM',
    href: '/leads',
    description: 'Review the opportunities available to your workspace role. Create or change records only when assigned and authorized.',
  },
  {
    title: 'Inspections',
    href: '/inspections',
    description: 'Open assigned inspection work and use real photos and evidence. Do not invent missing measurements.',
  },
  {
    title: 'Measurements',
    href: '/measure',
    description: 'Review measurement tools and their evidence requirements before relying on quantities.',
  },
  {
    title: 'Calendar and scheduling',
    href: '/calendar',
    description: 'Check the scheduling workspace. Your existing role permissions still determine what you can change.',
  },
]

export default function WorkspaceFirstSuccessGuide({ canEdit, primaryGoal }: { canEdit: boolean; primaryGoal?: string }) {
  const items = canEdit ? ADMIN_TOUR : TEAM_TOUR

  return (
    <details className="mt-5 rounded-2xl border border-violet-300/25 bg-violet-950/20 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-violet-100">
        Take your first-success tour
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">
        {canEdit
          ? 'A guided map of the real ROOF/OS workflow, from a lead through inspection, estimate, and production.'
          : 'A short orientation to the main work areas. Open only the areas your workspace role allows.'}
        {' '}No demo records are created and no operational action is started by this tour.
      </p>
      {primaryGoal && <p className="mt-2 rounded-lg border border-violet-200/15 bg-black/15 p-3 text-xs text-violet-100">First priority: {primaryGoal}</p>}
      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/15 p-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-300/15 text-xs font-bold text-violet-100">{index + 1}</span>
            <div className="min-w-0">
              <Link href={item.href} className="text-sm font-semibold text-cyan-200 underline decoration-cyan-200/40 underline-offset-4 hover:text-cyan-100">{item.title} ↗</Link>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-slate-500">
        Human review remains required for prices, approvals, customer acceptance, deposits, handoffs, crew assignments, and scheduling.
      </p>
    </details>
  )
}
