<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();

  type Question = { text: string; answerType: 'single' | 'multi' };
  type CreateResult = {
    code: string;
    url: string;
    dashboardUrl: string;
    qrPngBase64: string;
    expiresAt: string;
  };

  let title = $state('');
  let caseSensitive = $state(false);
  let colorScheme = $state<'mono' | 'random' | 'custom'>('mono');
  let customPalette = $state<string[]>(['#0E2A5C']);
  let durationPreset = $state<'1h' | '1d' | '7d' | 'custom'>('1d');
  let customExpiresAt = $state('');
  let questions = $state<Question[]>([{ text: '', answerType: 'single' }]);

  let submitting = $state(false);
  let result = $state<CreateResult | null>(null);
  let errorMessage = $state<string | null>(null);

  function addQuestion() {
    if (questions.length < 50) questions.push({ text: '', answerType: 'single' });
  }
  function removeQuestion(i: number) {
    if (questions.length > 1) questions.splice(i, 1);
  }
  function addColor() {
    if (customPalette.length < 10) customPalette.push('#2D9FDA');
  }
  function removeColor(i: number) {
    if (customPalette.length > 1) customPalette.splice(i, 1);
  }

  function computeExpiresAt(): string {
    const now = Date.now();
    if (durationPreset === '1h') return new Date(now + 60 * 60 * 1000).toISOString();
    if (durationPreset === '1d') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
    if (durationPreset === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    return new Date(customExpiresAt).toISOString();
  }

  async function submit() {
    submitting = true;
    errorMessage = null;
    try {
      const body = {
        title: title.trim() || undefined,
        caseSensitive,
        colorScheme,
        customPalette: colorScheme === 'custom' ? customPalette : undefined,
        expiresAt: computeExpiresAt(),
        questions: questions.map((q) => ({ text: q.text.trim(), answerType: q.answerType }))
      };
      const r = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) {
        const issue = data.error?.issues?.[0];
        errorMessage = issue
          ? `${issue.path?.join('.') ?? ''}: ${issue.message}`
          : (data.error?.message ?? `Ошибка ${r.status}`);
        return;
      }
      result = data;
    } catch (e) {
      errorMessage = (e as Error).message;
    } finally {
      submitting = false;
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }
</script>

<svelte:head><title>Новый опрос — Облако тегов 2090</title></svelte:head>

{#if result}
  <h1>Опрос создан</h1>
  <p class="muted">Сохрани ссылку на дашборд — это единственный способ его открыть.</p>

  <section class="card">
    <h2>Код комнаты</h2>
    <div class="big-code">{result.code}</div>
  </section>

  <section class="card">
    <h2>Ссылка для респондентов</h2>
    <div class="link-row">
      <code>{result.url}</code>
      <button class="ghost" onclick={() => copy(result!.url)}>Копировать</button>
    </div>
    <img class="qr" src={result.qrPngBase64} alt="QR код" />
  </section>

  <section class="card">
    <h2>Ссылка на дашборд (только для тебя)</h2>
    <div class="link-row">
      <code class="small">{result.dashboardUrl}</code>
      <button class="ghost" onclick={() => copy(result!.dashboardUrl)}>Копировать</button>
    </div>
    <a class="primary" href={result.dashboardUrl}>Открыть дашборд →</a>
  </section>

  <button class="ghost" onclick={() => (result = null)}>Создать ещё один опрос</button>
{:else}
  <h1>Создать опрос</h1>
  <p class="muted">Результаты придут на <strong>{data.email}</strong> по истечении срока.</p>

  <form
    onsubmit={(e) => {
      e.preventDefault();
      submit();
    }}
  >
    <label>
      <span>Название (необязательно)</span>
      <input type="text" bind:value={title} maxlength="200" placeholder="Опрос по математике" />
    </label>

    <fieldset>
      <legend>Срок действия</legend>
      <div class="radios">
        <label class="radio"
          ><input type="radio" bind:group={durationPreset} value="1h" /> 1 час</label
        >
        <label class="radio"
          ><input type="radio" bind:group={durationPreset} value="1d" /> 1 день</label
        >
        <label class="radio"
          ><input type="radio" bind:group={durationPreset} value="7d" /> 1 неделя</label
        >
        <label class="radio"
          ><input type="radio" bind:group={durationPreset} value="custom" /> Указать дату</label
        >
      </div>
      {#if durationPreset === 'custom'}
        <input type="datetime-local" bind:value={customExpiresAt} required />
      {/if}
    </fieldset>

    <label class="check">
      <input type="checkbox" bind:checked={caseSensitive} />
      <span>Учитывать регистр (Россия и россия — разные слова)</span>
    </label>

    <fieldset>
      <legend>Цветовая схема облака</legend>
      <div class="radios">
        <label class="radio"
          ><input type="radio" bind:group={colorScheme} value="mono" /> Чёрно-белая</label
        >
        <label class="radio"
          ><input type="radio" bind:group={colorScheme} value="random" /> Случайные цвета бренда</label
        >
        <label class="radio"
          ><input type="radio" bind:group={colorScheme} value="custom" /> Своя палитра</label
        >
      </div>
      {#if colorScheme === 'custom'}
        <div class="palette">
          {#each customPalette as _, i (i)}
            <div class="color-row">
              <input type="color" bind:value={customPalette[i]} />
              <input type="text" bind:value={customPalette[i]} pattern="^#[0-9A-Fa-f]{'{6}'}$" />
              <button
                type="button"
                class="ghost mini"
                onclick={() => removeColor(i)}
                disabled={customPalette.length === 1}>×</button
              >
            </div>
          {/each}
          <button
            type="button"
            class="ghost"
            onclick={addColor}
            disabled={customPalette.length >= 10}
          >
            + Добавить цвет ({customPalette.length}/10)
          </button>
        </div>
      {/if}
    </fieldset>

    <fieldset>
      <legend>Вопросы ({questions.length}/50)</legend>
      {#each questions as _, i (i)}
        <div class="question">
          <div class="q-head">
            <strong>Вопрос {i + 1}</strong>
            <button
              type="button"
              class="ghost mini"
              onclick={() => removeQuestion(i)}
              disabled={questions.length === 1}>×</button
            >
          </div>
          <textarea
            bind:value={questions[i].text}
            required
            maxlength="500"
            placeholder="Опишите одним словом ваше настроение"
          ></textarea>
          <div class="radios">
            <label class="radio"
              ><input type="radio" bind:group={questions[i].answerType} value="single" /> Одно слово</label
            >
            <label class="radio"
              ><input type="radio" bind:group={questions[i].answerType} value="multi" /> Несколько слов</label
            >
          </div>
        </div>
      {/each}
      <button type="button" class="ghost" onclick={addQuestion} disabled={questions.length >= 50}>
        + Добавить вопрос
      </button>
    </fieldset>

    {#if errorMessage}
      <div class="error">{errorMessage}</div>
    {/if}

    <button type="submit" class="primary" disabled={submitting}>
      {submitting ? 'Создаём…' : 'Создать опрос'}
    </button>
  </form>
{/if}

<style>
  h1 {
    margin-bottom: var(--space-2);
  }
  .muted {
    color: var(--c-muted);
    margin-bottom: var(--space-8);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  label,
  fieldset {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border: 0;
    padding: 0;
    margin: 0;
  }
  fieldset {
    background: var(--c-surface);
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }
  legend {
    font-weight: 600;
    color: var(--c-navy);
    padding: 0;
    margin-bottom: var(--space-2);
  }
  label > span {
    font-weight: 500;
    color: var(--c-text);
  }
  input[type='text'],
  input[type='datetime-local'],
  textarea {
    font-family: inherit;
    font-size: 1rem;
    padding: var(--space-3);
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
    background: var(--c-bg);
    width: 100%;
  }
  input[type='color'] {
    width: 48px;
    height: 36px;
    padding: 0;
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
  }
  textarea {
    min-height: 60px;
    resize: vertical;
  }
  .radios {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .radio {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    flex-direction: row;
  }
  .check {
    flex-direction: row;
    align-items: center;
    gap: var(--space-3);
  }
  .palette {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }
  .color-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }
  .color-row input[type='text'] {
    flex: 1;
    max-width: 120px;
  }
  .question {
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
  }
  .q-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  button {
    background: var(--c-navy);
    color: white;
    border: 0;
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius);
    font-weight: 500;
    font-size: 1rem;
  }
  button.primary {
    background: var(--c-navy);
  }
  button.ghost {
    background: transparent;
    color: var(--c-navy);
    border: 1px solid var(--c-border);
  }
  button.mini {
    padding: var(--space-1) var(--space-3);
    font-size: 1.2rem;
    line-height: 1;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  a.primary {
    background: var(--c-navy);
    color: white;
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius);
    text-decoration: none;
    font-weight: 500;
    display: inline-block;
    margin-top: var(--space-3);
  }
  .error {
    background: #fef2f2;
    color: var(--c-danger);
    padding: var(--space-3);
    border-radius: var(--radius);
    border: 1px solid #fecaca;
  }
  .card {
    background: var(--c-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-4);
  }
  .card h2 {
    margin-top: 0;
    font-size: 1rem;
    color: var(--c-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  .big-code {
    font-size: 3rem;
    font-weight: 700;
    color: var(--c-navy);
    letter-spacing: 0.15em;
    font-family: 'SF Mono', Menlo, monospace;
  }
  .link-row {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    flex-wrap: wrap;
  }
  .link-row code {
    flex: 1;
    overflow-x: auto;
    white-space: nowrap;
    padding: var(--space-3);
    font-size: 1rem;
  }
  .link-row code.small {
    font-size: 0.8rem;
  }
  .qr {
    margin-top: var(--space-4);
    width: 256px;
    height: 256px;
    max-width: 100%;
    image-rendering: pixelated;
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
  }

  @media (max-width: 480px) {
    fieldset {
      padding: var(--space-3);
    }
    .question {
      padding: var(--space-3);
    }
    .radios {
      gap: var(--space-2);
    }
    button.primary,
    a.primary {
      width: 100%;
      text-align: center;
      padding: var(--space-4);
    }
    .big-code {
      font-size: 2rem;
      word-break: break-all;
    }
    .link-row {
      flex-direction: column;
      align-items: stretch;
    }
    .link-row code {
      white-space: normal;
      word-break: break-all;
    }
    .link-row button {
      width: 100%;
    }
    .qr {
      width: 100%;
      height: auto;
      aspect-ratio: 1;
    }
  }
</style>
