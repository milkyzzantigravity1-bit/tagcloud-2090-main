<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  type ScreenState = 'form' | 'sending' | 'sent' | 'already' | 'closed';
  let screen = $state<ScreenState>(data.expired ? 'closed' : 'form');

  // ответы: questionId -> string[]
  let answers = $state<Record<string, string[]>>(
    Object.fromEntries(data.survey.questions.map((q) => [q.id, ['']]))
  );

  let errorMessage = $state<string | null>(null);
  let errorQuestionId = $state<string | null>(null);

  const survey = data.survey;
  const VOTED_KEY = `voted:${survey.code}`;

  onMount(() => {
    if (screen === 'form' && typeof localStorage !== 'undefined') {
      if (localStorage.getItem(VOTED_KEY)) screen = 'already';
    }
  });

  function stripWhitespace(s: string): string {
    return s.replace(/\s+/g, '');
  }

  function onSingleInput(qid: string, value: string) {
    answers[qid][0] = stripWhitespace(value);
  }

  function onMultiInput(qid: string, idx: number, value: string) {
    answers[qid][idx] = stripWhitespace(value);
  }

  function addWord(qid: string) {
    if (answers[qid].length < 20) answers[qid].push('');
  }

  function removeWord(qid: string, idx: number) {
    if (answers[qid].length > 1) answers[qid].splice(idx, 1);
  }

  function blockSpace(e: KeyboardEvent) {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
    }
  }

  async function submit() {
    errorMessage = null;
    errorQuestionId = null;

    const payload = {
      answers: survey.questions
        .map((q) => ({
          questionId: q.id,
          words: (answers[q.id] ?? []).map((w) => w.trim()).filter((w) => w.length > 0)
        }))
        .filter((a) => a.words.length > 0)
    };

    if (payload.answers.length === 0) {
      errorMessage = 'Заполни хотя бы один ответ';
      return;
    }

    screen = 'sending';
    try {
      const r = await fetch(`/api/surveys/${survey.code}/answer`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await r.json().catch(() => null);

      if (r.ok) {
        try { localStorage.setItem(VOTED_KEY, '1'); } catch {}
        screen = 'sent';
        return;
      }
      if (r.status === 409) {
        try { localStorage.setItem(VOTED_KEY, '1'); } catch {}
        screen = 'already';
        return;
      }
      if (r.status === 410) {
        screen = 'closed';
        return;
      }
      errorQuestionId = data?.error?.questionId ?? null;
      errorMessage = data?.error?.message ?? `Ошибка ${r.status}`;
      screen = 'form';
    } catch (e) {
      errorMessage = (e as Error).message;
      screen = 'form';
    }
  }
</script>

<svelte:head><title>{survey.title ?? 'Опрос ' + survey.code}</title></svelte:head>

{#if screen === 'closed'}
  <div class="centered">
    <h1>Опрос завершён</h1>
    <p class="muted">Голосование больше не принимается. Спасибо за интерес!</p>
  </div>
{:else if screen === 'sent'}
  <div class="centered">
    <div class="check">✓</div>
    <h1>Спасибо!</h1>
    <p class="muted">Твой ответ записан. Облако появится у организатора.</p>
  </div>
{:else if screen === 'already'}
  <div class="centered">
    <h1>Ты уже отвечал</h1>
    <p class="muted">Один человек — один ответ. Спасибо за участие!</p>
  </div>
{:else}
  <h1>{survey.title ?? 'Опрос'}</h1>
  <p class="muted">Анонимно. Без регистрации.</p>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      submit();
    }}
  >
    {#each survey.questions as q, i (q.id)}
      <fieldset class="question" class:has-error={errorQuestionId === q.id}>
        <legend>
          <span class="num">{i + 1}.</span>
          {q.text}
        </legend>

        {#if q.answerType === 'single'}
          <input
            type="text"
            value={answers[q.id][0] ?? ''}
            oninput={(e) => onSingleInput(q.id, e.currentTarget.value)}
            onkeydown={blockSpace}
            maxlength="50"
            placeholder="одно слово"
            autocomplete="off"
          />
          <div class="hint">Только одно слово, без пробелов</div>
        {:else}
          <div class="multi">
            {#each answers[q.id] as _, idx (idx)}
              <div class="row">
                <input
                  type="text"
                  value={answers[q.id][idx] ?? ''}
                  oninput={(e) => onMultiInput(q.id, idx, e.currentTarget.value)}
                  onkeydown={blockSpace}
                  maxlength="50"
                  placeholder="слово"
                  autocomplete="off"
                />
                <button
                  type="button"
                  class="ghost mini"
                  onclick={() => removeWord(q.id, idx)}
                  disabled={answers[q.id].length === 1}
                  aria-label="Удалить слово"
                >
                  ×
                </button>
              </div>
            {/each}
            {#if answers[q.id].length < 20}
              <button type="button" class="ghost" onclick={() => addWord(q.id)}>
                + слово ({answers[q.id].length}/20)
              </button>
            {/if}
          </div>
        {/if}
      </fieldset>
    {/each}

    {#if errorMessage}
      <div class="error">{errorMessage}</div>
    {/if}

    <button type="submit" class="primary" disabled={screen === 'sending'}>
      {screen === 'sending' ? 'Отправляем…' : 'Отправить'}
    </button>
  </form>
{/if}

<style>
  h1 { margin-bottom: var(--space-2); }
  .muted { color: var(--c-muted); }
  .centered {
    text-align: center;
    padding: var(--space-12) 0;
  }
  .check {
    font-size: 4rem;
    color: var(--c-blue);
    line-height: 1;
    margin-bottom: var(--space-4);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
    margin-top: var(--space-8);
  }
  .question {
    background: var(--c-surface);
    border: 1px solid transparent;
    padding: var(--space-4);
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
  }
  .question.has-error {
    border-color: var(--c-danger);
    background: #fef2f2;
  }
  legend {
    font-weight: 500;
    font-size: 1.0625rem;
    padding: 0;
    margin-bottom: var(--space-2);
  }
  .num {
    color: var(--c-muted);
    font-weight: 600;
    margin-right: var(--space-2);
  }
  input[type='text'] {
    font-family: inherit;
    font-size: 1rem;
    padding: var(--space-3);
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
    background: var(--c-bg);
    width: 100%;
    min-width: 0;
    /* предотвращает auto-zoom на iOS Safari (font-size <16px вызывает zoom) */
    -webkit-appearance: none;
    appearance: none;
  }
  /* iOS не зумит инпут с font-size >= 16px */
  @supports (-webkit-touch-callout: none) {
    input[type='text'] { font-size: 16px; }
  }
  .hint {
    color: var(--c-muted);
    font-size: 0.875rem;
  }
  .multi {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .row {
    display: flex;
    gap: var(--space-2);
  }
  .row input {
    flex: 1;
  }
  button {
    background: var(--c-navy);
    color: white;
    border: 0;
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius);
    font-weight: 500;
    font-size: 1rem;
    font-family: inherit;
  }
  button.ghost {
    background: transparent;
    color: var(--c-navy);
    border: 1px solid var(--c-border);
  }
  button.mini {
    padding: var(--space-2) var(--space-3);
    font-size: 1.2rem;
    line-height: 1;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .error {
    background: #fef2f2;
    color: var(--c-danger);
    padding: var(--space-3);
    border-radius: var(--radius);
    border: 1px solid #fecaca;
  }

  @media (max-width: 480px) {
    form { gap: var(--space-4); }
    .question { padding: var(--space-3); }
    legend { font-size: 1rem; }
    button.primary { width: 100%; padding: var(--space-4); font-size: 1.0625rem; }
    button.mini {
      min-width: 44px;
      min-height: 44px;
      padding: 0;
    }
    .row { gap: var(--space-2); }
  }
</style>
