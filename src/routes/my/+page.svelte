<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();

  function fmtDate(d: Date | string): string {
    return new Date(d).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
  }

  function statusLabel(s: string): { text: string; className: string } {
    switch (s) {
      case 'active': return { text: 'Активен', className: 'st-active' };
      case 'sent': return { text: 'Завершён, письмо отправлено', className: 'st-sent' };
      case 'failed': return { text: 'Завершён, ошибка отправки', className: 'st-failed' };
      case 'expired': return { text: 'Истёк', className: 'st-expired' };
      default: return { text: s, className: '' };
    }
  }

  function copy(text: string, e: Event) {
    e.preventDefault();
    navigator.clipboard.writeText(text);
  }

  let finishing = $state<string | null>(null);
  let retrying = $state<string | null>(null);

  async function finishSurvey(code: string) {
    if (!confirm('Точно завершить опрос ' + code + '? Голосование закроется, отчёт уйдёт на email.')) return;
    finishing = code;
    try {
      const r = await fetch(`/api/surveys/${code}/finish`, { method: 'POST' });
      if (r.ok) {
        location.reload();
      } else {
        const data = await r.json().catch(() => ({}));
        alert(data?.error?.message ?? `Ошибка ${r.status}`);
      }
    } finally {
      finishing = null;
    }
  }

  async function retrySend(code: string) {
    retrying = code;
    try {
      const r = await fetch(`/api/surveys/${code}/retry`, { method: 'POST' });
      if (r.ok) {
        location.reload();
      } else {
        const data = await r.json().catch(() => ({}));
        alert(data?.error?.message ?? `Ошибка ${r.status}`);
      }
    } finally {
      retrying = null;
    }
  }
</script>

<svelte:head><title>Мои опросы — Облако тегов 2090</title></svelte:head>

<div class="head">
  <h1>Мои опросы</h1>
  <a class="cta" href="/new">+ Создать опрос</a>
</div>

{#if data.surveys.length === 0}
  <div class="empty">
    <p>У тебя пока нет опросов.</p>
    <a class="cta" href="/new">Создать первый</a>
  </div>
{:else}
  <ul class="list">
    {#each data.surveys as s (s.code)}
      {@const status = statusLabel(s.status)}
      <li class="card">
        <div class="card-head">
          <a class="title" href={`/s/${s.code}`}>
            {s.title ?? `Опрос ${s.code}`}
          </a>
          <span class="status {status.className}">{status.text}</span>
        </div>
        <div class="meta">
          <code class="code">{s.code}</code>
          <span class="dot">·</span>
          <span>{s.questionsCount} вопрос(а)</span>
          <span class="dot">·</span>
          <span>{s.responsesCount} голос(ов)</span>
          <span class="dot">·</span>
          <span>истекает {fmtDate(s.expiresAt)}</span>
        </div>
        <div class="actions">
          <a class="btn" href={`/s/${s.code}`}>Дашборд</a>
          <a class="btn ghost" href={`/r/${s.code}`} target="_blank" rel="noopener">Ссылка для голосования ↗</a>
          <button class="btn ghost" onclick={(e) => copy(`${location.origin}/r/${s.code}`, e)}>Копировать ссылку</button>
          {#if s.status === 'active'}
            <button class="btn danger" onclick={() => finishSurvey(s.code)} disabled={finishing === s.code}>
              {finishing === s.code ? 'Завершаем…' : 'Завершить'}
            </button>
          {:else if s.status === 'failed' || s.status === 'expired'}
            <button class="btn" onclick={() => retrySend(s.code)} disabled={retrying === s.code}>
              {retrying === s.code ? 'Отправляем…' : 'Повторить отправку'}
            </button>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
  }
  h1 { margin: 0; }
  .cta {
    background: var(--c-navy);
    color: white;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius);
    text-decoration: none;
    font-weight: 500;
  }
  .empty {
    text-align: center;
    padding: var(--space-12) 0;
    color: var(--c-muted);
  }
  .empty p { margin-bottom: var(--space-4); }
  .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: var(--space-3); }
  .card {
    background: var(--c-surface);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
    margin-bottom: var(--space-2);
  }
  .title {
    font-weight: 500;
    color: var(--c-navy);
    text-decoration: none;
    font-size: 1.0625rem;
  }
  .title:hover { text-decoration: underline; }
  .status {
    font-size: 0.8rem;
    padding: 2px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .st-active { background: #DBEAFE; color: #1E3A8A; }
  .st-sent { background: #DCFCE7; color: #166534; }
  .st-failed { background: #FEE2E2; color: #991B1B; }
  .st-expired { background: #F3F4F6; color: #4B5563; }
  .meta {
    color: var(--c-muted);
    font-size: 0.875rem;
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
    margin-bottom: var(--space-3);
  }
  .meta .dot { opacity: 0.5; }
  .code {
    font-family: 'SF Mono', Menlo, monospace;
    background: var(--c-bg);
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--c-navy);
    font-weight: 600;
  }
  .actions {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .btn {
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius);
    font-size: 0.875rem;
    font-weight: 500;
    background: var(--c-navy);
    color: white;
    text-decoration: none;
    border: 0;
    font-family: inherit;
    cursor: pointer;
  }
  .btn.ghost {
    background: transparent;
    color: var(--c-navy);
    border: 1px solid var(--c-border);
  }
  .btn.danger {
    background: transparent;
    color: var(--c-danger);
    border: 1px solid var(--c-danger);
  }
  .btn.danger:hover { background: #fef2f2; }
  .btn.danger:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn:hover { text-decoration: none; }

  @media (max-width: 640px) {
    .head {
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-3);
    }
    .cta { text-align: center; }
    .card-head { flex-direction: column; align-items: flex-start; }
    .meta { font-size: 0.8125rem; }
    .actions { display: grid; grid-template-columns: 1fr; gap: var(--space-2); }
    .btn { text-align: center; padding: var(--space-3); }
  }
</style>
