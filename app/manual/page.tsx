'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

export default function ManualPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [tourMode, setTourMode] = useState(false)

  const categories = [
    'All', 'Getting Started', 'Leads', 'Estimating', 'AI Features', 
    'Tools', 'Compliance', 'Logistics', 'Training', 'Settings'
  ]

  const manualSections = [
    {
      id: 'getting-started',
      category: 'Getting Started',
      title: '🚀 Getting Started with ROOF/OS',
      icon: '🚀',
      steps: [
        { 
          step: 1, 
          title: 'Create Your Account', 
          description: 'Sign up with your email and password to get started.',
          action: 'Click Sign Up',
          tip: 'Use your company email for best results'
        },
        { 
          step: 2, 
          title: 'Set Up Your Profile', 
          description: 'Add your company name, logo, and contact information.',
          action: 'Go to Settings → Profile',
          tip: 'Add your company logo for professional estimates'
        },
        { 
          step: 3, 
          title: 'Configure Your Pricing', 
          description: 'Set up your labor rates, material markup, and sales tax.',
          action: 'Go to Pricing Configuration',
          tip: 'Update labor rates based on your market'
        },
        { 
          step: 4, 
          title: 'Start Your First Lead', 
          description: 'Create your first lead and begin the workflow.',
          action: 'Click + New Lead',
          tip: 'Enter as much detail as possible'
        }
      ]
    },
    {
      id: 'leads',
      category: 'Leads',
      title: '👤 Lead Management Guide',
      icon: '👤',
      steps: [
        { 
          step: 1, 
          title: 'Adding a New Lead', 
          description: 'Enter customer details, property address, and source.',
          action: 'Click + New Lead',
          tip: 'Always include phone number for follow-up'
        },
        { 
          step: 2, 
          title: 'Lead Status Tracking', 
          description: 'Track leads through the pipeline: New → Assigned → Contacting → Qualified → Inspection Scheduled → Inspected → Report Pending → Report Approved → Estimate → Won/Lost.',
          action: 'Update status in lead details',
          tip: 'Keep statuses updated for accurate pipeline'
        },
        { 
          step: 3, 
          title: 'Lead Assignment', 
          description: 'Assign leads to team members based on territory and availability.',
          action: 'Use the assignment dropdown',
          tip: 'Round-robin assignment ensures fair distribution'
        },
        { 
          step: 4, 
          title: 'SLA Tracking', 
          description: 'Monitor response times and SLA compliance.',
          action: 'Check SLA dashboard',
          tip: 'Aim for under 15 minutes first response'
        }
      ]
    },
    {
      id: 'estimating',
      category: 'Estimating',
      title: '📊 Estimating Guide',
      icon: '📊',
      steps: [
        { 
          step: 1, 
          title: 'Photo AI Estimation', 
          description: 'Upload evidence and review AI-assisted observations; the workflow still requires human review before estimating.',
          action: 'Go to Photo AI',
          tip: 'Take clear photos from multiple angles'
        },
        { 
          step: 2, 
          title: 'Xactimate-Style Pricing', 
          description: 'Prepare owner-managed draft pricing; claims pricing still requires an approved source and review.',
          action: 'Go to Pricing',
          tip: 'Adjust rates based on your market'
        },
        { 
          step: 3, 
          title: 'Supplement Engine', 
          description: 'Review supplement findings and document additional work before approval.',
          action: 'Go to Supplement',
          tip: 'Review all supplements before approving'
        },
        { 
          step: 4, 
          title: 'Exterior Estimating', 
          description: 'Estimate gutters, siding, windows, doors, decks, and more.',
          action: 'Go to Exterior or Siding',
          tip: 'Enter accurate measurements for best results'
        }
      ]
    },
    {
      id: 'ai-features',
      category: 'AI Features',
      title: '🤖 AI Features Guide',
      icon: '🤖',
      steps: [
        { 
          step: 1, 
          title: 'AI Photo Verification', 
          description: 'Review AI-assisted photo coverage suggestions; they are not measurement or approval authority.',
          action: 'Go to Photo Verify',
          tip: 'Cover all elevations and slopes'
        },
        { 
          step: 2, 
          title: 'AI Construction Wizard', 
          description: 'Ask construction questions and receive AI suggestions that must be verified against local requirements.',
          action: 'Go to AI Wizard',
          tip: 'Ask about codes, materials, or best practices'
        },
        { 
          step: 3, 
          title: 'AI Upsell Engine', 
          description: 'Review suggested upsell opportunities; no customer-facing recommendation is automatic.',
          action: 'Go to Upsell',
          tip: 'Focus on high-priority upgrades first'
        },
        { 
          step: 4, 
          title: 'AI Training Center', 
          description: 'Step-by-step guidance for every job type.',
          action: 'Go to Training Center',
          tip: 'Perfect for new employee onboarding'
        }
      ]
    },
    {
      id: 'tools',
      category: 'Tools',
      title: '🛠️ Tools Guide',
      icon: '🛠️',
      steps: [
        { 
          step: 1, 
          title: 'AR Pitch Gauge', 
          description: 'Pilot only: pitch-gauge behavior is not treated as authoritative measurement.',
          action: 'Go to Pitch Gauge',
          tip: 'Point camera at roof edge for accuracy'
        },
        { 
          step: 2, 
          title: 'Sketch Pad', 
          description: 'Draw roof layouts and add measurements.',
          action: 'Go to Sketch Pad',
          tip: 'Use for complex roof designs'
        },
        { 
          step: 3, 
          title: 'Drone Integration', 
          description: 'Pilot only: connect a real drone source before using telemetry or aerial measurements.',
          action: 'Go to Drone',
          tip: 'Scan the entire roof from above'
        },
        { 
          step: 4, 
          title: 'Home Depot Direct', 
          description: 'Search Home Depot provider reference data; ordering is not performed by this screen.',
          action: 'Go to Home Depot',
          tip: 'Add items to cart for quick checkout'
        }
      ]
    },
    {
      id: 'compliance',
      category: 'Compliance',
      title: '📋 Compliance & Insurance Guide',
      icon: '📋',
      steps: [
        { 
          step: 1, 
          title: 'Building Codes', 
          description: 'Use the available code reference snapshot and verify the current local requirement before relying on it.',
          action: 'Go to Codes',
          tip: 'Check local codes before estimating'
        },
        { 
          step: 2, 
          title: 'Insurance Intelligence', 
          description: 'Review available insurance-intelligence references; verify the current rule, carrier requirement, or permit authority before relying on it.',
          action: 'Go to Insurance Intel',
          tip: 'Enter address to check permit requirements'
        },
        { 
          step: 3, 
          title: 'Insurance Claims Directory', 
          description: 'Use the claims directory as a contact reference and verify the current carrier contact before use.',
          action: 'Go to Insurance',
          tip: 'Save time with one-tap calling'
        },
        { 
          step: 4, 
          title: 'Permit Flagging', 
          description: 'Use address-based information as a lead for permit review; the local authority remains the source of truth.',
          action: 'Enter address in Insurance Intel',
          tip: 'Always verify permit requirements'
        }
      ]
    },
    {
      id: 'logistics',
      category: 'Logistics',
      title: '🚛 Job Site Logistics Guide',
      icon: '🚛',
      steps: [
        { 
          step: 1, 
          title: 'Dumpster Rentals', 
          description: 'Use logistics planning ranges and provider links; live availability and ordering are not performed here.',
          action: 'Go to Logistics',
          tip: 'Rubber wheel trailers are preferred'
        },
        { 
          step: 2, 
          title: 'Porta John Rentals', 
          description: 'Use provider links and planning guidance; live availability and ordering are not performed here.',
          action: 'Go to Logistics',
          tip: 'Order deluxe units with hand washing stations'
        },
        { 
          step: 3, 
          title: 'Material Ordering', 
          description: 'Use the Home Depot provider reference workflow; ordering is not performed in ROOF/OS.',
          action: 'Go to Home Depot',
          tip: 'Check daily prices for best deals'
        }
      ]
    },
    {
      id: 'training',
      category: 'Training',
      title: '🎓 Training & Support Guide',
      icon: '🎓',
      steps: [
        { 
          step: 1, 
          title: 'AI Training Center', 
          description: 'Step-by-step job training with hand-holding guidance.',
          action: 'Go to Training Center',
          tip: 'Select job type and follow each step'
        },
        { 
          step: 2, 
          title: 'Multi-Language Support', 
          description: 'Translate supported construction phrases with the built-in English-to-Spanish, French, and German phrasebook.',
          action: 'Go to Translate',
          tip: 'Useful for the currently supported phrasebook languages; verify the translation before customer use.'
        },
        { 
          step: 3, 
          title: 'Help & Support', 
          description: 'Access FAQs and contact support.',
          action: 'Go to Help',
          tip: 'Search for specific issues'
        }
      ]
    },
    {
      id: 'settings',
      category: 'Settings',
      title: '⚙️ Settings & Configuration Guide',
      icon: '⚙️',
      steps: [
        { 
          step: 1, 
          title: 'Pricing Configuration', 
          description: 'Set labor rates, material markup, and sales tax.',
          action: 'Go to Pricing Config',
          tip: 'Update daily for accurate estimates'
        },
        { 
          step: 2, 
          title: 'Profile Settings', 
          description: 'Update your profile and company information.',
          action: 'Go to Profile',
          tip: 'Keep contact information current'
        },
        { 
          step: 3, 
          title: 'Dark Mode', 
          description: 'Toggle between light and dark mode.',
          action: 'Click 🌙 or ☀️ in header',
          tip: 'Dark-mode behavior and battery impact depend on the device and display.'
        }
      ]
    }
  ]

  const filteredSections = manualSections.filter(section => {
    const matchesCategory = selectedCategory === 'All' || section.category === selectedCategory
    const matchesSearch = section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.steps.some(step => 
        step.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        step.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    return matchesCategory && (searchQuery === '' || matchesSearch)
  })

  const startTour = () => {
    setTourMode(true)
    setCurrentStep(0)
    setExpandedSection(manualSections[0]?.id || null)
  }

  const nextTourStep = () => {
    const allSteps = manualSections.flatMap(s => s.steps)
    if (currentStep < allSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      setTourMode(false)
    }
  }

  const prevTourStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const allSteps = manualSections.flatMap(s => s.steps)
  const currentTourStep = allSteps[currentStep]

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300">←</button>
          <h1 className="text-xl font-bold">📖 Interactive Manual</h1>
          <span className="ml-2 bg-amber-400/100 text-white text-xs px-2 py-0.5 rounded-full">LOCAL GUIDE</span>
        </div>
      </header>

      <main className="p-4"><p className="text-sm glass rounded-xl p-4 mb-4">This is a local guide. It is not a saved training record.</p>
        {/* Search & Filter */}
        <div className="glass rounded-xl p-4 mb-4 border border-cyan-400/30">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the manual..."
              className="flex-1 p-2 border rounded-lg text-sm"
            />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="p-2 border rounded-lg text-sm"
            >
              {categories.map((cat) => (
                <option key={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tour Button */}
        <button
          onClick={startTour}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold mb-4"
        >
          🎯 Start Interactive Tour
        </button>

        {/* Tour Mode */}
        {tourMode && currentTourStep && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-lg p-4 mb-4 border-2 border-blue-500 animate-fadeIn">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-slate-400">Step {currentStep + 1} of {allSteps.length}</span>
                <h3 className="font-bold text-lg">{currentTourStep.title}</h3>
                <p className="text-sm text-slate-300 mt-1">{currentTourStep.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="bg-blue-100 text-cyan-200 text-xs px-2 py-1 rounded">⚡ {currentTourStep.action}</span>
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">💡 {currentTourStep.tip}</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-4xl">{manualSections.find(s => s.steps.includes(currentTourStep))?.icon || '📖'}</div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={prevTourStep}
                    disabled={currentStep === 0}
                    className="bg-gray-300 text-slate-200 px-3 py-1 rounded text-sm disabled:opacity-50"
                  >
                    ←
                  </button>
                  <button
                    onClick={nextTourStep}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    {currentStep < allSteps.length - 1 ? 'Next →' : '✅ Done'}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 w-full bg-white/10 rounded-full h-1.5">
              <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${((currentStep + 1) / allSteps.length) * 100}%` }}></div>
            </div>
          </div>
        )}

        {/* Manual Sections */}
        {filteredSections.map((section) => (
          <div key={section.id} className="glass rounded-xl mb-4 border border-white/10 overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full p-4 text-left flex justify-between items-center hover:bg-white/5 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{section.icon}</span>
                <div>
                  <h3 className="font-semibold text-sm">{section.title}</h3>
                  <p className="text-xs text-slate-400">{section.category} • {section.steps.length} steps</p>
                </div>
              </div>
              <span className={`text-xl transition-transform ${expandedSection === section.id ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>
            
            {expandedSection === section.id && (
              <div className="p-4 border-t border-white/10 animate-fadeIn">
                {section.steps.map((step, index) => (
                  <div key={index} className="flex gap-3 p-3 hover:bg-cyan-400/10 rounded-lg transition border-b last:border-0">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-cyan-300 rounded-full flex items-center justify-center font-bold text-sm">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{step.title}</h4>
                      <p className="text-xs text-slate-400">{step.description}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] bg-cyan-400/10 text-cyan-300 px-2 py-0.5 rounded">⚡ {step.action}</span>
                        <span className="text-[10px] bg-amber-400/10 text-yellow-600 px-2 py-0.5 rounded">💡 {step.tip}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        // Navigate to the feature
                        const featureMap: Record<string, string> = {
                          'Create Your Account': '/auth/signup',
                          'Set Up Your Profile': '/profile',
                          'Configure Your Pricing': '/pricing-config',
                          'Start Your First Lead': '/leads/new',
                          'Adding a New Lead': '/leads/new',
                          'Photo AI Estimation': '/photo-estimate',
                          'Xactimate-Style Pricing': '/pricing',
                          'Supplement Engine': '/supplement',
                          'Exterior Estimating': '/exterior',
                          'AI Photo Verification': '/photo-verify',
                          'AI Construction Wizard': '/ai-wizard',
                          'AI Upsell Engine': '/upsell',
                          'AI Training Center': '/ai-train',
                          'AR Pitch Gauge': '/pitch-gauge',
                          'Sketch Pad': '/sketch',
                          'Drone Integration': '/drone',
                          'Home Depot Direct': '/homedepot',
                          'Building Codes': '/codes',
                          'Insurance Intelligence': '/insurance-intel',
                          'Insurance Claims Directory': '/insurance',
                          'Dumpster Rentals': '/logistics',
                          'Porta John Rentals': '/logistics',
                          'Multi-Language Support': '/translate',
                          'Pricing Configuration': '/pricing-config',
                          'Profile Settings': '/profile'
                        }
                        const path = featureMap[step.title] || '/'
                        router.push(path)
                      }}
                      className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition"
                    >
                      Go →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-white/10 bg-[#070b14]/95 py-2 px-4 backdrop-blur lg:hidden">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/manual')} className="flex flex-col items-center text-cyan-300">
          <span className="text-xl">📖</span>
          <span className="text-xs">Manual</span>
        </button>
        <button onClick={() => router.push('/ai-train')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">🎓</span>
          <span className="text-xs">Train</span>
        </button>
        <button onClick={() => router.push('/help')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">❓</span>
          <span className="text-xs">Help</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-slate-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
