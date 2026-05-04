import type { CloudWord, ColorScheme } from './types/cloud';
import { palette as brand } from './theme';

const BRAND_PALETTE = [brand.navy, brand.blue, brand.gold];

export function colorPicker(scheme: ColorScheme, palette?: string[] | null): () => string {
  if (scheme === 'mono') return () => brand.navy;
  if (scheme === 'random') {
    return () => BRAND_PALETTE[Math.floor(Math.random() * BRAND_PALETTE.length)];
  }
  if (scheme === 'custom' && palette && palette.length > 0) {
    const p = palette;
    return () => p[Math.floor(Math.random() * p.length)];
  }
  return () => brand.navy;
}

export function weightFactor(words: CloudWord[], baseSize: number) {
  const max = Math.max(1, ...words.map((w) => w[1]));
  const denom = Math.log2(max + 1);
  return (count: number) => baseSize * (1 + (Math.log2(count + 1) / denom) * 3);
}

export function buildWordCloudOptions(
  words: CloudWord[],
  scheme: ColorScheme,
  palette: string[] | null,
  opts: { baseSize?: number; backgroundColor?: string; fontFamily?: string } = {}
) {
  return {
    list: words,
    weightFactor: weightFactor(words, opts.baseSize ?? 18),
    color: colorPicker(scheme, palette),
    backgroundColor: opts.backgroundColor ?? '#FFFFFF',
    fontFamily: opts.fontFamily ?? "'Inter', sans-serif",
    rotateRatio: 0,
    shrinkToFit: true,
    minSize: 10,
    gridSize: 8,
    drawOutOfBound: false
  };
}
