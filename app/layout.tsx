import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import Navigation from '../components/Navigation'
import WorkspaceSwitcher from '../components/WorkspaceSwitcher'
import PrototypeNotice from '../components/PrototypeNotice'
import ConditionalAiChatBar from '../components/ConditionalAiChatBar'
import AppShell from '../components/AppShell'
import CinemaTheme from '../components/CinemaTheme'

export const metadata: Metadata = {
  title: 'ROOF/OS — Storm Command Center',
  description: 'Storm-driven roofing operations command center',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#050914] text-slate-100">
        <script
          dangerouslySetInnerHTML={{
            __html: "try{var v=localStorage.getItem('roofos.theme.cinema.v1');document.documentElement.dataset.cinema=v==='off'?'off':'on'}catch(e){document.documentElement.dataset.cinema='on'}",
          }}
        />
        <CinemaTheme />
        <PrototypeNotice />
        <WorkspaceSwitcher />
        <AppShell>{children}</AppShell>
        <Navigation />
        <ConditionalAiChatBar />
      </body>
    </html>
  )
}
