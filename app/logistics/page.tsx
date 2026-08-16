'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LogisticsPage() {
  const router = useRouter()
  const [zipCode, setZipCode] = useState('')
  const [jobSize, setJobSize] = useState('medium')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [selectedDumpster, setSelectedDumpster] = useState<any>(null)
  const [selectedPortaJohn, setSelectedPortaJohn] = useState<any>(null)
  const [orderTotal, setOrderTotal] = useState(0)

  // Dumpster rental database with pricing and capacity
  const dumpsterProviders = [
    {
      id: 1,
      name: 'Waste Management',
      phone: '1-800-866-4646',
      website: 'wm.com',
      rating: 4.5,
      distance: '1.2 miles',
      dumpsters: [
        { 
          size: '10 Yard', 
          price: 295, 
          rentalPeriod: '7 days', 
          capacity: '10 cubic yards',
          weightLimit: '2,000 lbs',
          handles: '3-4 rooms of debris',
          roofShingles: '8-10 squares',
          demo: 'Small bathroom or deck',
          recommended: false,
          rubberWheels: true,
          dimensions: '12ft x 8ft x 4ft'
        },
        { 
          size: '15 Yard', 
          price: 375, 
          rentalPeriod: '7 days', 
          capacity: '15 cubic yards',
          weightLimit: '3,000 lbs',
          handles: '5-6 rooms of debris',
          roofShingles: '12-15 squares',
          demo: 'Medium kitchen or small addition',
          recommended: true,
          rubberWheels: true,
          dimensions: '14ft x 8ft x 5ft'
        },
        { 
          size: '20 Yard', 
          price: 445, 
          rentalPeriod: '7 days', 
          capacity: '20 cubic yards',
          weightLimit: '4,000 lbs',
          handles: '7-8 rooms of debris',
          roofShingles: '16-20 squares',
          demo: 'Large kitchen or full room',
          recommended: false,
          rubberWheels: true,
          dimensions: '16ft x 8ft x 6ft'
        },
        { 
          size: '30 Yard', 
          price: 565, 
          rentalPeriod: '7 days', 
          capacity: '30 cubic yards',
          weightLimit: '6,000 lbs',
          handles: '10-12 rooms of debris',
          roofShingles: '25-30 squares',
          demo: 'Full house or addition',
          recommended: false,
          rubberWheels: false,
          dimensions: '20ft x 8ft x 7ft'
        },
        { 
          size: '40 Yard', 
          price: 695, 
          rentalPeriod: '7 days', 
          capacity: '40 cubic yards',
          weightLimit: '8,000 lbs',
          handles: '15-20 rooms of debris',
          roofShingles: '35-40 squares',
          demo: 'Commercial or full house',
          recommended: false,
          rubberWheels: false,
          dimensions: '22ft x 8ft x 8ft'
        },
      ]
    },
    {
      id: 2,
      name: 'Republic Services',
      phone: '1-800-464-3465',
      website: 'republicservices.com',
      rating: 4.3,
      distance: '2.5 miles',
      dumpsters: [
        { 
          size: '10 Yard', 
          price: 285, 
          rentalPeriod: '7 days', 
          capacity: '10 cubic yards',
          weightLimit: '2,000 lbs',
          handles: '3-4 rooms',
          roofShingles: '8-10 squares',
          demo: 'Small bathroom',
          recommended: false,
          rubberWheels: true,
          dimensions: '12ft x 8ft x 4ft'
        },
        { 
          size: '20 Yard', 
          price: 425, 
          rentalPeriod: '7 days', 
          capacity: '20 cubic yards',
          weightLimit: '4,000 lbs',
          handles: '7-8 rooms',
          roofShingles: '16-20 squares',
          demo: 'Kitchen or addition',
          recommended: true,
          rubberWheels: true,
          dimensions: '16ft x 8ft x 6ft'
        },
        { 
          size: '30 Yard', 
          price: 545, 
          rentalPeriod: '7 days', 
          capacity: '30 cubic yards',
          weightLimit: '6,000 lbs',
          handles: '10-12 rooms',
          roofShingles: '25-30 squares',
          demo: 'Full house',
          recommended: false,
          rubberWheels: false,
          dimensions: '20ft x 8ft x 7ft'
        },
      ]
    },
    {
      id: 3,
      name: 'Budget Dumpster',
      phone: '1-888-678-6464',
      website: 'budgetdumpster.com',
      rating: 4.7,
      distance: '3.1 miles',
      dumpsters: [
        { 
          size: '12 Yard', 
          price: 315, 
          rentalPeriod: '7 days', 
          capacity: '12 cubic yards',
          weightLimit: '2,500 lbs',
          handles: '4-5 rooms',
          roofShingles: '10-12 squares',
          demo: 'Medium bathroom',
          recommended: false,
          rubberWheels: true,
          dimensions: '13ft x 8ft x 4.5ft'
        },
        { 
          size: '18 Yard', 
          price: 395, 
          rentalPeriod: '7 days', 
          capacity: '18 cubic yards',
          weightLimit: '3,500 lbs',
          handles: '6-7 rooms',
          roofShingles: '14-18 squares',
          demo: 'Large kitchen',
          recommended: true,
          rubberWheels: true,
          dimensions: '15ft x 8ft x 5.5ft'
        },
        { 
          size: '25 Yard', 
          price: 495, 
          rentalPeriod: '7 days', 
          capacity: '25 cubic yards',
          weightLimit: '5,000 lbs',
          handles: '8-10 rooms',
          roofShingles: '20-25 squares',
          demo: 'Full addition',
          recommended: false,
          rubberWheels: false,
          dimensions: '18ft x 8ft x 6.5ft'
        },
      ]
    }
  ]

  // Porta John rental database
  const portaJohnProviders = [
    {
      id: 1,
      name: 'United Site Services',
      phone: '1-800-843-1254',
      website: 'unitedsiteservices.com',
      rating: 4.4,
      distance: '1.5 miles',
      units: [
        { 
          type: 'Standard', 
          price: 125, 
          rentalPeriod: '7 days', 
          capacity: '50 uses/day',
          includes: ['Hand sanitizer', 'Toilet paper', 'Deodorizer'],
          recommended: false,
          size: '3ft x 3ft x 7ft'
        },
        { 
          type: 'Deluxe', 
          price: 175, 
          rentalPeriod: '7 days', 
          capacity: '75 uses/day',
          includes: ['Hand sanitizer', 'Toilet paper', 'Deodorizer', 'Hand washing station', 'Mirror'],
          recommended: true,
          size: '4ft x 4ft x 7ft'
        },
        { 
          type: 'ADA Accessible', 
          price: 225, 
          rentalPeriod: '7 days', 
          capacity: '50 uses/day',
          includes: ['Hand sanitizer', 'Toilet paper', 'Deodorizer', 'Wheelchair accessible', 'Grab bars'],
          recommended: false,
          size: '5ft x 5ft x 7ft'
        },
        { 
          type: 'Luxury Trailer', 
          price: 450, 
          rentalPeriod: '7 days', 
          capacity: '100 uses/day',
          includes: ['Running water', 'Flush toilet', 'Sink', 'Mirror', 'Lighting', 'Climate control'],
          recommended: false,
          size: '8ft x 8ft x 10ft'
        },
      ]
    },
    {
      id: 2,
      name: 'Porta Potty Direct',
      phone: '1-888-767-6829',
      website: 'portapottydirect.com',
      rating: 4.2,
      distance: '2.8 miles',
      units: [
        { 
          type: 'Standard', 
          price: 115, 
          rentalPeriod: '7 days', 
          capacity: '50 uses/day',
          includes: ['Hand sanitizer', 'Toilet paper'],
          recommended: true,
          size: '3ft x 3ft x 7ft'
        },
        { 
          type: 'Deluxe', 
          price: 165, 
          rentalPeriod: '7 days', 
          capacity: '75 uses/day',
          includes: ['Hand sanitizer', 'Toilet paper', 'Hand washing station'],
          recommended: false,
          size: '4ft x 4ft x 7ft'
        },
        { 
          type: 'ADA Accessible', 
          price: 210, 
          rentalPeriod: '7 days', 
          capacity: '50 uses/day',
          includes: ['Hand sanitizer', 'Toilet paper', 'Wheelchair accessible'],
          recommended: false,
          size: '5ft x 5ft x 7ft'
        },
      ]
    }
  ]

  const searchLogistics = () => {
    setLoading(true)
    setTimeout(() => {
      setResults({
        dumpsters: dumpsterProviders,
        portaJohns: portaJohnProviders,
        recommendations: {
          dumpster: dumpsterProviders[0].dumpsters.find(d => d.recommended) || dumpsterProviders[0].dumpsters[0],
          portaJohn: portaJohnProviders[0].units.find(u => u.recommended) || portaJohnProviders[0].units[0],
        }
      })
      setLoading(false)
    }, 1000)
  }

  const selectDumpster = (provider: any, dumpster: any) => {
    setSelectedDumpster({ provider, dumpster })
    updateTotal({ provider, dumpster }, selectedPortaJohn)
  }

  const selectPortaJohn = (provider: any, unit: any) => {
    setSelectedPortaJohn({ provider, unit })
    updateTotal(selectedDumpster, { provider, unit })
  }

  const updateTotal = (dumpster: any, portaJohn: any) => {
    let total = 0
    if (dumpster) total += dumpster.dumpster.price
    if (portaJohn) total += portaJohn.unit.price
    setOrderTotal(total)
  }

  const orderNow = () => {
    if (!selectedDumpster && !selectedPortaJohn) {
      alert('Please select at least one item')
      return
    }
    
    let message = '✅ Order placed successfully!\n\n'
    if (selectedDumpster) {
      message += `📦 Dumpster: ${selectedDumpster.dumpster.size} from ${selectedDumpster.provider.name}\n`
      message += `   Price: $${selectedDumpster.dumpster.price}\n`
      message += `   Capacity: ${selectedDumpster.dumpster.capacity}\n`
      message += `   Weight Limit: ${selectedDumpster.dumpster.weightLimit}\n`
      message += `   Rubber Wheels: ${selectedDumpster.dumpster.rubberWheels ? '✅ Yes' : '❌ No'}\n\n`
    }
    if (selectedPortaJohn) {
      message += `🚽 Porta John: ${selectedPortaJohn.unit.type} from ${selectedPortaJohn.provider.name}\n`
      message += `   Price: $${selectedPortaJohn.unit.price}\n`
      message += `   Capacity: ${selectedPortaJohn.unit.capacity}\n`
      message += `   Includes: ${selectedPortaJohn.unit.includes.join(', ')}\n\n`
    }
    message += `💰 Total: $${orderTotal}\n`
    message += `📞 Providers will contact you within 24 hours.`
    
    alert(message)
    setSelectedDumpster(null)
    setSelectedPortaJohn(null)
    setOrderTotal(0)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">🚛 Job Site Logistics</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
      </header>

      <main className="p-4">
        {/* Search */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <div className="flex gap-2">
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              placeholder="Enter ZIP code..."
              className="flex-1 p-2 border rounded-lg text-sm"
            />
            <select
              value={jobSize}
              onChange={(e) => setJobSize(e.target.value)}
              className="p-2 border rounded-lg text-sm"
            >
              <option value="small">Small Job</option>
              <option value="medium">Medium Job</option>
              <option value="large">Large Job</option>
            </select>
            <button
              onClick={searchLogistics}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {loading ? '⏳' : '🔍 Search'}
            </button>
          </div>
        </div>

        {results && (
          <div className="space-y-4 animate-fadeIn">
            {/* Dumpster Rentals */}
            <div className="bg-white rounded-lg shadow-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">📦</span> Dumpster Rentals
                </h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Rubber Wheel Preferred</span>
              </div>

              {/* Provider 1 */}
              {results.dumpsters.map((provider: any) => (
                <div key={provider.id} className="mb-4 last:mb-0">
                  <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <div>
                      <p className="font-medium text-sm">{provider.name}</p>
                      <p className="text-xs text-gray-500">📞 {provider.phone} • ⭐ {provider.rating}</p>
                    </div>
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{provider.distance}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {provider.dumpsters.map((dumpster: any) => (
                      <div 
                        key={dumpster.size}
                        onClick={() => selectDumpster(provider, dumpster)}
                        className={`border-2 rounded-lg p-3 cursor-pointer transition ${
                          selectedDumpster?.dumpster.size === dumpster.size && selectedDumpster?.provider.id === provider.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{dumpster.size}</span>
                              {dumpster.rubberWheels && (
                                <span className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0.5 rounded">
                                  ✅ Rubber Wheels
                                </span>
                              )}
                              {dumpster.recommended && (
                                <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded">
                                  ★ Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">📐 {dumpster.dimensions}</p>
                            <p className="text-xs text-gray-500">⏱️ {dumpster.rentalPeriod}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-blue-600">${dumpster.price}</p>
                            <p className="text-xs text-gray-400">{dumpster.capacity}</p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                          <p>📦 Handles: {dumpster.handles}</p>
                          <p>🏠 Roof Shingles: {dumpster.roofShingles}</p>
                          <p>🏗️ Demo: {dumpster.demo}</p>
                          <p className="text-gray-400">⚖️ Weight Limit: {dumpster.weightLimit}</p>
                        </div>
                        {selectedDumpster?.dumpster.size === dumpster.size && selectedDumpster?.provider.id === provider.id && (
                          <div className="mt-2 text-xs text-green-600 font-semibold">✓ Selected</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Porta John Rentals */}
            <div className="bg-white rounded-lg shadow-lg p-4 border border-green-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center">
                  <span className="text-xl mr-2">🚽</span> Porta John Rentals
                </h3>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Sanitary</span>
              </div>

              {results.portaJohns.map((provider: any) => (
                <div key={provider.id} className="mb-4 last:mb-0">
                  <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <div>
                      <p className="font-medium text-sm">{provider.name}</p>
                      <p className="text-xs text-gray-500">📞 {provider.phone} • ⭐ {provider.rating}</p>
                    </div>
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{provider.distance}</span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {provider.units.map((unit: any) => (
                      <div 
                        key={unit.type}
                        onClick={() => selectPortaJohn(provider, unit)}
                        className={`border-2 rounded-lg p-3 cursor-pointer transition ${
                          selectedPortaJohn?.unit.type === unit.type && selectedPortaJohn?.provider.id === provider.id
                            ? 'border-green-600 bg-green-50'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{unit.type}</span>
                              {unit.recommended && (
                                <span className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded">
                                  ★ Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">📐 {unit.size}</p>
                            <p className="text-xs text-gray-500">⏱️ {unit.rentalPeriod}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">${unit.price}</p>
                            <p className="text-xs text-gray-400">{unit.capacity}</p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                          <p>📋 Includes: {unit.includes.join(', ')}</p>
                        </div>
                        {selectedPortaJohn?.unit.type === unit.type && selectedPortaJohn?.provider.id === provider.id && (
                          <div className="mt-2 text-xs text-green-600 font-semibold">✓ Selected</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            {(selectedDumpster || selectedPortaJohn) && (
              <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg shadow-lg p-4 border-2 border-blue-500">
                <h3 className="font-semibold text-sm mb-3">🛒 Order Summary</h3>
                {selectedDumpster && (
                  <div className="flex justify-between text-sm border-b py-2">
                    <span>📦 {selectedDumpster.dumpster.size} Dumpster</span>
                    <span className="font-bold">${selectedDumpster.dumpster.price}</span>
                  </div>
                )}
                {selectedPortaJohn && (
                  <div className="flex justify-between text-sm border-b py-2">
                    <span>🚽 {selectedPortaJohn.unit.type} Porta John</span>
                    <span className="font-bold">${selectedPortaJohn.unit.price}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span>Total</span>
                  <span className="text-blue-600">${orderTotal}</span>
                </div>
                <button
                  onClick={orderNow}
                  className="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg font-semibold"
                >
                  📋 Order Now
                </button>
              </div>
            )}

            {/* Footer Notes */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                💡 <strong>Pro Tip:</strong> Rubber wheeled trailers are preferred for job sites as they reduce damage to driveways and provide better maneuverability on uneven terrain.
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                📦 <strong>Dumpster Sizing Guide:</strong> 10-15 Yard = Small jobs (bathroom, deck). 20-30 Yard = Medium jobs (kitchen, addition). 40 Yard = Large jobs (full house, commercial).
              </p>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/logistics')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🚛</span>
          <span className="text-xs">Logistics</span>
        </button>
        <button onClick={() => router.push('/homedepot')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏪</span>
          <span className="text-xs">HD</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
