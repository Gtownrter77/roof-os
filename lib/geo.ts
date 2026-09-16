export function shoelaceSqft(ring: [number, number][]): number {
  if (ring.length < 4) return 0
  let area = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i]
    const [lon2, lat2] = ring[i + 1]
    area += (lon2 - lon1) * (lat2 + lat1)
  }
  const lat = ring[0][1] * Math.PI / 180
  const m2PerDegLon = 111320 * Math.cos(lat)
  const m2PerDegLat = 110540
  const m2 = Math.abs(area / 2) * m2PerDegLon * m2PerDegLat / 2
  return m2 * 10.7639
}
