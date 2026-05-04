<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { PageProps } from './$types';
  import type { CloudWord, ServerMsg } from '$lib/types/cloud';
  import { buildWordCloudOptions } from '$lib/cloud';

  let { data }: PageProps = $props();
  const survey = $derived(data.survey);
  const respondentUrl = $derived(data.respondentUrl);
  const qrPngBase64Data = $derived(data.qrPngBase64Data);
  const creatorToken = $derived(data.creatorToken);

  let canvas = $state<HTMLCanvasElement | null>(null);
  let words = $state<Record<string, CloudWord[]>>({});
  let activeIdx = $state(0);
  let wsState = $state<'connecting' | 'open' | 'closed'>('connecting');
  let totalVotes = $derived(
    Object.values(words).reduce((s, w) => s + w.reduce((a, [, c]) => a + c, 0), 0)
  );

  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const activeQuestion = $derived(survey.questions[activeIdx] ?? survey.questions[0]);
  const activeWords = $derived(words[activeQuestion?.id] ?? []);

  function connect() {
    if (typeof window === 'undefined') return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${location.host}/ws/${survey.code}?t=${encodeURIComponent(creatorToken)}`;
    wsState = 'connecting';
    ws = new WebSocket(url);
    ws.onopen = () => {
      wsState = 'open';
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as ServerMsg;
        if (msg.type === 'snapshot') {
          words = { ...words, [msg.questionId]: msg.words };
        } else if (msg.type === 'closed') {
          ws?.close();
        }
      } catch {
        /* ignore */
      }
    };
    ws.onclose = () => {
      wsState = 'closed';
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      ws?.close();
    };
  }

  onMount(() => connect());

  onDestroy(() => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws && ws.readyState === ws.OPEN) ws.close(1000, 'page unload');
  });

  $effect(() => {
    if (!canvas) return;
    const list = activeWords;
    if (list.length === 0) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      ctx!.fillStyle = '#FFFFFF';
      ctx!.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let cancelled = false;
    void (async () => {
      const WordCloud = (await import('wordcloud')).default;
      if (cancelled) return;
      WordCloud(
        canvas!,
        buildWordCloudOptions(list, survey.colorScheme, survey.customPalette, { baseSize: 20 })
      );
    })();
    return () => {
      cancelled = true;
    };
  });

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  function downloadPng() {
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloud-${survey.code}-q${activeIdx + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function csvUrl(): string {
    return `/api/surveys/${survey.code}/export.csv?t=${encodeURIComponent(creatorToken)}`;
  }

  let finishing = $state(false);
  let finishError = $state<string | null>(null);
  let retrying = $state(false);
  let retryError = $state<string | null>(null);

  async function retrySend() {
    retrying = true;
    retryError = null;
    try {
      const r = await fetch(
        `/api/surveys/${survey.code}/retry?t=${encodeURIComponent(creatorToken)}`,
        { method: 'POST' }
      );
      const data = await r.json();
      if (!r.ok) {
        retryError = data.error?.message ?? `Ошибка ${r.status}`;
        return;
      }
      window.location.reload();
    } catch (e) {
      retryError = (e as Error).message;
    } finally {
      retrying = false;
    }
  }

  async function finishSurvey() {
    if (
      !confirm(
        'Точно завершить опрос?\n\nПосле завершения голосование закроется, агрегат отправится на email создателя. Отменить нельзя.'
      )
    )
      return;
    finishing = true;
    finishError = null;
    try {
      const r = await fetch(
        `/api/surveys/${survey.code}/finish?t=${encodeURIComponent(creatorToken)}`,
        { method: 'POST' }
      );
      const data = await r.json();
      if (!r.ok) {
        finishError = data.error?.message ?? `Ошибка ${r.status}`;
        return;
      }
      // status: 'sent' | 'failed' — перезагружаем страницу чтобы увидеть финал
      window.location.reload();
    } catch (e) {
      finishError = (e as Error).message;
    } finally {
      finishing = false;
    }
  }

  function fmtDate(d: string | Date): string {
    return new Date(d).toLocaleString('ru-RU', { dateStyle: 'long', timeStyle: 'short' });
  }
</script>

<svelte:head><title>Дашборд · {survey.title ?? survey.code}</title></svelte:head>

<header class="title-row">
  <div>
    <h1>{survey.title ?? 'Опрос'}</h1>
    <p class="muted">
      Истекает: {fmtDate(survey.expiresAt)} · Статус: {survey.status} · Голосов: {totalVotes}
    </p>
  </div>
  <div class="title-actions">
    {#if survey.status === 'active'}
      <button class="danger" onclick={finishSurvey} disabled={finishing}>
        {finishing ? 'Завершаем…' : 'Завершить опрос'}
      </button>
    {/if}
    <div class="ws-state ws-{wsState}" title="Соединение с сервером">
      {wsState === 'open'
        ? '● live'
        : wsState === 'connecting'
          ? '○ подключение'
          : '○ переподключение'}
    </div>
  </div>
</header>

{#if finishError}
  <div class="banner-error">{finishError}</div>
{/if}
{#if retryError}
  <div class="banner-error">{retryError}</div>
{/if}

{#if survey.status !== 'active'}
  <div class="banner-info">
    {#if survey.status === 'sent'}
      ✓ Опрос завершён. Письмо с результатами отправлено на <strong>{survey.creatorEmail}</strong>.
    {:else if survey.status === 'failed'}
      ⚠ Опрос завершён, но <strong>письмо не дошло</strong> (проверь сеть/SMTP). Можно скачать CSV
      ниже или повторить отправку:
      <button class="primary inline-btn" onclick={retrySend} disabled={retrying}>
        {retrying ? 'Отправляем…' : 'Повторить отправку'}
      </button>
    {:else if survey.status === 'expired'}
      ⏳ Голосование закрыто, идёт обработка результатов и отправка email…
      <button class="ghost inline-btn" onclick={() => location.reload()}>Обновить</button>
      <br />
      Если состояние не меняется больше минуты — нажми ниже:
      <button class="primary inline-btn" onclick={retrySend} disabled={retrying}>
        {retrying ? 'Отправляем…' : 'Принудительно отправить'}
      </button>
    {:else}
      Статус: {survey.status}. Голосование закрыто.
    {/if}
  </div>
{/if}

<div class="grid">
  <section class="card">
    <h2>Код</h2>
    <div class="big-code">{survey.code}</div>
  </section>

  <section class="card">
    <h2>Ссылка</h2>
    <div class="link-row">
      <code>{respondentUrl}</code>
      <button class="ghost" onclick={() => copy(respondentUrl)}>Копировать</button>
    </div>
  </section>

  <section class="card qr-card">
    <h2>QR-код</h2>
    <img class="qr" src={qrPngBase64Data} alt="QR код опроса" />
  </section>
</div>

<section class="card cloud-card">
  <div class="cloud-head">
    <h2>Облако</h2>
    <div class="cloud-actions">
      <a class="ghost-link" href={csvUrl()}>Скачать CSV</a>
      <button class="ghost" onclick={downloadPng} disabled={activeWords.length === 0}>
        Скачать PNG
      </button>
    </div>
  </div>

  {#if survey.questions.length > 1}
    <div class="tabs">
      {#each survey.questions as q, i (q.id)}
        <button
          type="button"
          class="tab"
          class:active={i === activeIdx}
          onclick={() => (activeIdx = i)}
        >
          {i + 1}. {q.text.length > 30 ? q.text.slice(0, 30) + '…' : q.text}
        </button>
      {/each}
    </div>
  {/if}

  <div class="active-question">{activeQuestion?.text}</div>

  <div class="canvas-wrap">
    {#if activeWords.length === 0}
      <div class="empty">Пока нет ответов. Поделись ссылкой или QR-кодом.</div>
    {/if}
    <canvas bind:this={canvas} width="1200" height="700"></canvas>
  </div>
</section>

<style>
  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-4);
    margin-bottom: var(--space-8);
  }
  h1 {
    margin-bottom: var(--space-1);
  }
  .muted {
    color: var(--c-muted);
    margin: 0;
  }
  .title-actions {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .ws-state {
    font-size: 0.85rem;
    padding: var(--space-1) var(--space-3);
    border-radius: 999px;
    border: 1px solid var(--c-border);
    white-space: nowrap;
  }
  .ws-open {
    color: var(--c-blue);
    border-color: var(--c-blue);
  }
  .ws-connecting {
    color: var(--c-muted);
  }
  .ws-closed {
    color: var(--c-danger);
    border-color: var(--c-danger);
  }

  button.danger {
    background: transparent;
    color: var(--c-danger);
    border: 1px solid var(--c-danger);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius);
    font-weight: 500;
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }
  button.danger:hover {
    background: #fef2f2;
  }
  button.danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .banner-error {
    background: #fef2f2;
    color: var(--c-danger);
    padding: var(--space-3);
    border-radius: var(--radius);
    border: 1px solid #fecaca;
    margin-bottom: var(--space-4);
  }
  .banner-info {
    background: var(--c-surface);
    color: var(--c-text);
    padding: var(--space-4);
    border-radius: var(--radius);
    border-left: 4px solid var(--c-navy);
    margin-bottom: var(--space-4);
    line-height: 1.6;
  }
  .inline-btn {
    margin-left: var(--space-2);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    border: 1px solid transparent;
  }
  .inline-btn.primary {
    background: var(--c-navy);
    color: white;
  }
  .inline-btn.ghost {
    background: transparent;
    color: var(--c-navy);
    border-color: var(--c-border);
  }
  .inline-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .card {
    background: var(--c-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
  }
  .card h2 {
    margin-top: 0;
    font-size: 0.85rem;
    color: var(--c-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  .big-code {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--c-navy);
    letter-spacing: 0.15em;
    font-family: 'SF Mono', Menlo, monospace;
  }
  .link-row {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: stretch;
  }
  .link-row code {
    padding: var(--space-2);
    font-size: 0.875rem;
    word-break: break-all;
    white-space: normal;
    line-height: 1.4;
  }
  .link-row button {
    align-self: flex-start;
  }
  button.ghost {
    background: transparent;
    color: var(--c-navy);
    border: 1px solid var(--c-border);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.875rem;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .qr-card {
    text-align: center;
  }
  .qr {
    width: 180px;
    height: 180px;
    image-rendering: pixelated;
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
  }

  .cloud-card {
    margin-top: var(--space-4);
  }
  .cloud-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .cloud-head h2 {
    margin: 0;
  }
  .cloud-actions {
    display: flex;
    gap: var(--space-2);
  }
  .ghost-link {
    background: transparent;
    color: var(--c-navy);
    border: 1px solid var(--c-border);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.875rem;
    text-decoration: none;
    display: inline-block;
  }
  .ghost-link:hover {
    background: var(--c-surface);
    text-decoration: none;
  }
  .tabs {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    margin-bottom: var(--space-3);
  }
  .tab {
    background: transparent;
    color: var(--c-muted);
    border: 1px solid var(--c-border);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .tab.active {
    background: var(--c-navy);
    color: white;
    border-color: var(--c-navy);
  }
  .active-question {
    font-weight: 500;
    margin-bottom: var(--space-3);
    color: var(--c-text);
  }
  .canvas-wrap {
    position: relative;
    width: 100%;
    aspect-ratio: 12 / 7;
    background: #fff;
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--c-muted);
    z-index: 1;
    pointer-events: none;
    text-align: center;
    padding: var(--space-4);
  }

  @media (max-width: 720px) {
    .title-row {
      flex-direction: column;
      align-items: flex-start;
    }
    .grid {
      grid-template-columns: 1fr;
    }
    .qr-card {
      order: -1;
    }
    .qr {
      width: 200px;
      height: 200px;
    }
    .big-code {
      font-size: 2rem;
      text-align: center;
    }
    .cloud-head {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
    }
    .cloud-actions {
      width: 100%;
    }
    .cloud-actions .ghost-link,
    .cloud-actions button {
      flex: 1;
      text-align: center;
    }
    .canvas-wrap {
      aspect-ratio: 4 / 5;
    }
    .tabs {
      overflow-x: auto;
      flex-wrap: nowrap;
    }
    .tab {
      white-space: nowrap;
      flex-shrink: 0;
    }
  }
</style>
