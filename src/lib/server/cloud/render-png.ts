import { createCanvas } from 'canvas';
import cloud, { type Word } from 'd3-cloud';
import { colorPicker, weightFactor } from '$lib/cloud';
import type { CloudWord, ColorScheme } from '$lib/types/cloud';

type CloudInput = Word & { text: string; size: number };

export type RenderSize = { width: number; height: number };

const DEFAULT_SIZE: RenderSize = { width: 1200, height: 800 };
const FONT = 'sans-serif';

function drawEmpty(width: number, height: number, message: string): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#6B7280';
  ctx.font = `28px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height / 2);
  return canvas.toBuffer('image/png');
}

export async function renderPng(
  words: CloudWord[],
  scheme: ColorScheme,
  palette: string[] | null,
  size: RenderSize = DEFAULT_SIZE
): Promise<Buffer> {
  if (words.length === 0) return drawEmpty(size.width, size.height, 'Нет ответов');

  const wf = weightFactor(words, 28);
  const color = colorPicker(scheme, palette);

  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size.width, size.height);

  await new Promise<void>((resolve, reject) => {
    const layout = cloud<CloudInput>()
      .size([size.width, size.height])
      .canvas(() => createCanvas(1, 1) as unknown as HTMLCanvasElement)
      .words(words.map(([text, count]) => ({ text, size: wf(count) })))
      .padding(4)
      .rotate(() => 0)
      .font(FONT)
      .fontSize((d) => d.size as number)
      .on('end', (placed: CloudInput[]) => {
        ctx.save();
        ctx.translate(size.width / 2, size.height / 2);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (const w of placed) {
          ctx.font = `${w.size}px ${FONT}`;
          ctx.fillStyle = color();
          ctx.save();
          ctx.translate(w.x ?? 0, w.y ?? 0);
          ctx.rotate(((w.rotate ?? 0) * Math.PI) / 180);
          ctx.fillText(w.text ?? '', 0, 0);
          ctx.restore();
        }
        ctx.restore();
        resolve();
      });
    try {
      layout.start();
    } catch (e) {
      reject(e);
    }
  });

  return canvas.toBuffer('image/png');
}
