'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Measurement = { text: string; id: number }
type Tool = 'pencil' | 'line' | 'rectangle' | 'circle'

type Point = { x: number; y: number }

const CANVAS_HEIGHT = 400
const CANVAS_SCALE = 2

export default function SketchPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const historyRef = useRef<ImageData[]>([])
  const strokeStartRef = useRef<Point | null>(null)
  const beforeStrokeRef = useRef<ImageData | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>('pencil')
  const [color, setColor] = useState('#2563EB')
  const [brushSize, setBrushSize] = useState(3)
  const [measurements, setMeasurements] = useState<Measurement[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const width = Math.max(1, Math.round(canvas.offsetWidth))
    canvas.width = width * CANVAS_SCALE
    canvas.height = CANVAS_HEIGHT * CANVAS_SCALE

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.scale(CANVAS_SCALE, CANVAS_SCALE)
    drawGrid(ctx, canvas)
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
  }, [])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.5

    for (let x = 0; x < canvas.width / CANVAS_SCALE; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height / CANVAS_SCALE)
      ctx.stroke()
    }

    for (let y = 0; y < canvas.height / CANVAS_SCALE; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width / CANVAS_SCALE, y)
      ctx.stroke()
    }
  }

  const drawShape = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()

    if (tool === 'line') {
      ctx.moveTo(start.x, start.y)
      ctx.lineTo(end.x, end.y)
    } else if (tool === 'rectangle') {
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y)
    } else if (tool === 'circle') {
      const centerX = (start.x + end.x) / 2
      const centerY = (start.y + end.y) / 2
      const radiusX = Math.abs(end.x - start.x) / 2
      const radiusY = Math.abs(end.y - start.y) / 2
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2)
    }

    ctx.stroke()
  }

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const start = getPoint(event)
    beforeStrokeRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    strokeStartRef.current = start
    setIsDrawing(true)
    canvas.setPointerCapture(event.pointerId)

    if (tool === 'pencil') {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(start.x, start.y)
    }
  }

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const start = strokeStartRef.current
    if (!canvas || !ctx || !start) return

    const current = getPoint(event)

    if (tool === 'pencil') {
      ctx.strokeStyle = color
      ctx.lineWidth = brushSize
      ctx.lineTo(current.x, current.y)
      ctx.stroke()
      return
    }

    const snapshot = beforeStrokeRef.current
    if (!snapshot) return
    ctx.putImageData(snapshot, 0, 0)
    drawShape(ctx, start, current)
  }

  const stopDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.closePath()
    historyRef.current.push(beforeStrokeRef.current ?? ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)

    beforeStrokeRef.current = null
    strokeStartRef.current = null
    setIsDrawing(false)
  }

  const undo = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const previous = historyRef.current.pop()
    if (!previous) return
    ctx.putImageData(previous, 0, 0)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width / CANVAS_SCALE, canvas.height / CANVAS_SCALE)
    drawGrid(ctx, canvas)
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
    beforeStrokeRef.current = null
    strokeStartRef.current = null
    setIsDrawing(false)
  }

  const addMeasurement = () => {
    const measurement = prompt('Enter measurement (e.g., 24ft x 18ft):')
    const trimmed = measurement?.trim()
    if (!trimmed) return
    setMeasurements((current) => [...current, { text: trimmed, id: Date.now() }])
  }

  const downloadSketch = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement('a')
    link.download = `roof-os-sketch-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <button onClick={() => router.back()} className="text-white mr-3 text-xl" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">✏️ Sketch Pad</h1>
        </div>
      </header>

      <main className="p-4">
        <div className="bg-white rounded-lg shadow-lg p-3 mb-4 flex flex-wrap gap-2">
          {([
            ['pencil', '✏️', 'Pencil'],
            ['line', '📏', 'Line'],
            ['rectangle', '⬜', 'Rectangle'],
            ['circle', '⭕', 'Ellipse'],
          ] as const).map(([value, icon, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTool(value)}
              aria-label={label}
              aria-pressed={tool === value}
              className={`p-2 rounded ${tool === value ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            >
              {icon}
            </button>
          ))}
          <div className="w-px h-8 bg-gray-300 mx-1" />
          <input
            type="color"
            value={color}
            aria-label="Drawing color"
            onChange={(event) => setColor(event.target.value)}
            className="w-8 h-8 rounded border"
          />
          <select
            value={brushSize}
            aria-label="Brush size"
            onChange={(event) => setBrushSize(Number(event.target.value))}
            className="border rounded p-1 text-sm"
          >
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
          </select>
          <button type="button" onClick={undo} className="text-gray-700 hover:bg-gray-100 p-2 rounded" aria-label="Undo last stroke">
            ↩️
          </button>
          <button type="button" onClick={clearCanvas} className="text-red-600 hover:bg-red-50 p-2 rounded" aria-label="Clear sketch">
            🗑️
          </button>
          <button type="button" onClick={addMeasurement} className="bg-green-100 text-green-600 p-2 rounded">
            📐 Add Measurement
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-gray-200">
          <canvas
            ref={canvasRef}
            className="w-full h-80 touch-none"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
          />
        </div>

        {measurements.length > 0 && (
          <div className="mt-4 bg-white rounded-lg shadow-lg p-4">
            <h3 className="font-semibold text-sm mb-2">📐 Measurements</h3>
            {measurements.map((measurement) => (
              <div key={measurement.id} className="flex justify-between items-center border-b py-1">
                <span>{measurement.text}</span>
                <button
                  type="button"
                  onClick={() => setMeasurements((current) => current.filter((item) => item.id !== measurement.id))}
                  className="text-red-500 text-xs"
                  aria-label={`Remove ${measurement.text}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={downloadSketch} className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">
            💾 Download PNG
          </button>
          <button type="button" onClick={() => router.push('/pricing')} className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">
            📄 Open Estimate
          </button>
        </div>

        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-800">
            💡 Draw roof layout and record field measurements. This sketch is a visual aid; measurements remain field-verified.
          </p>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 px-4">
        <button type="button" onClick={() => router.push('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">🏠</span>
          <span className="text-xs">Home</span>
        </button>
        <button type="button" onClick={() => router.push('/sketch')} className="flex flex-col items-center text-blue-600">
          <span className="text-xl">✏️</span>
          <span className="text-xs">Sketch</span>
        </button>
        <button type="button" onClick={() => router.push('/templates')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📄</span>
          <span className="text-xs">Templates</span>
        </button>
        <button type="button" onClick={() => router.push('/insurance')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📞</span>
          <span className="text-xs">Insurance</span>
        </button>
        <button type="button" onClick={() => router.push('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  )
}
