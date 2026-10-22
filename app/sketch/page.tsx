'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'

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

  const drawGrid = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 0.5
    for (let x = 0; x < canvas.width / CANVAS_SCALE; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height / CANVAS_SCALE); ctx.stroke()
    }
    for (let y = 0; y < canvas.height / CANVAS_SCALE; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width / CANVAS_SCALE, y); ctx.stroke()
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = Math.max(1, Math.round(canvas.offsetWidth)) * CANVAS_SCALE
    canvas.height = CANVAS_HEIGHT * CANVAS_SCALE
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(CANVAS_SCALE, CANVAS_SCALE)
    drawGrid(ctx, canvas)
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
  }, [])

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current?.getBoundingClientRect()
    return rect ? { x: event.clientX - rect.left, y: event.clientY - rect.top } : { x: 0, y: 0 }
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
      ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2)
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
    } else if (beforeStrokeRef.current) {
      ctx.putImageData(beforeStrokeRef.current, 0, 0)
      drawShape(ctx, start, current)
    }
  }

  const stopDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const start = strokeStartRef.current
    if (tool !== 'pencil' && start && beforeStrokeRef.current) {
      const end = event ? getPoint(event) : start
      ctx.putImageData(beforeStrokeRef.current, 0, 0)
      drawShape(ctx, start, end)
    } else {
      ctx.closePath()
    }
    historyRef.current.push(beforeStrokeRef.current ?? ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    beforeStrokeRef.current = null
    strokeStartRef.current = null
    setIsDrawing(false)
  }

  const undo = () => {
    if (historyRef.current.length <= 1) return
    const previous = historyRef.current.pop()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (previous && canvas && ctx) ctx.putImageData(previous, 0, 0)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width / CANVAS_SCALE, canvas.height / CANVAS_SCALE)
    drawGrid(ctx, canvas)
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
  }

  const addMeasurement = () => {
    const value = prompt('Enter field measurement (e.g., 24ft x 18ft)')?.trim()
    if (value) setMeasurements((current) => [...current, { text: value, id: Date.now() }])
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
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4">
        <div className="px-4 py-3 flex items-center">
          <button type="button" onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button>
          <h1 className="text-xl font-bold">✏️ Sketch Pad</h1>
        </div>
      </header>
      <main className="p-4">
        <div className="glass rounded-xl p-3 mb-4 flex flex-wrap gap-2">
          {([
            ['pencil', '✏️', 'Pencil'],
            ['line', '📏', 'Line'],
            ['rectangle', '⬜', 'Rectangle'],
            ['circle', '⭕', 'Ellipse'],
          ] as const).map(([value, icon, label]) => (
            <button key={value} type="button" onClick={() => setTool(value)} aria-label={label} aria-pressed={tool === value} className={`p-2 rounded ${tool === value ? 'bg-blue-100 text-cyan-300' : 'hover:bg-white/10'}`}>
              {icon}
            </button>
          ))}
          <div className="w-px h-8 bg-gray-300 mx-1" />
          <input type="color" value={color} aria-label="Drawing color" onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded border" />
          <select value={brushSize} aria-label="Brush size" onChange={(e) => setBrushSize(Number(e.target.value))} className="border rounded p-1 text-sm">
            <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option>
          </select>
          <button type="button" onClick={undo} className="p-2 rounded hover:bg-white/10" aria-label="Undo last stroke">↩️</button>
          <button type="button" onClick={clearCanvas} className="p-2 rounded text-red-300 hover:bg-red-400/10" aria-label="Clear sketch">🗑️</button>
          <button type="button" onClick={addMeasurement} className="bg-green-100 text-green-600 p-2 rounded">📐 Add Measurement</button>
        </div>
        <div className="glass rounded-xl overflow-hidden border-2 border-white/10">
          <canvas ref={canvasRef} className="w-full h-80 touch-none" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} />
        </div>
        {measurements.length > 0 && (
          <div className="mt-4 glass rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-2">📐 Measurements</h3>
            {measurements.map((measurement) => (
              <div key={measurement.id} className="flex justify-between items-center border-b py-1">
                <span>{measurement.text}</span>
                <button type="button" onClick={() => setMeasurements((current) => current.filter((item) => item.id !== measurement.id))} className="text-red-500 text-xs" aria-label={`Remove ${measurement.text}`}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button type="button" onClick={downloadSketch} className="bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold">💾 Download PNG</button>
          <button type="button" onClick={() => router.push('/pricing')} className="bg-green-600 text-white py-2 rounded-lg text-sm font-semibold">📄 Open Estimate</button>
        </div>
        <div className="mt-4 bg-amber-400/10 border border-yellow-200 rounded-lg p-3"><p className="text-xs text-yellow-800">💡 Draw roof layout and record field measurements. This sketch is a visual aid; measurements remain field-verified.</p></div>
      </main>
    </div>
  )
}
