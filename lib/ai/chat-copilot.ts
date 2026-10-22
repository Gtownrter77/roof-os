import { askOllama } from './ollama.ts'

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
    action: { label: 'Open Photo Estimate', href: '/photo-estimate' },
    defaultReply:
      'Open Photo Estimate to upload inspection photos and build a technician-reviewed report packet. The optional AI observation step requires workspace-admin access.',
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
    action: { label: 'Open Workspace Team', href: '/team' },
    defaultReply:
      'Review or send workspace invitations from the Team page. This requires workspace-admin access and configured email delivery.',
  },
]

/**
 * Transcribe audio using the open-source faster-whisper worker.
 * Returns null when the worker is unavailable; callers must not report that
 * as a successful or sourced transcription.
 */
export async function processAudioTranscription(
  audioBlob: Blob,
  language = process.env.WHISPER_LANGUAGE || 'en',
): Promise<string | null> {
  const workerUrl =
    process.env.WHISPER_WORKER_URL?.trim() || process.env.WHISPER_URL?.trim()
  if (!workerUrl) return null
  try {
    const form = new FormData()
    form.append('audio', audioBlob, 'audio.webm')
    form.append('language', language)
    const response = await fetch(workerUrl, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { text?: string }
    return payload.text?.trim() || null
  } catch {
    return null
  }
}

export async function processChatCopilot(input: {
  message: string
  history?: ChatMessage[]
  currentPath?: string
}): Promise<ChatResponse> {
  const query = input.message.trim()
  if (!query) {
    return {
      reply:
        'What would you like to do now? You can ask me to navigate, calculate measurements, review storms, or generate reports.',
      quickReplies: ['Review Storm Leads', 'Aerial Roof Measure', 'Create Estimate', 'Golden Report'],
    }
  }

  const explicitPhotoIntent = /\b(photo|photos|image|images|vision|damage detection|detect damage|hail strike|missing shingle|crack)\b/i.test(query)
  const photoMatch = explicitPhotoIntent
    ? ROOF_OS_NAVIGATION_MAP.find((item) => item.action.href === '/photo-estimate' && item.keywords.test(query))
    : undefined
  const matchedNav = photoMatch || ROOF_OS_NAVIGATION_MAP.find((item) => item.keywords.test(query))
  const historyBlock = (input.history || [])
    .slice(-6)
    .map((item) => `${item.role}: ${item.content}`)
    .join('\n')

  const llmReply = await askOllama(
    [
      'You are the ROOF/OS operations copilot for a roofing company.',
      'Answer in at most two short sentences.',
      'Do not invent prices, coverage decisions, measurements, or claim outcomes.',
      'If a matching screen is provided, mention it and keep the user oriented.',
      matchedNav ? `The matching screen is ${matchedNav.action.href} (${matchedNav.action.label}).` : 'No screen matched.',
      input.currentPath ? `Current path: ${input.currentPath}` : '',
      historyBlock ? `Recent conversation:\n${historyBlock}` : '',
      `User: ${query}`,
    ]
      .filter(Boolean)
      .join('\n'),
    { timeoutMs: 2_500 },
  )

  if (llmReply) {
    return {
      reply: llmReply,
      suggestedAction: matchedNav?.action,
      quickReplies: getSuggestedQuickReplies(matchedNav?.action.href),
    }
  }

  if (matchedNav) {
    return {
      reply: `${matchedNav.defaultReply} Local Ollama is unavailable, so this reply is rule-based navigation. Would you like to open that screen?`,
      suggestedAction: matchedNav.action,
      quickReplies: getSuggestedQuickReplies(matchedNav.action.href),
    }
  }

  return {
    reply:
      'Local Ollama is not reachable. I can still open storms, leads, measurements, estimates, reports, or invoices from here.',
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
  return all
    .filter((item) => !currentHref || !item.toLowerCase().includes(currentHref.replace('/', '')))
    .slice(0, 4)
}
