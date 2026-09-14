'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function PhotoEstimatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [analysis, setAnalysis] = useState<any>(null)
  const [estimate, setEstimate] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const takePhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const newPhotos: string[] = []
      Array.from(files).forEach(file => {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            newPhotos.push(event.target.result as string)
            if (newPhotos.length === files.length) {
              setPhotos([...photos, ...newPhotos])
              analyzePhotos([...photos, ...newPhotos])
            }
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const analyzePhotos = (photoData: string[]) => {
    setLoading(true)
    
    // Prototype-only simulation. Never use these values for a customer quote.
    setTimeout(() => {
      // Simulated AI vision analysis
      const detected = {
        roof: {
          detected: true,
          material: ['Asphalt Shingle', 'Metal', 'Tile'][Math.floor(Math.random() * 3)],
          condition: ['Good', 'Fair', 'Poor', 'Needs Replacement'][Math.floor(Math.random() * 4)],
          estimatedArea: Math.floor(Math.random() * 1500) + 500,
          slope: `${Math.floor(Math.random() * 6) + 3}/12`,
          visibleDamage: Math.random() > 0.5 ? 'Hail damage detected' : 'Normal wear',
        },
        siding: {
          detected: Math.random() > 0.3,
          material: ['Vinyl', 'HardiePlank', 'Wood', 'Brick'][Math.floor(Math.random() * 4)],
          condition: ['Good', 'Fair', 'Poor'][Math.floor(Math.random() * 3)],
          estimatedArea: Math.floor(Math.random() * 800) + 200,
        },
        windows: {
          detected: Math.random() > 0.2,
          count: Math.floor(Math.random() * 10) + 2,
          type: ['Double Hung', 'Casement', 'Slider'][Math.floor(Math.random() * 3)],
          condition: ['Good', 'Fair', 'Poor'][Math.floor(Math.random() * 3)],
        },
        doors: {
          detected: Math.random() > 0.3,
          count: Math.floor(Math.random() * 3) + 1,
          type: ['Entry', 'French', 'Sliding'][Math.floor(Math.random() * 3)],
        },
        gutters: {
          detected: Math.random() > 0.4,
          condition: ['Good', 'Fair', 'Poor', 'Missing sections'][Math.floor(Math.random() * 4)],
          estimatedLength: Math.floor(Math.random() * 200) + 50,
        },
        deck: {
          detected: Math.random() > 0.5,
          material: ['Composite', 'Wood', 'PVC'][Math.floor(Math.random() * 3)],
          condition: ['Good', 'Fair', 'Poor'][Math.floor(Math.random() * 3)],
          estimatedSize: Math.floor(Math.random() * 400) + 100,
        },
        confidence: {
          roof: Math.floor(Math.random() * 30) + 70,
          siding: Math.floor(Math.random() * 30) + 60,
          windows: Math.floor(Math.random() * 30) + 65,
          doors: Math.floor(Math.random() * 30) + 60,
          gutters: Math.floor(Math.random() * 30) + 55,
          deck: Math.floor(Math.random() * 30) + 50,
        },
        recommendations: [
          'Schedule professional inspection for roof',
          'Consider replacing damaged shingles',
          'Clean gutters and downspouts',
          'Check for water damage around windows',
          'Inspect deck for structural integrity',
        ],
        estimatedTotal: Math.floor(Math.random() * 15000) + 5000,
        priority: ['Low', 'Medium', 'High', 'Urgent'][Math.floor(Math.random() * 4)],
      }
      
      setAnalysis(detected)
      generateEstimate(detected)
      setLoading(false)
    }, 3000)
  }

  const generateEstimate = (detected: any) => {
    const roofCost = detected.roof.estimatedArea * (detected.roof.material === 'Metal' ? 8 : 5)
    const sidingCost = detected.siding.detected ? detected.siding.estimatedArea * 6 : 0
    const windowsCost = detected.windows.detected ? detected.windows.count * 600 : 0
    const doorsCost = detected.doors.detected ? detected.doors.count * 800 : 0
    const guttersCost = detected.gutters.detected ? detected.gutters.estimatedLength * 12 : 0
    const deckCost = detected.deck.detected ? detected.deck.estimatedSize * 25 : 0
    
    const totalMaterials = roofCost + sidingCost + windowsCost + doorsCost + guttersCost + deckCost
    const labor = totalMaterials * 0.4
    const overhead = totalMaterials * 0.15
    const profit = (totalMaterials + labor + overhead) * 0.10
    const grandTotal = totalMaterials + labor + overhead + profit

    setEstimate({
      breakdown: [
        { item: 'Roof', cost: roofCost, detected: true },
        { item: 'Siding', cost: sidingCost, detected: detected.siding.detected },
        { item: 'Windows', cost: windowsCost, detected: detected.windows.detected },
        { item: 'Doors', cost: doorsCost, detected: detected.doors.detected },
        { item: 'Gutters', cost: guttersCost, detected: detected.gutters.detected },
        { item: 'Deck', cost: deckCost, detected: detected.deck.detected },
      ],
      totalMaterials,
      labor,
      overhead,
      profit,
      grandTotal,
      priority: detected.priority,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📸 Photo Estimate Prototype</h1>
          <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">SIMULATED</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-lg p-4 mb-4 border border-purple-200">
          <div className="flex items-center">
            <span className="text-3xl mr-3">📸</span>
            <div>
              <h3 className="font-semibold">AI Visual Estimation</h3>
              <p className="text-xs text-gray-500">Demo-only workflow — no quote or measurement is generated</p>
            </div>
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={handlePhotoUpload}
        />

        <button
          onClick={takePhoto}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? '⏳ AI Analyzing...' : '📸 Take Photo for Estimate'}
        </button>

        {photos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {photos.map((img, i) => (
              <img key={i} src={img} alt={`Photo ${i+1}`} className="w-full h-32 object-cover rounded" />
            ))}
          </div>
        )}

        {analysis && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-purple-500">
              <h3 className="font-semibold text-sm mb-3 flex items-center">
                <span className="text-xl mr-2">🧠</span> AI Analysis Results
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Roof</p>
                  <p className="font-bold text-sm">{analysis.roof.material} • {analysis.roof.condition}</p>
                  <p className="text-xs text-gray-400">{analysis.roof.estimatedArea} sq ft</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Siding</p>
                  <p className="font-bold text-sm">{analysis.siding.detected ? `${analysis.siding.material} • ${analysis.siding.condition}` : 'Not detected'}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Windows</p>
                  <p className="font-bold text-sm">{analysis.windows.detected ? `${analysis.windows.count} • ${analysis.windows.type}` : 'Not detected'}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Doors</p>
                  <p className="font-bold text-sm">{analysis.doors.detected ? `${analysis.doors.count} • ${analysis.doors.type}` : 'Not detected'}</p>
                </div>
              </div>
              <div className="mt-3 p-2 bg-yellow-50 rounded">
                <p className="text-xs text-yellow-800">📋 {analysis.recommendations[0]}</p>
              </div>
            </div>

            {estimate && (
              <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-green-500">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-sm">💰 Simulated Estimate Preview</h3>
                  <span className={`text-xs px-2 py-1 rounded ${
                    estimate.priority === 'Urgent' ? 'bg-red-500 text-white' :
                    estimate.priority === 'High' ? 'bg-orange-500 text-white' :
                    estimate.priority === 'Medium' ? 'bg-yellow-500 text-white' :
                    'bg-green-500 text-white'
                  }`}>
                    {estimate.priority} Priority
                  </span>
                </div>
                {estimate.breakdown.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm border-b py-1">
                    <span>{item.item} {!item.detected && '(estimated)'}</span>
                    <span>${item.cost.toFixed(2)}</span>
                  </div>
                ))}
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs text-amber-800 bg-amber-50 p-2 mb-2 rounded">Prototype values only. Do not send, approve, or use for pricing.</p>
                  <div className="flex justify-between text-sm">
                    <span>Materials</span>
                    <span>${estimate.totalMaterials.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Labor</span>
                    <span>${estimate.labor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Overhead</span>
                    <span>${estimate.overhead.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Profit</span>
                    <span>${estimate.profit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Grand Total</span>
                    <span className="text-green-600">${estimate.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button className="bg-purple-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Report
              </button>
              <button className="bg-pink-600 text-white py-2 rounded-lg text-sm font-semibold">
                ✉️ Send Estimate
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/photo-estimate')} className="flex flex-col items-center text-purple-600">
          <span className="text-xl">📸</span>
          <span className="text-xs">Photo AI</span>
        </button>
        <button onClick={() => router.push('/ai-wizard')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🧙</span>
          <span className="text-xs">Wizard</span>
        </button>
        <button onClick={() => router.push('/voice-ai')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🎤</span>
          <span className="text-xs">Voice</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
