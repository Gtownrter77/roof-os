'use client';
import React, { useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, ImageOverlay, Polygon, TileLayer, useMapEvents } from 'react-leaflet';
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
  mapCenter,
  aerialTileUrl,
  aerialAttribution,
}: {
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  scalePixels?: number;
  scaleFeet?: number;
  onAreaCalculated?: (result: { value: number; unit: 'px' | 'sqft'; squareFeet: number | null }) => void;
  mapCenter?: { latitude: number; longitude: number } | null;
  aerialTileUrl?: string;
  aerialAttribution?: string;
}) => {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [areaPx, setAreaPx] = useState(0);
  const useGeoMap = !imageUrl && Boolean(mapCenter);
  const earthRadiusMeters = 6371008.8;
  const geoAreaSqFt = useGeoMap && points.length >= 3 ? (() => {
    const lat0 = points.reduce((sum, point) => sum + point[0], 0) / points.length * Math.PI / 180;
    const coords = points.map(([lat, lng]) => [earthRadiusMeters * lng * Math.PI / 180 * Math.cos(lat0), earthRadiusMeters * lat * Math.PI / 180]);
    let twiceArea = 0;
    for (let i = 0; i < coords.length; i++) { const a = coords[i], b = coords[(i + 1) % coords.length]; twiceArea += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(twiceArea) / 2 * 10.76391041671;
  })() : 0;
  const width = Math.max(1, imageWidth);
  const height = Math.max(1, imageHeight);
  const bounds = useMemo(() => [[0, 0], [height, width]] as [[number, number], [number, number]], [height, width]);
  const pixelsPerFoot = scalePixels > 0 && scaleFeet > 0 ? scalePixels / scaleFeet : 0;
  const areaSqFt = areaPx > 0 && pixelsPerFoot > 0 ? areaPx / (pixelsPerFoot * pixelsPerFoot) : 0;

  const calculateArea = () => {
    if (points.length < 3) return;
    if (useGeoMap) {
      setAreaPx(0);
      onAreaCalculated?.({ value: geoAreaSqFt, unit: 'sqft', squareFeet: geoAreaSqFt });
      return;
    }
    const pixels = shoelacePixels(points);
    setAreaPx(pixels);
    const squareFeet = pixelsPerFoot > 0 ? pixels / (pixelsPerFoot * pixelsPerFoot) : null;
    onAreaCalculated?.({ value: pixels, unit: 'px', squareFeet });
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
      {(imageUrl || (mapCenter && aerialTileUrl)) ? (
        <div className="h-[420px] w-full overflow-hidden rounded-lg border border-white/15">
          <MapContainer
            key={imageUrl || `${mapCenter?.latitude},${mapCenter?.longitude}`}
            crs={imageUrl ? L.CRS.Simple : L.CRS.EPSG3857}
            {...(imageUrl ? { bounds, maxBounds: bounds, zoomSnap: 0.25 } : { center: [mapCenter!.latitude, mapCenter!.longitude] as [number, number], zoom: 20, maxZoom: 22 })}
            className="h-full w-full"
            style={{ height: '100%', width: '100%', background: '#000' }}
          >
            {imageUrl ? <ImageOverlay url={imageUrl} bounds={bounds} /> : <TileLayer url={aerialTileUrl!} attribution={aerialAttribution || 'OpenAerialMap'} maxZoom={22} maxNativeZoom={19} />}
            <MapEvents isDrawing={isDrawing} setPoints={setPoints} />
            {points.length > 0 && <Polygon positions={points} pathOptions={{ color: '#16c9ff', weight: 2, fillOpacity: 0.18 }} />}
          </MapContainer>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">AERIAL IMAGERY UNAVAILABLE — no verified, openly licensed aerial image is loaded for this address.</p>
      )}
      <p className="mt-2 text-sm text-slate-300">
        {useGeoMap && geoAreaSqFt > 0 ? `${geoAreaSqFt.toFixed(1)} sq ft · ${(geoAreaSqFt / 100).toFixed(2)} squares · ${((geoAreaSqFt / 100) * 3).toFixed(1)} standard bundles. Designer shingles are product-specific.` : areaPx > 0
          ? areaSqFt > 0
            ? `${Math.round(areaPx).toLocaleString()} px² · ${areaSqFt.toFixed(1)} sq ft · ${(areaSqFt / 100).toFixed(2)} squares · ${((areaSqFt / 100) * 3).toFixed(1)} standard bundles.`
            : `${Math.round(areaPx).toLocaleString()} px². Enter a scale reference to convert to square feet, squares, and bundles.`
          : useGeoMap ? 'Click Start Drawing, then click roof corners. 100 sq ft = 1 square = 3 standard bundles.' : 'Click the image to draw a plane. 100 sq ft = 1 square = 3 standard bundles unless designer.'}
      </p>
    </div>
  );
};

export default ManualDrawingTool;
