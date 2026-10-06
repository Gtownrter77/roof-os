'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronUp,
  CloudLightning,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Ruler,
  Send,
  Sparkles,
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

  // Global keyboard shortcut: Cmd+K / Ctrl+K opens chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
      // Graceful offline fallback
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
      className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3 lg:left-[232px]"
      role="region"
      aria-label="AI Command Bar"
    >
      <div className="pointer-events-auto w-full max-w-2xl flex flex-col">
        {/* Expanded Chat Dialogue */}
        {isOpen && (
          <div className="mb-2 flex max-h-[460px] flex-col rounded-2xl border border-cyan-500/40 bg-[#080d1a]/95 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wide text-white">ROOF/OS AI COPILOT</h3>
                  <p className="text-[11px] text-cyan-300">What would you like to do now?</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
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
              </div>
            </div>

            {/* Message Stream */}
            <div className="ops-scrollbar flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'border border-cyan-500/20 bg-slate-900/90 text-slate-200 shadow-md'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.content}</p>

                    {/* Action button if suggested by AI */}
                    {msg.action && (
                      <button
                        type="button"
                        onClick={() => {
                          router.push(msg.action!.href)
                          setIsOpen(false)
                        }}
                        className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-400/50 bg-cyan-500/15 px-3 py-1.5 text-xs font-bold text-cyan-300 transition hover:bg-cyan-500/30"
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

            {/* Quick Prompts Carousel in dialogue */}
            <div className="border-t border-white/5 bg-black/20 p-2.5">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      void handleSend(`How do I use ${label}?`)
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 hover:text-cyan-200"
                  >
                    <Icon className="h-3 w-3 text-cyan-400" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Floating AI Command Bar */}
        <div className="rounded-2xl border border-cyan-500/40 bg-[#090e1a]/95 p-2.5 shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-2xl transition hover:border-cyan-400">
          {/* Top prompt bar label */}
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-cyan-400">
                AI Copilot
              </span>
              <span className="text-xs font-semibold text-slate-300">
                What would you like to do now?
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] text-slate-400 sm:inline">Press Cmd+K</span>
              <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label={isOpen ? 'Collapse AI Chat' : 'Expand AI Chat'}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Input and submit */}
          <form onSubmit={onSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => {
                  if (!isOpen && messages.length > 1) setIsOpen(true)
                }}
                placeholder="What would you like to do now? Ask or describe a task..."
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 font-bold text-white shadow-md transition hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40"
              aria-label="Send message to AI"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>

          {/* Quick Action Chips when collapsed */}
          {!isOpen && (
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto px-1 pt-1 text-xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 whitespace-nowrap">
                Suggestions:
              </span>
              {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => router.push(href)}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/10 hover:text-cyan-200 whitespace-nowrap"
                >
                  <Icon className="h-3 w-3 text-cyan-400" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
