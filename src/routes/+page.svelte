<script lang="ts">
  import type { PageProps } from './$types';
  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Облако тегов — Школа №2090</title>
</svelte:head>

<section class="hero">
  <h1>Облако тегов</h1>
  <p class="lead">
    Анонимные опросы для школьных мероприятий. Респонденты отвечают одним или несколькими словами,
    результаты собираются в живое облако тегов.
  </p>

  {#if data.user}
    <div class="cta-row">
      <a class="btn btn-primary btn-lg" href="/my">Мои опросы →</a>
      <a class="btn btn-ghost btn-lg" href="/new">Создать новый</a>
    </div>
  {:else}
    <div class="cta-row">
      <a class="btn btn-primary btn-lg" href="/register">Создать аккаунт →</a>
      <a class="btn btn-ghost btn-lg" href="/login">Войти</a>
    </div>
  {/if}
</section>

<section class="how">
  <h2>Как это работает</h2>
  <ol>
    <li>
      <strong>Создайте опрос.</strong> Один или несколько вопросов, срок действия от часа до недели.
    </li>
    <li>
      <strong>Поделитесь ссылкой или QR-кодом.</strong> Респонденты отвечают анонимно, без регистрации.
    </li>
    <li>
      <strong>Получите результаты на email.</strong> Изображения облаков и таблица CSV придут автоматически.
    </li>
  </ol>
</section>

<style>
  .hero {
    padding: var(--space-8) 0 var(--space-12);
  }
  h1 {
    font-size: 2.25rem;
    margin-bottom: var(--space-3);
  }
  .lead {
    color: var(--c-muted);
    font-size: 1.0625rem;
    max-width: 56ch;
    line-height: 1.6;
    margin: 0 0 var(--space-6);
  }
  .cta-row {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .how {
    border-top: 1px solid var(--c-border);
    padding-top: var(--space-8);
  }
  .how h2 {
    font-size: 1rem;
    color: var(--c-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    margin-bottom: var(--space-4);
  }
  .how ol {
    list-style: none;
    counter-reset: step;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-6);
  }
  .how li {
    counter-increment: step;
    color: var(--c-muted);
    font-size: 0.9375rem;
    line-height: 1.5;
    padding-left: var(--space-8);
    position: relative;
    min-height: 32px;
  }
  .how li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--c-surface);
    color: var(--c-navy);
    font-weight: 600;
    font-size: 0.875rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .how li strong {
    color: var(--c-text);
    font-weight: 500;
  }

  @media (max-width: 480px) {
    h1 {
      font-size: 1.75rem;
    }
    .lead {
      font-size: 1rem;
    }
    .cta-row .btn {
      width: 100%;
    }
  }
</style>
