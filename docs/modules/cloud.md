# Модуль `cloud`

Агрегация частот слов и рендер облака — на клиенте (live preview) и на сервере (PNG для email/snapshot).

## Папка

- `src/lib/cloud.ts` — общие утилиты для клиента (выбор цвета, лог-шкала)
- `src/lib/server/cloud/` — серверные функции

## Файлы

- `lib/cloud.ts`:
  - `weightFunction(count, maxCount, baseSize)` — лог-шкала размеров
  - `colorPicker(scheme, palette?)` — фабрика функции цвета для wordcloud2
- `lib/server/cloud/aggregate.ts` — агрегация по `responses` для одного вопроса
- `lib/server/cloud/render-png.ts` — серверный рендер через `node-canvas` + `wordcloud2`

## Публичный интерфейс

```ts
// lib/cloud.ts
export type CloudWord = [string, number];
export type ColorScheme = 'mono' | 'random' | 'custom';

export function weightFunction(opts: { baseSize: number }): (count: number) => number;
export function colorPicker(scheme: ColorScheme, palette?: string[]): () => string;

export type WordCloud2Options = {
  list: CloudWord[];
  weightFactor: (count: number) => number;
  color: string | (() => string);
  backgroundColor: string;
  fontFamily: string;
  rotateRatio: number;       // 0 — без поворотов, ТЗ требует читаемости
  shrinkToFit: boolean;
};

export function buildOptions(words: CloudWord[], scheme: ColorScheme, palette?: string[]): WordCloud2Options;

// lib/server/cloud/aggregate.ts
export async function aggregateQuestion(
  questionId: string,
  topN: number = 100
): Promise<CloudWord[]>;

// lib/server/cloud/render-png.ts
export async function renderPng(
  words: CloudWord[],
  scheme: ColorScheme,
  palette: string[] | null,
  size: { width: number; height: number } = { width: 1200, height: 800 }
): Promise<Buffer>;
```

## Использование на клиенте (дашборд)

```svelte
<script lang="ts">
  import WordCloud from 'wordcloud';
  import { buildOptions } from '$lib/cloud';

  let canvas: HTMLCanvasElement;
  let words: CloudWord[] = [];   // из WS

  $effect(() => {
    if (canvas && words.length) {
      WordCloud(canvas, buildOptions(words, scheme, palette));
    }
  });
</script>

<canvas bind:this={canvas} width="1200" height="800"></canvas>
```

## Использование на сервере (PNG)

```ts
import { createCanvas } from 'canvas';
import WordCloud from 'wordcloud';   // npm: wordcloud@1 — работает и в Node

const canvas = createCanvas(1200, 800);
WordCloud(canvas as any, buildOptions(words, scheme, palette));
return canvas.toBuffer('image/png');
```

## Лог-шкала

```ts
weightFactor: (count) => {
  const max = Math.max(...words.map(w => w[1]));
  return baseSize * (1 + Math.log2(count + 1) / Math.log2(max + 1));
}
```

`baseSize=20` → топ-1 ≈ 40px, частота 1 ≈ 20px. Подбираем эмпирически на этапе 4.

## Цветовые схемы

```ts
const PALETTE = ['#0E2A5C', '#2D9FDA', '#E0B73A'];

function colorPicker(scheme, palette) {
  if (scheme === 'mono') return () => '#0E2A5C';
  if (scheme === 'random') return () => PALETTE[Math.floor(Math.random() * PALETTE.length)];
  if (scheme === 'custom') return () => palette![Math.floor(Math.random() * palette!.length)];
}
```

## Зависимости

- npm: `wordcloud` (v1.x), `canvas` (для серверного рендера, etap 5)

## Готчи

- `wordcloud` пакет (НЕ `wordcloud2.js` через CDN) — npm-версия работает в обоих средах.
- `canvas` (node-canvas) требует системных библ: на Mac `brew install pkg-config cairo pango libpng jpeg giflib librsvg`. В Docker (alpine) — `apk add cairo-dev pango-dev jpeg-dev giflib-dev`. На этапе 5 закладываем в Dockerfile.
- Серверный рендер канваса — синхронный по сути; для опроса с 1000 голосов завершается за ≤300ms на одном ядре. Не блокируем event loop надолго.
- НЕ показывать числа возле слов — в `wordcloud` это и так не делается, но не добавляйте свои `<text>` overlay сверху.
- `rotateRatio: 0` — без вертикальных слов. Кириллица плохо читается под углом.
- Для серверного PNG ВАЖНО шрифт: либо встроенный (Sans-serif), либо подгружать через `registerFont()` (этап 6 — фирменный Inter).
- Если у вопроса 0 ответов — рендерить заглушку "пока нет ответов" вместо пустого канваса.
