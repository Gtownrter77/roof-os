'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function CameraPage() {
  const router = useRouter()
  const [photos, setPhotos] = useState<string[]>([])
  const [isCapturing, setIsCapturing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const takePhoto = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          setPhotos([...photos, event.target.result as string])
        }
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  const deletePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
  }

  const savePhotos = () => {
    if (photos.length === 0) {
      alert('Please take at least one photo')
      return
    }
    // Save photos to localStorage for now
    localStorage.setItem('inspection_photos', JSON.stringify(photos))
    alert(`✅ ${photos.length} photos saved!`)
    router.back()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-blue-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">📷 Camera</h1>
        </div>
      </header>

      <main className="p-4">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Camera Button */}
        <button
          onClick={takePhoto}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg flex items-center justify-center"
        >
          <span className="text-2xl mr-2">📸</span>
          Take Photo
        </button>

        <p className="text-xs text-gray-400 text-center mt-2">
          Tap to open camera or select from gallery
        </p>

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-sm text-gray-700">
                Photos ({photos.length})
              </h2>
              <button
                onClick={savePhotos}
                className="bg-green-600 text-white px-4 py-1 rounded text-sm"
              >
                💾 Save All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative bg-white rounded-lg shadow overflow-hidden">
                  <img src={photo} alt={`Photo ${index + 1}`} className="w-full h-40 object-cover" />
                  <button
                    onClick={() => deletePhoto(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm"
                  >
                    ✕
                  </button>
                  <div className="p-1 text-center text-xs text-gray-500">
                    Photo {index + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {photos.length === 0 && (
          <div className="mt-8 bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📷</div>
            <p className="text-gray-400">No photos taken yet</p>
            <p className="text-xs text-gray-300 mt-1">Take photos to add to inspection</p>
          </div>
        )}

        {/* View saved photos */}
        <button
          onClick={() => {
            const saved = localStorage.getItem('inspection_photos')
            if (saved) {
              const photos = JSON.parse(saved)
              alert(`📷 ${photos.length} saved photos found!`)
            } else {
              alert('No saved photos found')
            }
          }}
          className="w-full mt-4 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm"
        >
          📂 View Saved Photos
        </button>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/leads')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">👤</span>
          <span className="text-xs">Leads</span>
        </button>
        <button onClick={() => router.push('/inspections')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">🔍</span>
          <span className="text-xs">Inspect</span>
        </button>
        <button onClick={() => router.push('/camera')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">📷</span>
          <span className="text-xs">Camera</span>
        </button>
        <button onClick={() => router.push('/weather')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🌤️</span>
          <span className="text-xs">Weather</span>
        </button>
      </nav>
    </div>
  )
}
