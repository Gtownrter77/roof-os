'use client';
import React, { useState } from 'react';
import L from 'leaflet';
import { MapContainer, ImageOverlay, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';

const ManualDrawingTool = ({ imageUrl, onAreaCalculated }: { imageUrl: string, onAreaCalculated: (area: number) => void }) => {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const MapEvents = () => {
    useMapEvents({
      click(e) {
        if (!isDrawing) return;
        setPoints((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      },
    });
    return null;
  };

  const calculateArea = () => {
    if (points.length < 3) return;
    const polygon = turf.polygon([[...points, points[0]]]);
    const area = turf.area(polygon); // This is in square meters
    onAreaCalculated(area);
  };

  return (
    <div className="h-[500px] w-full">
      <button onClick={() => setIsDrawing(!isDrawing)} className="mb-2 rounded bg-cyan-600 px-3 py-1 text-white">
        {isDrawing ? 'Stop Drawing' : 'Start Drawing'}
      </button>
      <button onClick={calculateArea} className="ml-2 rounded bg-green-600 px-3 py-1 text-white">
        Calculate Area
      </button>
      <MapContainer crs={L.CRS.Simple} className="h-full w-full">
        <ImageOverlay url={imageUrl} bounds={[[0, 0], [500, 500]]} />
        <MapEvents />
        {points.length > 0 && <Polygon positions={points} />}
      </MapContainer>
    </div>
  );
};
export default ManualDrawingTool;
