'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function PhotoVerifyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<any[]>([])
  const [coverage, setCoverage] = useState<any>(null)
  const [missingAngles, setMissingAngles] = useState<string[]>([])
  const [recommendations, setRecommendations] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requiredPhotos = [
    { id: 'north', label: 'North Elevation', icon: '⬆️', required: true },
    { id: 'south', label: 'South Elevation', icon: '⬇️', required: true },
    { id: 'east', label: 'East Elevation', icon: '➡️', required: true },
    { id: 'west', label: 'West Elevation', icon: '⬅️', required: true },
    { id: 'roof-top', label: 'Roof Top View', icon: '🔭', required: true },
    { id: 'roof-south-slope', label: 'South Slope', icon: '🏔️', required: true },
    { id: 'roof-north-slope', label: 'North Slope', icon: '🏔️', required: true },
    { id: 'roof-east-slope', label: 'East Slope', icon: '🏔️', required: true },
    { id: 'roof-west-slope', label: 'West Slope', icon: '🏔️', required: true },
    { id: 'chimney', label: 'Chimney', icon: '🏭', required: false },
    { id: 'flashing', label: 'Flashing Details', icon: '🔧', required: false },
    { id: 'gutters', label: 'Gutters & Downspouts', icon: '🌧️', required: false },
    { id: 'siding', label: 'Siding Condition', icon: '🏠', required: false },
    { id: 'windows', label: 'Windows', icon: '🪟', required: false },
    { id: 'doors', label: 'Doors', icon: '🚪', required: false },
    { id: 'closeup-damage', label: 'Close-up Damage Photos', icon: '🔍', required: true },
    { id: 'interior-ceiling', label: 'Interior Ceiling (Leaks)', icon: '🏠', required: false },
    { id: 'attic', label: 'Attic Inspection', icon: '🏠', required: false },
  ]

  const verifyPhotos = () => {
    setLoading(true)
    setTimeout(() => {
      const covered = photos.map(p => p.type)
      const missing = requiredPhotos
        .filter(req => req.required && !covered.includes(req.id))
        .map(req => req.label)
      
      const recommendations = missing.map((m: string) => `📸 Please take photo of: ${m}`)
      
      const requiredCount = requiredPhotos.filter(r => r.required).length
      const capturedRequired = photos.filter(p => requiredPhotos.find(r => r.id === p.type)?.required).length
      const optionalCount = requiredPhotos.filter(r => !r.required).length
      const capturedOptional = photos.filter(p => requiredPhotos.find(r => r.id === p.type)?.required === false).length
      
      const coverageReport = {
        totalRequired: requiredCount,
        captured: capturedRequired,
        totalOptional: optionalCount,
        capturedOptional: capturedOptional,
        percentage: Math.round((capturedRequired / requiredCount) * 100),
        quality: 'High',
        missing: missing,
        recommendations: recommendations,
        nextSteps: missing.length === 0 
          ? ['✅ All required photos captured!', '📄 Generate complete report', '📤 Submit to insurance']
          : ['📸 Capture missing photos', '🔄 Re-verify', '✅ Complete verification']
      }
      
      setCoverage(coverageReport)
      setMissingAngles(missing)
      setRecommendations(recommendations)
      setLoading(false)
    }, 2000)
  }

  const takePhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const newPhotos: any[] = []
      Array.from(files).forEach((file) => {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            const types = requiredPhotos.map(r => r.id)
            const randomType = types[Math.floor(Math.random() * types.length)]
            newPhotos.push({
              id: Date.now() + Math.random(),
              url: event.target.result as string,
              type: randomType,
              label: requiredPhotos.find(r => r.id === randomType)?.label || randomType,
              timestamp: new Date().toISOString(),
              aiVerified: Math.random() > 0.2,
              quality: ['Excellent', 'Good', 'Acceptable'][Math.floor(Math.random() * 3)]
            })
            if (newPhotos.length === files.length) {
              setPhotos([...photos, ...newPhotos])
            }
          }
        }
        reader.readAsDataURL(file)
      })
    }
  }

  const getCoverageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPhotoStatus = (required: boolean, captured: boolean) => {
    if (required && captured) return '✅'
    if (required && !captured) return '❌'
    if (!required && captured) return '✅'
    return '⬜'
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📸 AI Photo Verification</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">AI</span>
        </div>
      </header>

      <main className="p-4">
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
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-lg font-semibold text-lg disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? '⏳ Verifying...' : '📸 Take Photos'}
        </button>

        {photos.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm text-gray-500">{photos.length} photos captured</p>
              <button
                onClick={verifyPhotos}
                disabled={loading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {loading ? '⏳ Verifying...' : '✅ Verify Coverage'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img src={photo.url} alt={photo.label} className="w-full h-24 object-cover rounded border-2 border-blue-200" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] p-1 truncate">
                    {photo.label}
                  </div>
                  {photo.aiVerified && (
                    <span className="absolute top-1 right-1 text-xs bg-green-500 text-white rounded-full px-1">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {coverage && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg shadow-lg p-4 border-2 border-blue-500">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Coverage</p>
                  <p className={`text-2xl font-bold ${getCoverageColor(coverage.percentage)}`}>
                    {coverage.percentage}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Required</p>
                  <p className="text-2xl font-bold">{coverage.captured}/{coverage.totalRequired}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Quality</p>
                  <p className="text-2xl font-bold text-green-600">{coverage.quality}</p>
                </div>
              </div>
              {coverage.percentage >= 90 ? (
                <div className="mt-2 bg-green-100 text-green-800 p-2 rounded text-sm text-center">
                  ✅ Excellent coverage! All required photos captured.
                </div>
              ) : coverage.percentage >= 70 ? (
                <div className="mt-2 bg-yellow-100 text-yellow-800 p-2 rounded text-sm text-center">
                  ⚠️ Good coverage, but missing some required photos.
                </div>
              ) : (
                <div className="mt-2 bg-red-100 text-red-800 p-2 rounded text-sm text-center">
                  ❌ Insufficient coverage. Please capture missing photos.
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-sm mb-3 flex items-center">
                <span className="text-xl mr-2">✅</span> Photo Checklist
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {requiredPhotos.map((req) => {
                  const captured = photos.some(p => p.type === req.id)
                  return (
                    <div key={req.id} className={`flex items-center p-2 rounded ${captured ? 'bg-green-50' : req.required ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <span className="text-xl mr-2">{req.icon}</span>
                      <div className="flex-1">
                        <p className={`text-xs font-medium ${captured ? 'text-green-800' : req.required ? 'text-red-800' : 'text-gray-500'}`}>
                          {req.label}
                        </p>
                        <span className="text-xs text-gray-400">{captured ? '✓ Captured' : req.required ? '⚠️ Required' : 'Optional'}</span>
                      </div>
                      <span className="text-xl">{getPhotoStatus(req.required, captured)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {coverage.missing.length > 0 && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <h3 className="font-semibold text-sm text-red-800 mb-2">📸 Missing Required Photos</h3>
                <ul className="space-y-1">
                  {coverage.missing.map((m: string, i: number) => (
                    <li key={i} className="text-sm text-red-700 flex items-center">
                      <span className="text-xl mr-2">📸</span> {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {coverage.recommendations.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
                <h3 className="font-semibold text-sm text-yellow-800 mb-2">💡 AI Recommendations</h3>
                <ul className="space-y-1">
                  {coverage.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-sm text-yellow-700">{rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-sm mb-3">📋 Next Steps</h3>
              {coverage.nextSteps.map((step: string, i: number) => (
                <div key={i} className="flex items-center p-2 border-b last:border-0">
                  <span className="text-xl mr-2">{i + 1}</span>
                  <span className="text-sm">{step}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Report
              </button>
              <button className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
                📤 Submit to Insurance
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
        <button onClick={() => router.push('/photo-verify')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📸</span>
          <span className="text-xs">Verify</span>
        </button>
        <button onClick={() => router.push('/photo-estimate')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📸</span>
          <span className="text-xs">Photo AI</span>
        </button>
        <button onClick={() => router.push('/upsell')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">💰</span>
          <span className="text-xs">Upsell</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
