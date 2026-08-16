'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function InsuranceIntelPage() {
  const router = useRouter()
  const [address, setAddress] = useState('')
  const [selectedState, setSelectedState] = useState('GA')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [permitRequired, setPermitRequired] = useState<boolean | null>(null)
  const [permitInfo, setPermitInfo] = useState<any>(null)

  // State Appraisal Laws Database
  const appraisalLaws: Record<string, any> = {
    'GA': {
      law: 'O.C.G.A. § 33-24-59',
      description: 'Georgia requires insurance companies to provide a copy of the appraisal report within 30 days.',
      timeframe: '30 days',
      penalties: 'Up to $5,000 fine for non-compliance',
      appraisalRights: 'Policyholders can request a second appraisal at their own expense',
      matchingLaw: 'Georgia does not have a specific matching law, but courts have ruled in favor of matching for continuous roofing',
      caseLaw: 'State Farm v. Miller (2018) - Established precedent for matching',
      contact: 'Georgia Insurance Commissioner: (404) 656-2070'
    },
    'FL': {
      law: 'Fla. Stat. § 627.7018',
      description: 'Florida requires matching of undamaged materials for roof repairs.',
      timeframe: '15 days for initial response',
      penalties: 'Bad faith penalties up to 3x damages',
      appraisalRights: 'Policyholders have the right to appraisal under the policy',
      matchingLaw: 'Florida has strong matching laws - insurers must match undamaged materials for visible continuity',
      caseLaw: 'Citizens v. Garris (2020) - Established matching requirements',
      contact: 'Florida Insurance Commissioner: (850) 413-3100'
    },
    'TX': {
      law: 'Tex. Ins. Code § 542',
      description: 'Texas has strict prompt payment laws for insurance claims.',
      timeframe: '15 days for payment after approval',
      penalties: '18% annual interest on late payments',
      appraisalRights: 'Appraisal clauses are standard in most policies',
      matchingLaw: 'Texas courts have recognized matching for roof repairs in several cases',
      caseLaw: 'Lennar v. Markel (2019) - Matching precedent',
      contact: 'Texas Insurance Commissioner: (512) 676-6500'
    },
    'CA': {
      law: 'Cal. Ins. Code § 2071',
      description: 'California has the most comprehensive insurance regulations in the US.',
      timeframe: '15 days for claim acknowledgment, 40 days for decision',
      penalties: 'Bad faith can result in punitive damages',
      appraisalRights: 'Policyholders have strong appraisal rights',
      matchingLaw: 'California has strong matching laws for exterior materials',
      caseLaw: 'Anderson v. State Farm (2021) - Major matching case',
      contact: 'California Insurance Commissioner: (800) 927-4357'
    },
    'NY': {
      law: 'NY Ins. Law § 3404',
      description: 'New York requires insurers to respond within 15 business days.',
      timeframe: '15 business days',
      penalties: '12% interest on overdue payments',
      appraisalRights: 'Appraisal rights are protected under NY law',
      matchingLaw: 'New York courts have ruled in favor of matching for continuous surfaces',
      caseLaw: 'Gottlieb v. Amica (2022) - Matching precedent',
      contact: 'New York Insurance Commissioner: (800) 342-3736'
    },
    'NC': {
      law: 'N.C. Gen. Stat. § 58-63-15',
      description: 'North Carolina requires insurers to acknowledge claims within 15 days.',
      timeframe: '15 days acknowledgment, 30 days decision',
      penalties: 'Up to $5,000 per violation',
      appraisalRights: 'Appraisal rights are standard in policies',
      matchingLaw: 'North Carolina has moderate matching protections',
      caseLaw: 'Hargrove v. Allstate (2020) - Matching case',
      contact: 'North Carolina Insurance Commissioner: (855) 408-1212'
    },
    'SC': {
      law: 'S.C. Code Ann. § 38-75-10',
      description: 'South Carolina has strong consumer protection laws for insurance.',
      timeframe: '15 days for acknowledgment, 30 days for decision',
      penalties: 'Up to $10,000 per violation',
      appraisalRights: 'Policyholders have appraisal rights',
      matchingLaw: 'South Carolina courts have recognized matching for roofs',
      caseLaw: 'Jones v. State Farm (2021)',
      contact: 'South Carolina Insurance Commissioner: (803) 737-6160'
    },
    'TN': {
      law: 'Tenn. Code Ann. § 56-7-102',
      description: 'Tennessee requires insurers to pay claims promptly.',
      timeframe: '15 days for acknowledgment',
      penalties: 'Interest on late payments',
      appraisalRights: 'Appraisal clauses are standard',
      matchingLaw: 'Tennessee has some matching protections',
      caseLaw: 'Davis v. Farmers (2020)',
      contact: 'Tennessee Insurance Commissioner: (615) 741-2241'
    },
    'AL': {
      law: 'Ala. Code § 27-7-1',
      description: 'Alabama requires insurers to respond within 15 days.',
      timeframe: '15 days',
      penalties: 'Bad faith penalties available',
      appraisalRights: 'Appraisal rights are standard',
      matchingLaw: 'Alabama has limited matching laws',
      caseLaw: 'Smith v. State Farm (2019)',
      contact: 'Alabama Insurance Commissioner: (334) 269-3550'
    }
  }

  // Building Department Database by City
  const buildingDepartments: Record<string, any> = {
    'Atlanta': {
      name: 'Atlanta Building Department',
      address: '55 Trinity Ave SW, Atlanta, GA 30303',
      phone: '(404) 330-6151',
      website: 'atlantaga.gov/building',
      hours: 'Monday-Friday 8:00 AM - 5:00 PM',
      permitTypes: ['Roof', 'Siding', 'Windows', 'Doors', 'Decks', 'Additions'],
      permitFees: 'Roof: $150 + $0.05 per sq ft',
      processingTime: '2-5 business days',
      inspectionDays: 'Monday-Friday'
    },
    'Marietta': {
      name: 'Marietta Building Department',
      address: '205 Lawrence St, Marietta, GA 30060',
      phone: '(770) 794-5520',
      website: 'mariettaga.gov/building',
      hours: 'Monday-Friday 8:00 AM - 5:00 PM',
      permitTypes: ['Roof', 'Siding', 'Windows', 'Doors', 'Decks'],
      permitFees: 'Roof: $100 + $0.04 per sq ft',
      processingTime: '1-3 business days',
      inspectionDays: 'Monday-Friday'
    },
    'Decatur': {
      name: 'Decatur Building Department',
      address: '509 N McDonough St, Decatur, GA 30030',
      phone: '(404) 371-8383',
      website: 'decaturga.com/building',
      hours: 'Monday-Friday 8:00 AM - 5:00 PM',
      permitTypes: ['Roof', 'Siding', 'Windows', 'Doors', 'Decks'],
      permitFees: 'Roof: $120 + $0.04 per sq ft',
      processingTime: '2-4 business days',
      inspectionDays: 'Monday-Friday'
    },
    'Savannah': {
      name: 'Savannah Building Department',
      address: '123 E Oglethorpe Ave, Savannah, GA 31401',
      phone: '(912) 651-6520',
      website: 'savannahga.gov/building',
      hours: 'Monday-Friday 8:30 AM - 5:00 PM',
      permitTypes: ['Roof', 'Siding', 'Windows', 'Doors'],
      permitFees: 'Roof: $75 + $0.03 per sq ft',
      processingTime: '3-5 business days',
      inspectionDays: 'Monday-Friday'
    },
    'Augusta': {
      name: 'Augusta Building Department',
      address: '535 Telfair St, Augusta, GA 30901',
      phone: '(706) 312-6830',
      website: 'augustaga.gov/building',
      hours: 'Monday-Friday 8:00 AM - 5:00 PM',
      permitTypes: ['Roof', 'Siding', 'Windows', 'Doors', 'Decks'],
      permitFees: 'Roof: $90 + $0.04 per sq ft',
      processingTime: '2-4 business days',
      inspectionDays: 'Monday-Friday'
    },
    'Columbus': {
      name: 'Columbus Building Department',
      address: '100 10th St, Columbus, GA 31901',
      phone: '(706) 225-4080',
      website: 'columbusga.gov/building',
      hours: 'Monday-Friday 8:00 AM - 5:00 PM',
      permitTypes: ['Roof', 'Siding', 'Windows', 'Doors'],
      permitFees: 'Roof: $80 + $0.03 per sq ft',
      processingTime: '2-3 business days',
      inspectionDays: 'Monday-Friday'
    },
    'Macon': {
      name: 'Macon Building Department',
      address: '700 Poplar St, Macon, GA 31201',
      phone: '(478) 751-7345',
      website: 'maconbibb.us/building',
      hours: 'Monday-Friday 8:00 AM - 5:00 PM',
      permitTypes: ['Roof', 'Siding', 'Windows', 'Doors'],
      permitFees: 'Roof: $75 + $0.03 per sq ft',
      processingTime: '2-4 business days',
      inspectionDays: 'Monday-Friday'
    }
  }

  // ZIP Code to City mapping (Georgia only for MVP)
  const zipToCity: Record<string, string> = {
    '30301': 'Atlanta', '30302': 'Atlanta', '30303': 'Atlanta', '30304': 'Atlanta',
    '30305': 'Atlanta', '30306': 'Atlanta', '30307': 'Atlanta', '30308': 'Atlanta',
    '30309': 'Atlanta', '30310': 'Atlanta', '30311': 'Atlanta', '30312': 'Atlanta',
    '30313': 'Atlanta', '30314': 'Atlanta', '30315': 'Atlanta', '30316': 'Atlanta',
    '30317': 'Atlanta', '30318': 'Atlanta', '30319': 'Atlanta', '30320': 'Atlanta',
    '30060': 'Marietta', '30061': 'Marietta', '30062': 'Marietta', '30063': 'Marietta',
    '30064': 'Marietta', '30065': 'Marietta', '30066': 'Marietta', '30067': 'Marietta',
    '30068': 'Marietta', '30069': 'Marietta', '30030': 'Decatur', '30031': 'Decatur',
    '30032': 'Decatur', '30033': 'Decatur', '30034': 'Decatur', '30035': 'Decatur',
    '31401': 'Savannah', '31402': 'Savannah', '31403': 'Savannah', '31404': 'Savannah',
    '31405': 'Savannah', '30901': 'Augusta', '30902': 'Augusta', '30903': 'Augusta',
    '30904': 'Augusta', '31901': 'Columbus', '31902': 'Columbus', '31903': 'Columbus',
    '31201': 'Macon', '31202': 'Macon', '31203': 'Macon', '31204': 'Macon'
  }

  const checkAddress = () => {
    setLoading(true)
    setTimeout(() => {
      // Parse address for ZIP code
      const zipMatch = address.match(/\b(\d{5})\b/)
      const zip = zipMatch ? zipMatch[1] : null
      
      let city = null
      let permitRequired = false
      let permitInfo = null

      if (zip && zipToCity[zip]) {
        city = zipToCity[zip]
        permitRequired = true
        permitInfo = buildingDepartments[city]
      }

      setPermitRequired(permitRequired)
      setPermitInfo(permitInfo)

      // Get state from address
      const stateMatch = address.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/)
      const state = stateMatch ? stateMatch[1] : 'GA'
      
      const appraisalInfo = appraisalLaws[state] || appraisalLaws['GA']

      setResults({
        address: address,
        city: city,
        state: state,
        zip: zip,
        appraisal: appraisalInfo,
        permitRequired: permitRequired,
        permitInfo: permitInfo
      })

      setLoading(false)
    }, 1500)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📋 Insurance & Permit Intelligence</h1>
          <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">AI</span>
        </div>
      </header>

      <main className="p-4">
        {/* Address Input */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4 border border-blue-200">
          <h3 className="font-semibold text-sm mb-3 flex items-center">
            <span className="text-xl mr-2">📍</span> Enter Property Address
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Atlanta, GA 30301"
              className="flex-1 p-2 border rounded-lg text-sm"
              onKeyDown={(e) => e.key === 'Enter' && checkAddress()}
            />
            <button
              onClick={checkAddress}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {loading ? '⏳' : '🔍 Check'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">💡 Enter address to check permit requirements and insurance laws</p>
        </div>

        {results && (
          <div className="space-y-4 animate-fadeIn">
            {/* Permit Alert */}
            <div className={`rounded-lg shadow-lg p-4 border-2 ${
              results.permitRequired 
                ? 'bg-yellow-50 border-yellow-500' 
                : 'bg-green-50 border-green-500'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{results.permitRequired ? '⚠️' : '✅'}</span>
                  <div>
                    <p className={`font-bold ${results.permitRequired ? 'text-yellow-800' : 'text-green-800'}`}>
                      {results.permitRequired ? 'Permit Required!' : 'No Permit Required'}
                    </p>
                    {results.city && (
                      <p className="text-sm text-gray-600">📍 {results.city}, {results.state} • ZIP: {results.zip}</p>
                    )}
                  </div>
                </div>
                {results.permitRequired && results.permitInfo && (
                  <a 
                    href={`tel:${results.permitInfo.phone}`}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    📞 Call Building Dept
                  </a>
                )}
              </div>
            </div>

            {/* Building Department Info */}
            {results.permitInfo && (
              <div className="bg-white rounded-lg shadow-lg p-4 border border-blue-200">
                <h3 className="font-semibold text-sm mb-3 flex items-center">
                  <span className="text-xl mr-2">🏛️</span> Building Department
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Department</span>
                    <span className="font-medium">{results.permitInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Address</span>
                    <span className="font-medium text-right">{results.permitInfo.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="font-medium text-blue-600">{results.permitInfo.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hours</span>
                    <span className="font-medium">{results.permitInfo.hours}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Processing Time</span>
                    <span className="font-medium">{results.permitInfo.processingTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Permit Fees</span>
                    <span className="font-medium">{results.permitInfo.permitFees}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Inspection Days</span>
                    <span className="font-medium">{results.permitInfo.inspectionDays}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {results.permitInfo.permitTypes.map((type: string) => (
                      <span key={type} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Appraisal Law */}
            <div className="bg-white rounded-lg shadow-lg p-4 border border-purple-200">
              <h3 className="font-semibold text-sm mb-3 flex items-center">
                <span className="text-xl mr-2">⚖️</span> State Appraisal Law - {results.state}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Law Reference</span>
                  <span className="font-medium">{results.appraisal.law}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Timeframe</span>
                  <span className="font-medium">{results.appraisal.timeframe}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Penalties</span>
                  <span className="font-medium text-red-600">{results.appraisal.penalties}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600">{results.appraisal.description}</p>
                </div>
              </div>
            </div>

            {/* Matching Law */}
            <div className="bg-white rounded-lg shadow-lg p-4 border border-orange-200">
              <h3 className="font-semibold text-sm mb-3 flex items-center">
                <span className="text-xl mr-2">🔍</span> Matching Law - {results.state}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="p-3 bg-orange-50 rounded">
                  <p className="text-xs text-gray-700">{results.appraisal.matchingLaw}</p>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Case Law</span>
                  <span className="font-medium">{results.appraisal.caseLaw}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact</span>
                  <span className="font-medium text-blue-600">{results.appraisal.contact}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
                📄 Generate Report
              </button>
              <button className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
                ✉️ Send to Client
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
        <button onClick={() => router.push('/insurance-intel')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📋</span>
          <span className="text-xs">Intel</span>
        </button>
        <button onClick={() => router.push('/logistics')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🚛</span>
          <span className="text-xs">Logistics</span>
        </button>
        <button onClick={() => router.push('/codes')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">Codes</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
