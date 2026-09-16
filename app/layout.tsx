import './globals.css'
import type { Metadata } from 'next'
import Navigation from '../components/Navigation'

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
        {children}
        <Navigation />
      </body>
    </html>
  )
}
