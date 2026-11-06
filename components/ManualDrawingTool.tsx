'use client';
import React, { useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, ImageOverlay, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapEvents({ isDrawing, setPoints }: { isDrawing: boolean; setPoints: React.Dispatch<React.SetStateAction<[number, number][]>> }) {
  useMapEvents({
    click(e) {
      if (!isDrawing) return;
      setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
    },
  });
  return null;
}

function shoelacePixels(points: [number, number][]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [y1, x1] = points[i];
    const [y2, x2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

const ManualDrawingTool = ({
  imageUrl = '',
  imageWidth = 500,
  imageHeight = 500,
  scalePixels = 0,
  scaleFeet = 0,
  onAreaCalculated,
}: {
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  scalePixels?: number;
  scaleFeet?: number;
  onAreaCalculated?: (area: number) => void;
}) => {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [areaPx, setAreaPx] = useState(0);
  const width = Math.max(1, imageWidth);
  const height = Math.max(1, imageHeight);
  const bounds = useMemo(() => [[0, 0], [height, width]] as [[number, number], [number, number]], [height, width]);
  const pixelsPerFoot = scalePixels > 0 && scaleFeet > 0 ? scalePixels / scaleFeet : 0;
  const areaSqFt = areaPx > 0 && pixelsPerFoot > 0 ? areaPx / (pixelsPerFoot * pixelsPerFoot) : 0;

  const calculateArea = () => {
    if (points.length < 3) return;
    const pixels = shoelacePixels(points);
    setAreaPx(pixels);
    onAreaCalculated?.(pixels);
  };

  return (
    <div className="mt-3 w-full">
      <div className="mb-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setIsDrawing(!isDrawing)} className="rounded bg-cyan-600 px-3 py-1 text-sm text-white">
          {isDrawing ? 'Stop Drawing' : 'Start Drawing'}
        </button>
        <button type="button" onClick={calculateArea} disabled={points.length < 3} className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50">
          Calculate Area
        </button>
        {points.length > 0 && (
          <button type="button" onClick={() => { setPoints([]); setAreaPx(0); }} className="rounded border border-white/20 px-3 py-1 text-sm text-slate-200">
            Clear
          </button>
        )}
      </div>
      {imageUrl ? (
        <div className="h-[420px] w-full overflow-hidden rounded-lg border border-white/15">
          <MapContainer
            crs={L.CRS.Simple}
            bounds={bounds}
            maxBounds={bounds}
            zoomSnap={0.25}
            className="h-full w-full"
            style={{ height: '100%', width: '100%', background: '#000' }}
          >
            <ImageOverlay url={imageUrl} bounds={bounds} />
            <MapEvents isDrawing={isDrawing} setPoints={setPoints} />
            {points.length > 0 && <Polygon positions={points} pathOptions={{ color: '#16c9ff', weight: 2, fillOpacity: 0.18 }} />}
          </MapContainer>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Load an inspection image to draw on it.</p>
      )}
      <p className="mt-2 text-sm text-slate-300">
        {areaPx > 0
          ? areaSqFt > 0
            ? `${Math.round(areaPx).toLocaleString()} px² · ${areaSqFt.toFixed(1)} sq ft from the scale reference. Non-authoritative until confirmed.`
            : `${Math.round(areaPx).toLocaleString()} px². Enter a scale reference to convert to square feet.`
          : 'Click the image to draw a plane. Area is pixel geometry until a scale reference exists.'}
      </p>
    </div>
  );
};

export default ManualDrawingTool;
