'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  CloudLightning,
  FileText,
  Loader2,
  Minimize2,
  Ruler,
  Send,
  Users,
  X,
  Zap,
} from 'lucide-react'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  action?: { label: string; href: string }
}

const QUICK_ACTIONS = [
  { label: 'Track Storms', href: '/weather', icon: CloudLightning },
  { label: 'Review Leads', href: '/leads', icon: Users },
  { label: 'Aerial Measure', href: '/measure', icon: Ruler },
  { label: 'Create Estimate', href: '/pricing', icon: FileText },
  { label: 'Golden Report', href: '/reports', icon: Zap },
]

export default function AiChatBar() {
  const router = useRouter()
  const pathname = usePathname()
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Welcome to the ROOF/OS Command Center. What would you like to do now? Ask me anything or tap an action below to get started.',
      action: { label: 'Explore Storm Tracker', href: '/weather' },
    },
  ])

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Sit above the mobile bottom nav on pages that show it (home has no bottom nav).
  const aboveMobileNav = pathname !== '/'
  const dockClass = aboveMobileNav ? 'bottom-20 right-4 md:bottom-4 md:right-4' : 'bottom-4 right-4'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => {
          const next = !prev
          if (next) queueMicrotask(() => inputRef.current?.focus())
          return next
        })
      }
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [messages, isOpen])

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend ?? input).trim()
    if (!text || loading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsOpen(true)
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          currentPath: pathname,
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        throw new Error('Chat service responded with an error')
      }

      const data = await response.json()
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.reply || 'What would you like to do now?',
        action: data.suggestedAction,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content:
            "I'm ready to help you navigate ROOF/OS. What would you like to do now? Choose an action below or ask any question.",
          action: { label: 'Go to Command Center', href: '/' },
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSend()
  }

  return (
    <div
      className={`pointer-events-none fixed z-50 flex flex-col items-end gap-2 ${dockClass}`}
      role="region"
      aria-label="AI Command Bar"
    >
      {isOpen && (
        <div className="pointer-events-auto flex w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] flex-col overflow-hidden rounded-2xl border border-cyan-500/40 bg-[#080d1a]/95 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:w-[22rem]">
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-xs font-black tracking-wide text-white">ROOF/OS AI</h3>
                <p className="truncate text-[10px] text-cyan-300">Ask or pick a command</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() =>
                  setMessages([
                    {
                      id: 'reset',
                      role: 'assistant',
                      content:
                        'Chat reset. What would you like to do now? Ask me anything or select a command.',
                    },
                  ])
                }
                className="rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-white/10 hover:text-white"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Minimize AI Chat"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Close AI Chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="ops-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'border border-cyan-500/20 bg-slate-900/90 text-slate-200 shadow-md'
                  }`}
                >
                  <p className="leading-relaxed">{msg.content}</p>
                  {msg.action && (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(msg.action!.href)
                        setIsOpen(false)
                      }}
                      className="mt-2 flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/30"
                    >
                      <span>{msg.action.label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-xs text-cyan-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-white/5 bg-black/20 p-2">
            <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
              {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    void handleSend(`How do I use ${label}?`)
                  }}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                >
                  <Icon className="h-3 w-3 text-cyan-400" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask ROOF/OS…"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white shadow-md transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40"
                aria-label="Send message to AI"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-slate-500">Esc to close · Cmd+K</p>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-cyan-500/50 bg-[#090e1a]/95 px-3.5 py-2.5 text-sm font-semibold text-cyan-100 shadow-[0_10px_35px_rgba(0,0,0,0.75)] backdrop-blur-2xl transition hover:border-cyan-300 hover:bg-cyan-500/15"
          aria-label="Open AI Chat"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <Bot className="h-4 w-4 text-cyan-300" />
          <span>AI Copilot</span>
          <span className="hidden text-[10px] font-normal text-slate-400 sm:inline">⌘K</span>
        </button>
      )}
    </div>
  )
}
