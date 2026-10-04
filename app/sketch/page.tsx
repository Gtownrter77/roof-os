'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SketchPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState('pencil')
  const [color, setColor] = useState('#2563EB')
  const [brushSize, setBrushSize] = useState(3)
  const [shapes, setShapes] = useState<any[]>([])
  const [measurements, setMeasurements] = useState<any[]>([])
  const [undoStack, setUndoStack] = useState<any[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Set canvas size
    canvas.width = canvas.offsetWidth * 2
    canvas.height = 400 * 2
    ctx.scale(2, 2)
    
    // Draw grid
    drawGrid(ctx)
  }, [])

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current
    if (!canvas) return
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.5
    
    // Vertical lines
    for (let x = 0; x < canvas.width / 2; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height / 2)
      ctx.stroke()
    }
    
    // Horizontal lines
    for (let y = 0; y < canvas.height / 2; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width / 2, y)
      ctx.stroke()
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    setIsDrawing(true)
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const rect = canvas.getBoundingClientRect()
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top
    
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.closePath()
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    ctx.clearRect(0, 0, canvas.width / 2, canvas.height / 2)
    drawGrid(ctx)
  }

  const addMeasurement = () => {
    const measurement = prompt('Enter measurement (e.g., 24ft x 18ft):')
    if (measurement) {
      setMeasurements([...measurements, { text: measurement, id: Date.now() }])
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl">←</button>
          <h1 className="text-xl font-bold">✏️ Sketch Pad</h1>
        </div>
      </header>

      <main className="p-4">
        {/* Toolbar */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-4 flex flex-wrap gap-2">
          <button 
            onClick={() => setTool('pencil')}
            className={`p-2 rounded ${tool === 'pencil' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
          >
            ✏️
          </button>
          <button 
            onClick={() => setTool('line')}
            className={`p-2 rounded ${tool === 'line' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
          >
            📏
          </button>
          <button 
            onClick={() => setTool('rectangle')}
            className={`p-2 rounded ${tool === 'rectangle' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
          >
            ⬜
          </button>
          <button 
            onClick={() => setTool('circle')}
            className={`p-2 rounded ${tool === 'circle' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
          >
            ⭕
          </button>
          <div className="w-px h-8 bg-gray-300 mx-1" />
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded border"
          />
          <select 
            value={brushSize} 
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="border rounded p-1 text-sm"
          >
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
          <button onClick={clearCanvas} className="text-red-600 hover:bg-red-50 p-2 rounded">
            🗑️
          </button>
          <button onClick={addMeasurement} className="bg-green-100 text-green-600 p-2 rounded">
            📐 Add Measurement
          </button>
        </div>

        {/* Canvas */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-200">
          <canvas
            ref={canvasRef}
            className="w-full h-80 touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        {/* Measurements */}
        {measurements.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold text-sm mb-2">📐 Measurements</h3>
            {measurements.map((m) => (
              <div key={m.id} className="flex justify-between items-center border-b py-1">
                <span>{m.text}</span>
                <button 
                  onClick={() => setMeasurements(measurements.filter((item) => item.id !== m.id))}
                  className="text-red-500 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
            💾 Save Sketch
          </button>
          <button className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
            📄 Generate from Sketch
          </button>
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            💡 Draw roof layout, add measurements, and generate estimate
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push('/sketch')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">✏️</span>
          <span className="text-xs">Sketch</span>
        </button>
        <button onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button onClick={() => router.push('/insurance')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📞</span>
          <span className="text-xs">Insurance</span>
        </button>
        <button onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
