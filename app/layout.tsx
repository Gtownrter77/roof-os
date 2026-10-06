import './globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Metadata } from 'next'
import Navigation from '../components/Navigation'
import WorkspaceSwitcher from '../components/WorkspaceSwitcher'
import PrototypeNotice from '../components/PrototypeNotice'

export const metadata: Metadata = {
  title: 'ROOF/OS',
  description: 'Storm Command Center',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 pb-16">
        <PrototypeNotice />
        <WorkspaceSwitcher />
        {children}
        <Navigation />
      </body>
    </html>
  )
}
