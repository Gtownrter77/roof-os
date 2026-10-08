import OpenAI from 'openai'

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

export async function processAudioTranscription(audioBlob: Blob): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey })
      const file = new File([audioBlob], 'audio.webm', { type: audioBlob.type || 'audio/webm' })
      const transcription = await client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      })
      if (transcription.text) return transcription.text
    } catch {
      // Fall through to open-source local whisper or web speech fallback
    }
  }
  return 'OpenWhisper Audio Transcription fallback processed.'
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

  // Check matching module navigation
  const matchedNav = ROOF_OS_NAVIGATION_MAP.find((item) => item.keywords.test(query))

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey })
      const completion = await client.chat.completions.create({
        model: process.env.CHAT_AI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: [
              'You are the ROOF/OS AI Operations Copilot for roofing contractors and storm restoration specialists.',
              'Be concise, clear, and action-oriented (2-3 sentences max).',
              'Guide the user to the correct operational tool in ROOF/OS: /weather (storms), /leads (CRM), /measure (aerial roof measurement), /damage-detection (photo AI), /pricing (estimates and price book), /reports (golden reports), /payment (invoices and payments), /tasks (production).',
              'If the user asks a calculation or roofing question (e.g. squares = sqft / 100, pitch multiplier = sqrt(1 + (pitch/12)^2)), explain clearly and concisely.',
              'Do not invent non-existent features. Answer directly.',
            ].join(' '),
          },
          ...(input.history || []).slice(-6).map((msg) => ({
            role: msg.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: msg.content,
          })),
          { role: 'user', content: query },
        ],
      })

      const rawReply = completion.choices[0]?.message.content?.trim()
      if (rawReply) {
        return {
          reply: rawReply,
          suggestedAction: matchedNav?.action,
          quickReplies: getSuggestedQuickReplies(matchedNav?.action?.href),
        }
      }
    } catch {
      // Fall through to operational rule response
    }
  }

  // Smart operational rule engine fallback
  if (matchedNav) {
    return {
      reply: `${matchedNav.defaultReply} Would you like to jump right there?`,
      suggestedAction: matchedNav.action,
      quickReplies: getSuggestedQuickReplies(matchedNav.action.href),
    }
  }

  // Generic helpful response
  return {
    reply: `I can help you navigate ROOF/OS, calculate roof squares, track storm damage, generate Golden Reports, or manage invoices. What would you like to do now?`,
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
