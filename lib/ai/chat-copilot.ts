async function askOllama(prompt: string): Promise<string | null> {
  const host = process.env.OLLAMA_HOST?.trim() || 'http://127.0.0.1:11434'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 1500)
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || 'llama3:8b',
        prompt,
        stream: false,
      }),
    })
    if (!response.ok) return null
    const data = await response.json() as { response?: string }
    return data.response?.trim() || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatAction = {
  label: string
  href: string
}

export type ChatResponse = {
  reply: string
  suggestedAction?: ChatAction
  quickReplies?: string[]
}

const ROOF_OS_NAVIGATION_MAP: { keywords: RegExp; action: ChatAction; defaultReply: string }[] = [
  {
    keywords: /storm|weather|hail|wind|radar|swath|tornado|nws/i,
    action: { label: 'Open Storm & Weather Tracker', href: '/weather' },
    defaultReply:
      'I can take you to the Storm & Weather Command Center to monitor live hail tracks, wind speeds, and incoming weather fronts.',
  },
  {
    keywords: /lead|crm|opportunity|contact|customer|pipeline/i,
    action: { label: 'View Opportunities & Leads', href: '/leads' },
    defaultReply:
      'Access your lead pipeline to track homeowner inquiries, scheduled inspections, and claim opportunities.',
  },
  {
    keywords: /aerial|pitch|square|measure|geometry|facet|rake|eave|ridge|valley/i,
    action: { label: 'Open Aerial Measurements', href: '/measure' },
    defaultReply:
      'You can calibrate aerial imagery, calculate roof slope and squares, and detect facets in the Aerial Measurement tool.',
  },
  {
    keywords: /photo|damage|vision|detect|hail strike|missing shingle|crack/i,
    action: { label: 'Run AI Photo Damage Detection', href: '/damage-detection' },
    defaultReply:
      'Upload inspection photos to scan for collateral storm damage, missing shingles, hail impacts, and crease lines.',
  },
  {
    keywords: /estimate|price|pricing|quote|cost|lowes|home depot|labor|catalog/i,
    action: { label: 'Open Estimate & Price Book', href: '/pricing' },
    defaultReply:
      'Review your material catalogs, retailer price feeds (Lowe’s & Home Depot), labor rates, and create verified estimate drafts.',
  },
  {
    keywords: /report|golden|pdf|packet|evidence|inspection review/i,
    action: { label: 'Generate Golden Inspection Report', href: '/reports' },
    defaultReply:
      'Assemble comprehensive claim packets and Golden Inspection Reports complete with property photos and technician verification.',
  },
  {
    keywords: /invoice|payment|stripe|pay|bill|checkout|collect/i,
    action: { label: 'Manage Payments & Invoices', href: '/payment' },
    defaultReply:
      'Generate payment links, review invoice balances, and track customer collections via Stripe.',
  },
  {
    keywords: /task|production|schedule|crew|dispatch|work order/i,
    action: { label: 'Open Production & Tasks', href: '/tasks' },
    defaultReply:
      'Manage production jobs, field appointments, technician assignments, and crew tasks.',
  },
  {
    keywords: /siding|soffit|elevation|facade|wall/i,
    action: { label: 'Open Siding & Elevation Tool', href: '/siding' },
    defaultReply:
      'Calculate wall elevations, openings, siding square footage, and trim specifications.',
  },
  {
    keywords: /invite|team|member|workspace|role/i,
    action: { label: 'Manage Workspace & Team', href: '/team' },
    defaultReply:
      'Invite adjusters, sales reps, and technicians to collaborate in your active workspace.',
  },
]

const BAKED_IN_LANGUAGES = new Set(['en', 'es', 'zh', 'fr'])

export async function processAudioTranscription(audioBlob: Blob, language = 'en'): Promise<string> {
  const code = language.split('-')[0].toLowerCase()
  if (!BAKED_IN_LANGUAGES.has(code) && code !== 'ko') {
    throw new Error(`Language ${code} is not enabled.`)
  }
  const worker = process.env.WHISPER_URL?.trim()
  if (!worker) {
    throw new Error('Local Whisper worker is not configured. Set WHISPER_URL.')
  }
  const body = new FormData()
  body.append('file', new File([audioBlob], 'audio.webm', { type: audioBlob.type || 'audio/webm' }))
  body.append('language', code)
  const response = await fetch(`${worker.replace(/\/$/, '')}/transcribe`, { method: 'POST', body })
  if (!response.ok) {
    throw new Error(`Local Whisper failed (${response.status}).`)
  }
  const payload = await response.json() as { text?: string }
  return payload.text?.trim() || ''
}

export async function processChatCopilot(input: {
  message: string
  history?: ChatMessage[]
  currentPath?: string
}): Promise<ChatResponse> {
  const query = input.message.trim()
  if (!query) {
    return {
      reply: 'What would you like to do now? You can ask me to navigate, calculate measurements, review storms, or generate reports.',
      quickReplies: ['Review Storm Leads', 'Aerial Roof Measure', 'Create Estimate', 'Golden Report'],
    }
  }

  const matchedNav = ROOF_OS_NAVIGATION_MAP.find((item) => item.keywords.test(query))
  const local = await askOllama([
    'You are the ROOF/OS operations copilot. Answer in two sentences. Do not invent prices, coverage, or measurements.',
    matchedNav ? `The matching screen is ${matchedNav.action.href}.` : 'No screen matched.',
    `User: ${query}`,
  ].join('\n'))

  if (local) {
    return {
      reply: local,
      suggestedAction: matchedNav?.action,
      quickReplies: getSuggestedQuickReplies(matchedNav?.action.href),
    }
  }

  if (matchedNav) {
    return {
      reply: `${matchedNav.defaultReply} Would you like to jump right there?`,
      suggestedAction: matchedNav.action,
      quickReplies: getSuggestedQuickReplies(matchedNav.action.href),
    }
  }

  return {
    reply: 'Local Ollama is not reachable. I can still open storm, leads, measure, reports, or invoices from the menu.',
    suggestedAction: { label: 'Go to Command Center', href: '/' },
    quickReplies: ['Track Active Storms', 'Aerial Measurement', 'New Estimate', 'Golden Report'],
  }
}

function getSuggestedQuickReplies(currentHref?: string): string[] {
  const all = [
    'Track Active Storms',
    'Review Storm Leads',
    'Aerial Roof Measure',
    'Detect Photo Damage',
    'Create Estimate',
    'Golden Report',
    'Manage Invoices',
  ]
  return all.filter((item) => !currentHref || !item.toLowerCase().includes(currentHref.replace('/', ''))).slice(0, 4)
}
