/** Parse "lat, lng" (or swapped) text into [lng, lat] for Java/Indonesia; null if not coordinates. */
export function parseCoordinate(text: string): [number, number] | null {
  const nums = text.replace(/[°]/g, " ").match(/-?\d+(?:[.,]\d+)?/g);
  if (!nums || nums.length !== 2 || !/^[\s\d.,°\-NSEWnsew]+$/.test(text.trim())) return null;
  const [a, b] = nums.map((n) => Number(n.replace(",", ".")));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const valid = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  // Longitude in Indonesia is ~95..141, latitude ~-11..6: pick the order that fits.
  if (Math.abs(a) <= 15 && Math.abs(b) > 15 && valid(a, b)) return [b, a];
  if (Math.abs(b) <= 15 && Math.abs(a) > 15 && valid(b, a)) return [a, b];
  return valid(a, b) ? [b, a] : null;
}
