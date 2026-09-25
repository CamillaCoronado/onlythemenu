/** 12–16 point starburst polygon, centered in a size×size box */
export function starPoints(points = 14, size = 100, inner = 0.78, jitter = 0.04): string {
  const c = size / 2;
  const out: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    // deterministic wobble so it looks hand-cut, not generated
    const w = 1 + (i % 3 === 0 ? jitter : i % 3 === 1 ? -jitter : 0);
    const r = (i % 2 === 0 ? c : c * inner) * w * 0.94;
    out.push(`${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`);
  }
  return out.join(' ');
}
