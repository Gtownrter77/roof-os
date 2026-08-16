'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PredictPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [prediction, setPrediction] = useState<any>(null)

  const predictFutureDamage = () => {
    setLoading(true)
    
    // Simulate complex AI prediction
    setTimeout(() => {
      setPrediction({
        roofLifeRemaining: '5-7 years',
        riskScore: 78,
        riskLevel: 'Moderate-High',
        nextMajorStorm: '18-24 months',
        vulnerabilityAreas: ['South slope', 'Chimney flashing', 'Gutter corners'],
        weatherPatterns: 'Increasing severe weather expected',
        recommendedActions: [
          'Replace flashing in 6 months',
          'Gutter reinforcement needed',
          'Consider impact-resistant shingles',
          'Schedule annual inspection'
        ],
        estimatedCosts: {
          immediate: '$1,200 - $1,800',
          nextYear: '$3,500 - $4,200',
          fiveYear: '$12,000 - $15,000'
        }
      })
      setLoading(false)
    }, 4000)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🧠 Predictive AI</h1>
          <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">BETA</span>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg shadow-lg p-4 mb-4 border border-purple-200">
          <div className="flex items-center">
            <span className="text-3xl mr-3">🧠</span>
            <div>
              <h3 className="font-semibold">AI Future Damage Predictor</h3>
              <p className="text-xs text-gray-500">Machine learning predicts future roof issues</p>
            </div>
          </div>
        </div>

        <button 
          onClick={predictFutureDamage}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? '⏳ Analyzing...' : '🔮 Predict Future Damage'}
        </button>

        {prediction && (
          <div className="mt-4 space-y-4 animate-fadeIn">
            <div className="bg-white rounded-lg shadow-lg p-4 border-2 border-purple-500">
              <h3 className="font-semibold text-sm mb-3">📊 Prediction Results</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Roof Life Remaining</p>
                  <p className="font-bold text-blue-600">{prediction.roofLifeRemaining}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Risk Score</p>
                  <p className={`font-bold ${prediction.riskScore > 70 ? 'text-red-600' : 'text-yellow-600'}`}>
                    {prediction.riskScore}/100
                  </p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Next Major Storm</p>
                  <p className="font-bold text-orange-600">{prediction.nextMajorStorm}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded">
                  <p className="text-xs text-gray-500">Risk Level</p>
                  <p className={`font-bold ${prediction.riskLevel.includes('High') ? 'text-red-600' : 'text-yellow-600'}`}>
                    {prediction.riskLevel}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-sm mb-2">⚠️ Vulnerable Areas</h3>
              <div className="flex flex-wrap gap-1">
                {prediction.vulnerabilityAreas.map((area: string, i: number) => (
                  <span key={i} className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                    {area}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">Weather patterns: {prediction.weatherPatterns}</p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4 border-l-4 border-green-500">
              <h3 className="font-semibold text-sm mb-2">✅ Recommended Actions</h3>
              <ul className="space-y-1">
                {prediction.recommendedActions.map((action: string, i: number) => (
                  <li key={i} className="text-sm flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4">
              <h3 className="font-semibold text-sm mb-2">💰 Cost Projections</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Immediate</span>
                  <span className="font-medium">{prediction.estimatedCosts.immediate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Next Year</span>
                  <span className="font-medium">{prediction.estimatedCosts.nextYear}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2 font-bold">
                  <span>5 Year Projection</span>
                  <span className="text-red-600">{prediction.estimatedCosts.fiveYear}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/predict')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🧠</span>
          <span className="text-xs">Predict</span>
        </button>
        <button onClick={() => router.push('/drone')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🚁</span>
          <span className="text-xs">Drone</span>
        </button>
        <button onClick={() => router.push('/supplement')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">Supplement</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
