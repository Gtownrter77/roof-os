'use client';
import React, { useState } from 'react';

type AutoMeasurementToolProps = {
  hasImage: boolean;
  working?: boolean;
  visionAvailable?: boolean;
  onDetect: () => Promise<void> | void;
  onLocalEstimate: () => { pixelArea: number; squareFeet: number | null };
};

export default function AutoMeasurementTool({
  hasImage,
  working = false,
  visionAvailable = false,
  onDetect,
  onLocalEstimate,
}: AutoMeasurementToolProps) {
  const [status, setStatus] = useState('Idle');
  const [error, setError] = useState('');
  const [estimate, setEstimate] = useState('');

  const runAutoDetect = async () => {
    if (!hasImage) {
      setError('Load an inspection or aerial image first.');
      setStatus('Waiting for image');
      return;
    }
    setError('');
    setEstimate('');
    const local = onLocalEstimate();
    setEstimate(
      local.squareFeet
        ? `Local footprint estimate: ${Math.round(local.pixelArea).toLocaleString()} px² · ${local.squareFeet.toFixed(1)} sq ft. Draw or edit the plane to refine it.`
        : `Local footprint estimate: ${Math.round(local.pixelArea).toLocaleString()} px². Add a scale reference to convert to square feet.`,
    );

    if (!visionAvailable) {
      setStatus('Local estimate ready. Vision analysis is unavailable in this environment.');
      return;
    }

    setStatus('Requesting local vision analysis…');
    try {
      await onDetect();
      setStatus('Vision analysis finished. Review every suggested plane, edge, and object before calibration.');
    } catch (err) {
      setStatus('Vision analysis unavailable. Using the local footprint estimate.');
      setError(err instanceof Error ? err.message : 'Auto-detect could not reach the vision service.');
    }
  };

  return (
    <div className="glass mt-4 rounded-xl p-4">
      <h2 className="font-semibold">Auto-Measurement Tool</h2>
      <p className="text-sm text-slate-400">
        Estimate the roof footprint from the loaded image. Vision suggestions are used when the local service is reachable; otherwise the estimate stays client-side and non-authoritative.
      </p>
      <button
        type="button"
        onClick={() => void runAutoDetect()}
        disabled={working || !hasImage}
        className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {working ? 'Working…' : 'Detect Roof'}
      </button>
      {!hasImage && <p className="mt-2 text-xs text-amber-300">Load an actual image before detection.</p>}
      <p className="mt-2 text-sm text-emerald-400">{status}</p>
      {estimate && <p className="mt-2 text-sm text-cyan-200">{estimate}</p>}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
