'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { smartBack } from '../../lib/smart-back'
import RoofSlopeCard from '../../components/RoofSlopeCard'

type Measurement = { text: string; id: number }
type Tool = 'pencil' | 'line' | 'rectangle' | 'circle'
type Point = { x: number; y: number }

const CANVAS_WIDTH = 1600
const CANVAS_HEIGHT = 900

export default function SketchPage() {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const historyRef = useRef<ImageData[]>([])
  const strokeStartRef = useRef<Point | null>(null)
  const beforeStrokeRef = useRef<ImageData | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [tool, setTool] = useState<Tool>('line')
  const [color, setColor] = useState('#22d3ee')
  const [brushSize, setBrushSize] = useState(5)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [photoName, setPhotoName] = useState('')

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(148,163,184,.22)'
    ctx.lineWidth = 1
    for (let x = 0; x <= CANVAS_WIDTH; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT); ctx.stroke() }
    for (let y = 0; y <= CANVAS_HEIGHT; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y); ctx.stroke() }
  }

  const drawBase = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    const image = imageRef.current
    if (image) {
      const scale = Math.min(CANVAS_WIDTH / image.naturalWidth, CANVAS_HEIGHT / image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      ctx.globalAlpha = 0.86
      ctx.drawImage(image, (CANVAS_WIDTH - width) / 2, (CANVAS_HEIGHT - height) / 2, width, height)
      ctx.globalAlpha = 1
    } else {
      drawGrid(ctx)
    }
    historyRef.current = [ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)]
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    drawBase()
  }, [])

  const loadAerialPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      const image = new Image()
      image.onload = () => { imageRef.current = image; setPhotoName(file.name); drawBase() }
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (event.clientX - rect.left) * (CANVAS_WIDTH / rect.width), y: (event.clientY - rect.top) * (CANVAS_HEIGHT / rect.height) }
  }

  const drawShape = (ctx: CanvasRenderingContext2D, start: Point, end: Point) => {
    ctx.strokeStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    if (tool === 'line') { ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y) }
    else if (tool === 'rectangle') ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y)
    else if (tool === 'circle') ctx.ellipse((start.x + end.x) / 2, (start.y + end.y) / 2, Math.abs(end.x - start.x) / 2, Math.abs(end.y - start.y) / 2, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const start = getPoint(event)
    beforeStrokeRef.current = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    strokeStartRef.current = start
    setIsDrawing(true)
    canvas.setPointerCapture(event.pointerId)
    if (tool === 'pencil') { ctx.strokeStyle = color; ctx.lineWidth = brushSize; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(start.x, start.y) }
  }

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const start = strokeStartRef.current
    if (!canvas || !ctx || !start) return
    const current = getPoint(event)
    if (tool === 'pencil') { ctx.strokeStyle = color; ctx.lineTo(current.x, current.y); ctx.stroke() }
    else if (beforeStrokeRef.current) { ctx.putImageData(beforeStrokeRef.current, 0, 0); drawShape(ctx, start, current) }
  }

  const stopDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const start = strokeStartRef.current
    if (!canvas || !ctx) return
    if (tool !== 'pencil' && start && beforeStrokeRef.current) { ctx.putImageData(beforeStrokeRef.current, 0, 0); drawShape(ctx, start, event ? getPoint(event) : start) } else ctx.closePath()
    historyRef.current.push(ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT))
    if (event && canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    beforeStrokeRef.current = null; strokeStartRef.current = null; setIsDrawing(false)
  }

  const undo = () => {
    if (historyRef.current.length <= 1) return
    historyRef.current.pop()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const previous = historyRef.current.at(-1)
    if (ctx && previous) ctx.putImageData(previous, 0, 0)
  }

  const clearCanvas = () => drawBase()

  const addMeasurement = () => {
    const value = window.prompt('Enter a field measurement (for example, 24 ft × 18 ft)')?.trim()
    if (value) setMeasurements((current) => [...current, { text: value, id: Date.now() }])
  }

  const downloadSketch = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `roof-os-aerial-sketch-${new Date().toISOString().slice(0, 10)}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="space-y-4 pb-4">
      <header className="glass rounded-xl mb-4"><div className="px-4 py-3 flex items-center"><button type="button" onClick={() => smartBack(router)} className="mr-3 text-xl text-cyan-300" aria-label="Go back">←</button><div><p className="ops-label">ROOF/OS field geometry</p><h1 className="text-xl font-bold">Roof sketch from aerial photo</h1></div></div></header>
      <main className="p-4 space-y-4">
        <section className="glass rounded-xl p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Photo underlay</h2><p className="mt-1 text-xs text-slate-400">Load an aerial or inspection photo, then trace roof planes, ridges, eaves, and objects on top of it.</p></div><input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={loadAerialPhoto} /><button type="button" onClick={() => photoInputRef.current?.click()} className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-semibold text-white">{photoName ? 'Replace aerial photo' : 'Load aerial photo'}</button></div>{photoName ? <p className="mt-2 text-xs text-cyan-200">Tracing: {photoName}. The original stays in this browser; download the marked-up sketch when finished.</p> : <p className="mt-2 text-xs text-amber-200">No photo loaded. The grid remains available for a field sketch.</p>}</section>
        <section className="glass rounded-xl p-3"><div className="flex flex-wrap gap-2">{([['pencil','✏️','Freehand'],['line','📏','Roof edge'],['rectangle','⬜','Plane box'],['circle','⭕','Object']] as const).map(([value, icon, label]) => <button key={value} type="button" onClick={() => setTool(value)} aria-label={label} aria-pressed={tool === value} className={`rounded px-3 py-2 text-sm ${tool === value ? 'bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400' : 'hover:bg-white/10'}`}>{icon} {label}</button>)}<div className="w-px bg-white/15" /><input type="color" value={color} aria-label="Drawing color" onChange={(event) => setColor(event.target.value)} className="h-9 w-9 rounded border" /><select value={brushSize} aria-label="Brush size" onChange={(event) => setBrushSize(Number(event.target.value))} className="rounded border bg-slate-900 p-1 text-sm"><option value={2}>2 px</option><option value={5}>5 px</option><option value={10}>10 px</option><option value={18}>18 px</option></select><button type="button" onClick={undo} className="rounded px-3 py-2 hover:bg-white/10" aria-label="Undo last stroke">↩ Undo</button><button type="button" onClick={clearCanvas} className="rounded px-3 py-2 text-red-300 hover:bg-red-400/10" aria-label="Clear sketch">Clear</button><button type="button" onClick={addMeasurement} className="rounded bg-emerald-600 px-3 py-2 text-sm text-white">Add measurement</button></div></section>
        <section className="glass overflow-hidden rounded-xl border-2 border-cyan-400/30"><canvas ref={canvasRef} className="block h-auto max-h-[70vh] w-full touch-none" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} /></section>
        <RoofSlopeCard compact />
        {measurements.length > 0 && <section className="glass rounded-xl p-4"><h3 className="mb-2 text-sm font-semibold">Field measurements</h3>{measurements.map((measurement) => <div key={measurement.id} className="flex items-center justify-between border-b border-white/10 py-2 text-sm"><span>{measurement.text}</span><button type="button" onClick={() => setMeasurements((current) => current.filter((item) => item.id !== measurement.id))} className="text-xs text-red-300" aria-label={`Remove ${measurement.text}`}>Remove</button></div>)}</section>}
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={downloadSketch} className="rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white">Download marked-up PNG</button><button type="button" onClick={() => router.push('/measure')} className="rounded-lg bg-slate-700 py-3 text-sm font-semibold text-white">Open AI geometry review</button></div>
        <div className="rounded-lg border border-amber-300/30 bg-amber-400/10 p-3 text-xs text-amber-100">Sketches and slope entries are human field aids. They are not certified measurements and do not create estimate quantities until reviewed through the existing measurement workflow.</div>
      </main>
    </div>
  )
}
