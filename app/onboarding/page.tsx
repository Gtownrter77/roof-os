'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    companyName: '',
    phone: '',
    email: '',
    state: 'GA',
    role: 'owner'
  })
  const [error, setError] = useState('')

  const steps = [
    { 
      title: 'Welcome to ROOF/OS! 👋',
      description: 'Let\'s get your roofing company set up in minutes.',
      icon: '🚀'
    },
    { 
      title: 'Company Details 📋',
      description: 'Tell us about your roofing business.',
      icon: '🏢'
    },
    { 
      title: 'Your Role 👤',
      description: 'Set up your account preferences.',
      icon: '⚙️'
    },
    { 
      title: 'Ready to Go! 🎉',
      description: 'You\'re all set to start using ROOF/OS.',
      icon: '🎊'
    }
  ]

  const handleNext = () => {
    if (step === 2 && !form.companyName.trim()) {
      setError('Enter your company name to continue.')
      return
    }
    setError('')
    if (step < 4) {
      setStep(step + 1)
    } else {
      router.push('/')
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="text-center">
            <div className="text-6xl mb-4">🚀</div>
            <h2 className="text-2xl font-bold mb-2">Welcome to ROOF/OS!</h2>
            <p className="text-gray-500">The all-in-one platform for roofing contractors.</p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="bg-blue-50 p-3 rounded-lg">
                <span className="text-2xl block">🌩️</span>
                <span className="text-sm font-medium">Storm Tracking</span>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <span className="text-2xl block">🤖</span>
                <span className="text-sm font-medium">AI Reports</span>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <span className="text-2xl block">📷</span>
                <span className="text-sm font-medium">Camera</span>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <span className="text-2xl block">📊</span>
                <span className="text-sm font-medium">Analytics</span>
              </div>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Company Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input 
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({...form, companyName: e.target.value})}
                className="w-full p-3 border rounded-lg"
                placeholder="Your Roofing Company"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input 
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({...form, phone: e.target.value})}
                className="w-full p-3 border rounded-lg"
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input 
                type="email"
                value={form.email}
                onChange={(e) => setForm({...form, email: e.target.value})}
                className="w-full p-3 border rounded-lg"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select 
                value={form.state}
                onChange={(e) => setForm({...form, state: e.target.value})}
                className="w-full p-3 border rounded-lg"
              >
                <option value="GA">Georgia</option>
                <option value="AL">Alabama</option>
                <option value="SC">South Carolina</option>
                <option value="NC">North Carolina</option>
                <option value="FL">Florida</option>
                <option value="TN">Tennessee</option>
              </select>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Your Role</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm({...form, role: 'owner'})} className={`p-4 border-2 rounded-lg text-center ${form.role === 'owner' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <span className="text-2xl block">👔</span>
                <span className="text-sm font-medium">Owner</span>
              </button>
              <button type="button" onClick={() => setForm({...form, role: 'manager'})} className={`p-4 border-2 rounded-lg text-center ${form.role === 'manager' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <span className="text-2xl block">📋</span>
                <span className="text-sm font-medium">Manager</span>
              </button>
              <button type="button" onClick={() => setForm({...form, role: 'inspector'})} className={`p-4 border-2 rounded-lg text-center ${form.role === 'inspector' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <span className="text-2xl block">🔍</span>
                <span className="text-sm font-medium">Inspector</span>
              </button>
              <button type="button" onClick={() => setForm({...form, role: 'sales'})} className={`p-4 border-2 rounded-lg text-center ${form.role === 'sales' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <span className="text-2xl block">📞</span>
                <span className="text-sm font-medium">Sales</span>
              </button>
            </div>
          </div>
        )
      case 4:
        return (
          <div className="text-center">
            <div className="text-6xl mb-4">🎊</div>
            <h2 className="text-2xl font-bold mb-2">You're All Set!</h2>
            <p className="text-gray-500">Your ROOF/OS account is ready to go.</p>
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                ✅ Company profile created<br />
                ✅ Account configured<br />
                ✅ Ready to start
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        {/* Progress */}
        <div className="flex justify-between mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 mx-1 rounded ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[300px]">
          {renderStep()}
          {error && <p className="text-sm text-red-600 mt-4" role="alert">{error}</p>}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button 
            onClick={handleBack}
            className={`px-6 py-2 rounded-lg ${step > 1 ? 'bg-gray-200 text-gray-700' : 'invisible'}`}
          >
            Back
          </button>
          <button 
            onClick={handleNext}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold"
          >
            {step === 4 ? '🚀 Get Started' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}
