import Link from 'next/link'
import ThemePicker from '../../components/ThemePicker'
export default function ThemesPage() {
  return <main className="theme-gallery mx-auto max-w-[1400px] px-4 py-8 md:px-8 md:py-12">
    <div className="theme-gallery-top"><Link href="/">ROOF<span>/</span>OS</Link><Link href="/auth/login">SIGN IN ↗</Link></div>
    <ThemePicker />
  </main>
}
