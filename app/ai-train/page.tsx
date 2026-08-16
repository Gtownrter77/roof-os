'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AITrainPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [jobType, setJobType] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [currentPhase, setCurrentPhase] = useState('welcome')

  const jobTypes = [
    'Roof Replacement',
    'Siding Installation',
    'Window Installation',
    'Gutter Installation',
    'Inspection',
    'Damage Assessment',
    'Repair Estimate',
    'Full Exterior Renovation'
  ]

  const trainingGuides: Record<string, any> = {
    'Roof Replacement': {
      phases: [
        {
          id: 'welcome',
          title: '👋 Welcome to Roof Replacement Training',
          steps: [
            { id: 1, title: 'Safety First', description: 'Put on safety harness, hard hat, and non-slip boots.', image: '⛑️', tip: 'Always check weather conditions before starting.' },
            { id: 2, title: 'Equipment Check', description: 'Verify all tools and materials are on site.', image: '🔧', tip: 'Count all materials before starting.' },
            { id: 3, title: 'Site Setup', description: 'Set up ladders, scaffolding, and tarps.', image: '🏗️', tip: 'Protect landscaping with tarps.' },
          ]
        },
        {
          id: 'tear-off',
          title: '🔨 Tear-Off Phase',
          steps: [
            { id: 4, title: 'Remove Shingles', description: 'Start at the top and work down. Use a roofing shovel.', image: '🔨', tip: 'Work in small sections.' },
            { id: 5, title: 'Remove Underlayment', description: 'Pull up all underlayment and inspect decking.', image: '📋', tip: 'Look for signs of water damage.' },
            { id: 6, title: 'Inspect Decking', description: 'Replace any rotted or damaged decking.', image: '🔍', tip: 'Use a screwdriver to test for soft spots.' },
          ]
        },
        {
          id: 'install',
          title: '🏠 Installation Phase',
          steps: [
            { id: 7, title: 'Install Drip Edge', description: 'Install drip edge along all edges.', image: '🔧', tip: 'Overlap sections by 2 inches.' },
            { id: 8, title: 'Install Underlayment', description: 'Roll out synthetic underlayment from bottom to top.', image: '📐', tip: 'Overlap by 6 inches minimum.' },
            { id: 9, title: 'Install Starter Shingles', description: 'Place starter strips at all eaves.', image: '📐', tip: 'Check for straight lines.' },
            { id: 10, title: 'Install Shingles', description: 'Begin at bottom left, work up and across.', image: '📐', tip: 'Use chalk lines for straight rows.' },
          ]
        },
        {
          id: 'finish',
          title: '✅ Finish & Cleanup',
          steps: [
            { id: 11, title: 'Install Ridge Cap', description: 'Install ridge cap shingles at the peak.', image: '🔧', tip: 'Use ridge vent if specified.' },
            { id: 12, title: 'Clean Up', description: 'Remove all debris, nails, and excess materials.', image: '🧹', tip: 'Use magnets to find stray nails.' },
            { id: 13, title: 'Final Inspection', description: 'Walk the entire roof, check for issues.', image: '✅', tip: 'Take photos for documentation.' },
          ]
        }
      ]
    },
    'Inspection': {
      phases: [
        {
          id: 'welcome',
          title: '🔍 Inspection Training',
          steps: [
            { id: 1, title: 'Safety Prep', description: 'Wear proper PPE, use secure ladder', image: '⛑️', tip: 'Never inspect alone.' },
            { id: 2, title: 'Exterior Walk', description: 'Walk perimeter looking for damage.', image: '🚶', tip: 'Take photos of everything.' },
            { id: 3, title: 'Roof Inspection', description: 'Examine shingles, flashing, valleys.', image: '🔍', tip: 'Check for missing or damaged shingles.' },
          ]
        },
        {
          id: 'detailed',
          title: '📋 Detailed Inspection',
          steps: [
            { id: 4, title: 'Chimney Check', description: 'Inspect flashing, mortar, cap.', image: '🏭', tip: 'Look for cracks or separation.' },
            { id: 5, title: 'Gutter Inspection', description: 'Check for clogs, damage, proper flow.', image: '🌧️', tip: 'Run water to test flow.' },
            { id: 6, title: 'Interior Check', description: 'Inspect ceilings, attic, walls.', image: '🏠', tip: 'Look for water stains.' },
          ]
        },
        {
          id: 'report',
          title: '📄 Report Phase',
          steps: [
            { id: 7, title: 'Document Findings', description: 'Write detailed inspection report.', image: '📝', tip: 'Include photos and measurements.' },
            { id: 8, title: 'Recommendations', description: 'List recommended repairs.', image: '✅', tip: 'Prioritize urgent issues.' },
            { id: 9, title: 'Submit Report', description: 'Send report to client and insurance.', image: '📤', tip: 'Get client acknowledgment.' },
          ]
        }
      ]
    },
    'Damage Assessment': {
      phases: [
        {
          id: 'welcome',
          title: '🌪️ Damage Assessment Training',
          steps: [
            { id: 1, title: 'Safety First', description: 'Assess dangers before approaching.', image: '⛑️', tip: 'Watch for downed power lines.' },
            { id: 2, title: 'Exterior Assessment', description: 'Walk perimeter, document damage.', image: '📸', tip: 'Take 360-degree video.' },
            { id: 3, title: 'Roof Assessment', description: 'Check for impact damage, missing materials.', image: '🔍', tip: 'Look for granule loss.' },
          ]
        },
        {
          id: 'detailed-damage',
          title: '📋 Detailed Damage Report',
          steps: [
            { id: 4, title: 'Photo Documentation', description: 'Take photos of ALL damage.', image: '📸', tip: 'Use the Photo Verify tool.' },
            { id: 5, title: 'Measure Damage', description: 'Measure affected areas.', image: '📐', tip: 'Use the Pitch Gauge.' },
            { id: 6, title: 'Estimate Repairs', description: 'Generate repair estimate.', image: '💰', tip: 'Use the Repair Engine.' },
          ]
        },
        {
          id: 'insurance',
          title: '📄 Insurance Phase',
          steps: [
            { id: 7, title: 'Prepare Claim', description: 'Compile all documentation.', image: '📋', tip: 'Use the Insurance Directory.' },
            { id: 8, title: 'Submit Claim', description: 'Submit to insurance company.', image: '📤', tip: 'Get claim number.' },
            { id: 9, title: 'Follow Up', description: 'Track claim status.', image: '📞', tip: 'Follow up weekly.' },
          ]
        }
      ]
    },
    'Siding Installation': {
      phases: [
        {
          id: 'welcome',
          title: '🏠 Siding Installation Training',
          steps: [
            { id: 1, title: 'Material Prep', description: 'Check siding, trim, accessories.', image: '📦', tip: 'Acclimate materials for 24 hours.' },
            { id: 2, title: 'Wall Prep', description: 'Remove old siding, repair sheathing.', image: '🔧', tip: 'Look for rot or damage.' },
            { id: 3, title: 'Install Weather Barrier', description: 'Install house wrap.', image: '📋', tip: 'Overlap seams by 6 inches.' },
          ]
        },
        {
          id: 'install-siding',
          title: '🔨 Installation Phase',
          steps: [
            { id: 4, title: 'Install Trim', description: 'Install window and door trim.', image: '🔧', tip: 'Check for level and plumb.' },
            { id: 5, title: 'Install Starter Strip', description: 'Install at bottom of walls.', image: '📐', tip: 'Keep it level.' },
            { id: 6, title: 'Install Siding Panels', description: 'Install panels from bottom up.', image: '📐', tip: 'Stagger joints for visual appeal.' },
          ]
        },
        {
          id: 'finish-siding',
          title: '✅ Finish & Cleanup',
          steps: [
            { id: 7, title: 'Install Corner Posts', description: 'Install at all outside corners.', image: '🔧', tip: 'Ensure proper overlap.' },
            { id: 8, title: 'Install J-Channel', description: 'Install around windows and doors.', image: '🔧', tip: 'Leave gap for expansion.' },
            { id: 9, title: 'Final Cleanup', description: 'Remove debris, clean siding.', image: '🧹', tip: 'Wash with mild detergent.' },
          ]
        }
      ]
    },
    'Gutter Installation': {
      phases: [
        {
          id: 'welcome',
          title: '🌧️ Gutter Installation Training',
          steps: [
            { id: 1, title: 'Material Check', description: 'Check gutters, downspouts, hangers.', image: '📦', tip: 'Verify color matches.' },
            { id: 2, title: 'Layout', description: 'Mark where gutters will hang.', image: '📐', tip: 'Plan for 1/4" slope per 10ft.' },
            { id: 3, title: 'Install Hangers', description: 'Install hangers every 2 feet.', image: '🔧', tip: 'Use proper fasteners.' },
          ]
        },
        {
          id: 'install-gutters',
          title: '🔨 Installation Phase',
          steps: [
            { id: 4, title: 'Attach Gutters', description: 'Snap gutters into hangers.', image: '🔧', tip: 'Work from downspout outward.' },
            { id: 5, title: 'Install Downspouts', description: 'Install downspouts at marked locations.', image: '📐', tip: 'Fasten securely to wall.' },
            { id: 6, title: 'Add Elbows', description: 'Install elbows and extensions.', image: '🔧', tip: 'Direct water away from foundation.' },
          ]
        },
        {
          id: 'finish-gutters',
          title: '✅ Finish & Test',
          steps: [
            { id: 7, title: 'Test Flow', description: 'Run water through system.', image: '💧', tip: 'Check for leaks.' },
            { id: 8, title: 'Clean Up', description: 'Remove debris and test.', image: '🧹', tip: 'Leave area clean.' },
            { id: 9, title: 'Final Inspection', description: 'Document complete installation.', image: '✅', tip: 'Take after photos.' },
          ]
        }
      ]
    }
  }

  const startTraining = () => {
    if (!jobType) {
      alert('Please select a job type')
      return
    }
    setShowGuide(true)
    setCurrentStep(0)
    setCompletedSteps([])
    setCurrentPhase('welcome')
  }

  const nextStep = () => {
    const guide = trainingGuides[jobType]
    if (!guide) return
    
    const allSteps = guide.phases.flatMap((p: any) => p.steps)
    if (currentStep < allSteps.length - 1) {
      setCurrentStep(currentStep + 1)
      setCompletedSteps([...completedSteps, currentStep])
      
      // Check if we need to switch phases
      let stepCount = 0
      for (const phase of guide.phases) {
        if (currentStep + 1 >= stepCount + phase.steps.length) {
          stepCount += phase.steps.length
        } else {
          setCurrentPhase(phase.id)
          break
        }
      }
    } else {
      alert('🎉 Training Complete! You are now ready for the job!')
      setShowGuide(false)
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const getCurrentStepData = () => {
    const guide = trainingGuides[jobType]
    if (!guide) return null
    
    const allSteps = guide.phases.flatMap((p: any) => p.steps)
    return allSteps[currentStep] || null
  }

  const getCurrentPhase = () => {
    const guide = trainingGuides[jobType]
    if (!guide) return null
    
    let stepCount = 0
    for (const phase of guide.phases) {
      if (currentStep < stepCount + phase.steps.length) {
        return phase
      }
      stepCount += phase.steps.length
    }
    return guide.phases[guide.phases.length - 1]
  }

  const getProgress = () => {
    const guide = trainingGuides[jobType]
    if (!guide) return 0
    
    const allSteps = guide.phases.flatMap((p: any) => p.steps)
    return Math.round(((currentStep + 1) / allSteps.length) * 100)
  }

  const stepData = getCurrentStepData()
  const currentPhaseData = getCurrentPhase()

  if (showGuide && stepData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white pb-20">
        <header className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={() => setShowGuide(false)} className="text-white mr-3 text-xl">←</button>
              <h1 className="text-xl font-bold">🎓 Training Mode</h1>
            </div>
            <span className="bg-yellow-500 text-black text-xs px-2 py-1 rounded font-bold">{getProgress()}%</span>
          </div>
        </header>

        <main className="p-4">
          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2.5 mb-4">
            <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${getProgress()}%` }}></div>
          </div>

          {/* Phase Indicator */}
          {currentPhaseData && (
            <div className="bg-gray-800 rounded-lg p-3 mb-4 border border-gray-700">
              <p className="text-xs text-gray-400">Phase</p>
              <p className="font-semibold">{currentPhaseData.title}</p>
            </div>
          )}

          {/* Step Card */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 mb-4 border border-gray-700">
            <div className="text-center mb-4">
              <span className="text-6xl block mb-2">{stepData.image}</span>
              <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full">Step {currentStep + 1}</span>
            </div>
            
            <h2 className="text-xl font-bold text-center mb-2">{stepData.title}</h2>
            <p className="text-gray-300 text-center mb-4">{stepData.description}</p>
            
            <div className="bg-yellow-900/30 border border-yellow-800 rounded-lg p-3">
              <p className="text-xs text-yellow-400 flex items-start">
                <span className="text-lg mr-2">💡</span>
                {stepData.tip}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`flex-1 py-3 rounded-lg font-semibold ${
                currentStep === 0 ? 'bg-gray-700 text-gray-500' : 'bg-gray-700 text-white'
              }`}
            >
              ← Back
            </button>
            <button
              onClick={nextStep}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold"
            >
              {currentStep < (trainingGuides[jobType]?.phases.flatMap((p: any) => p.steps).length || 0) - 1 ? 'Next →' : '✅ Complete'}
            </button>
          </div>

          {/* Quick Access */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button className="bg-gray-800 p-2 rounded text-center text-xs hover:bg-gray-700">📸 Photo Guide</button>
            <button className="bg-gray-800 p-2 rounded text-center text-xs hover:bg-gray-700">📋 Checklist</button>
            <button className="bg-gray-800 p-2 rounded text-center text-xs hover:bg-gray-700">🆘 Help</button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🎓 AI Training Center</h1>
          <span className="ml-2 bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">NEW</span>
        </div>
      </header>

      <main className="p-4">
        {/* Welcome */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg shadow-lg p-6 mb-4 border-2 border-green-500">
          <div className="text-center">
            <span className="text-6xl block mb-3">🎓</span>
            <h2 className="text-2xl font-bold text-green-800">AI Training Guide</h2>
            <p className="text-green-600 text-sm">Step-by-step hand-holding for every job</p>
          </div>
        </div>

        {/* Job Selection */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-gray-200">
          <h3 className="font-semibold text-sm mb-3">Select Job Type</h3>
          <div className="grid grid-cols-2 gap-2">
            {jobTypes.map((type) => (
              <button
                key={type}
                onClick={() => setJobType(type)}
                className={`p-3 rounded-lg text-sm font-medium text-left transition ${
                  jobType === type
                    ? 'bg-green-100 border-2 border-green-500 text-green-800'
                    : 'bg-gray-50 border-2 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={startTraining}
          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 rounded-lg font-semibold text-lg"
        >
          🚀 Start Training
        </button>

        {/* Quick Tips */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-sm text-blue-800 mb-2">💡 Quick Tips</h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Follow each step in order</li>
            <li>• Use the Photo Verify tool for documentation</li>
            <li>• Ask the AI Wizard for help</li>
            <li>• Take before and after photos</li>
          </ul>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/ai-train')} className="flex flex-col items-center text-green-600">
          <span className="text-xl">🎓</span>
          <span className="text-xs">Train</span>
        </button>
        <button onClick={() => router.push('/pitch-gauge')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📐</span>
          <span className="text-xs">Pitch</span>
        </button>
        <button onClick={() => router.push('/photo-verify')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📸</span>
          <span className="text-xs">Verify</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
