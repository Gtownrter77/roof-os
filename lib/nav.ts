import {
  Activity,
  CalendarDays,
  Camera,
  ClipboardList,
  CloudLightning,
  FileText,
  Footprints,
  Gauge,
  Home as HomeIcon,
  ListChecks,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type AppNavItem = {
  href: string
  label: string
  icon: LucideIcon
  pilot?: boolean
}

export const APP_NAV_ITEMS: AppNavItem[] = [
  { href: '/', label: 'Dashboard', icon: HomeIcon },
  { href: '/weather', label: 'Weather & radar', icon: CloudLightning },
  { href: '/storms', label: 'Storm alerts', icon: Activity },
  { href: '/leads', label: 'Leads & CRM', icon: Users },
  { href: '/canvass', label: 'Field canvass', icon: Footprints },
  { href: '/inspections', label: 'Inspections', icon: ClipboardList },
  { href: '/measure', label: 'Measurements', icon: Gauge },
  { href: '/photo-estimate', label: 'Photo reports', icon: Camera },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/pricing-config', label: 'Price book', icon: Wallet },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/warranty', label: 'Warranties', icon: ShieldCheck },
  { href: '/ai', label: 'AI tools · pilot', icon: Sparkles, pilot: true },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export const APP_SHELL_HIDDEN = ['/auth', '/onboarding', '/admin', '/portal', '/team/invitations']
