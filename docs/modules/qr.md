# Модуль `qr`

Генерация QR-кода для ссылки на опрос.

## Папка

`src/lib/server/qr/`

## Файлы

- `generate.ts` — обёртка над `qrcode` пакетом

## Публичный интерфейс

```ts
export async function qrPngBase64(
  url: string,
  opts?: { size?: number; margin?: number }
): Promise<string>;     // data:image/png;base64,...

export async function qrPngBuffer(
  url: string,
  opts?: { size?: number; margin?: number }
): Promise<Buffer>;     // для скачивания файлом
```

## Реализация

```ts
import QRCode from 'qrcode';

export async function qrPngBase64(url: string, opts = {}): Promise<string> {
  return QRCode.toDataURL(url, {
    width: opts.size ?? 512,
    margin: opts.margin ?? 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0E2A5C',     // navy
      light: '#FFFFFF'
    }
  });
}
```

## Использование

В `surveys/create.ts` или прямо в endpoint `POST /api/surveys`:

```ts
const url = `${env.PUBLIC_BASE_URL}/r/${code}`;
const qrPngBase64 = await qrPngBase64(url);
return json({ code, url, qrPngBase64 });
```

На дашборде создателя `/s/[code]`:
```svelte
<img src={qrPngBase64} alt="QR код опроса" class="qr" />
```

## Зависимости

- npm: `qrcode`

## Готчи

- `errorCorrectionLevel: 'M'` — баланс между размером и устойчивостью. Для печати на проектор хватает.
- Цвет тёмной части — `#0E2A5C` (фирменный navy). Если опрос в `mono` схеме — оставляем navy для консистентности.
- НЕ генерировать QR на клиенте. Серверная генерация — детерминированна, кешируется (если URL не меняется), и не зависит от рендера на устройстве.
- Для скачивания файлом QR (этап 6 — кнопка "скачать QR") — отдельный endpoint `GET /api/surveys/:code/qr.png` с правильными headers.
