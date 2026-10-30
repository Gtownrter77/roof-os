import './globals.css'
import './storm-skin.css'
import './theme-collection.css'
import { headers } from 'next/headers'
import { THEME_BOOTSTRAP } from '../lib/theme/collection'
import ThemeExperience from '../components/ThemeExperience'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import Navigation from '../components/Navigation'
import WorkspaceSwitcher from '../components/WorkspaceSwitcher'
import PrototypeNotice from '../components/PrototypeNotice'
import ConditionalAiChatBar from '../components/ConditionalAiChatBar'
import AppShell from '../components/AppShell'
import CinemaTheme from '../components/CinemaTheme'
import DashboardSkinTheme from '../components/DashboardSkinTheme'
import DocumentLang from '../components/DocumentLang'

export const metadata: Metadata = {
  title: 'BAILEY OS — Storm Command Center',
  description: 'BAILEY OS — Roofing and restoration operations command center',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') || undefined
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#050914] text-slate-100">
        <script nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: "try{var v=localStorage.getItem('roofos.theme.cinema.v1');document.documentElement.dataset.cinema=v==='off'?'off':'on';var skin=localStorage.getItem('roofos.theme.dashboard-skin.v1');document.documentElement.dataset.dashboardSkin=skin==='storm'?'storm':'professional'}catch(e){document.documentElement.dataset.cinema='on';document.documentElement.dataset.dashboardSkin='professional'}",
          }}
        />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
        <ThemeExperience />
        <CinemaTheme />
        <DashboardSkinTheme />
        <DocumentLang />
        <PrototypeNotice />
        <WorkspaceSwitcher />
        <div className="theme-page-content"><AppShell>{children}</AppShell></div>
        <Navigation />
        <ConditionalAiChatBar />
      </body>
    </html>
  )
}
