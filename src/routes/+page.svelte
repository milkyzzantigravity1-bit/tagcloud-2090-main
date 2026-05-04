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
    Анонимные опросы для школьных мероприятий. Респонденты отвечают одним
    или несколькими словами, результаты собираются в живое облако тегов.
  </p>

  {#if data.user}
    <div class="cta-row">
      <a class="cta primary" href="/my">Мои опросы →</a>
      <a class="cta ghost" href="/new">Создать новый</a>
    </div>
  {:else}
    <div class="cta-row">
      <a class="cta primary" href="/register">Создать аккаунт →</a>
      <a class="cta ghost" href="/login">Войти</a>
    </div>
    <p class="hint">Регистрация — только для создателей опросов. Респонденты заходят анонимно по ссылке или QR.</p>
  {/if}
</section>

<section class="features">
  <div class="feature">
    <div class="ico">🎓</div>
    <h2>Без регистрации респондентов</h2>
    <p>Достаточно открыть ссылку или отсканировать QR-код. IP не сохраняется.</p>
  </div>
  <div class="feature">
    <div class="ico">📊</div>
    <h2>Облако в реальном времени</h2>
    <p>Каждый ответ моментально видно на дашборде создателя.</p>
  </div>
  <div class="feature">
    <div class="ico">📩</div>
    <h2>Результаты по email</h2>
    <p>По истечении срока опроса картинка облака и CSV-таблица придут на твою почту.</p>
  </div>
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
  .hint {
    color: var(--c-muted);
    font-size: 0.875rem;
    margin: var(--space-3) 0 0;
  }
  .cta-row {
    display: flex;
    gap: var(--space-3);
    flex-wrap: wrap;
  }
  .cta {
    display: inline-block;
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius);
    text-decoration: none;
    font-weight: 500;
  }
  .cta.primary {
    background: var(--c-navy);
    color: white;
  }
  .cta.ghost {
    background: transparent;
    color: var(--c-navy);
    border: 1px solid var(--c-border);
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--space-6);
    margin-top: var(--space-8);
  }
  .feature {
    background: var(--c-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
  }
  .feature .ico { font-size: 1.6rem; margin-bottom: var(--space-3); }
  .feature h2 {
    font-size: 1rem;
    color: var(--c-navy);
    margin: 0 0 var(--space-2);
    font-weight: 600;
  }
  .feature p {
    margin: 0;
    color: var(--c-muted);
    font-size: 0.9375rem;
    line-height: 1.5;
  }

  @media (max-width: 480px) {
    h1 { font-size: 1.75rem; }
    .lead { font-size: 1rem; }
    .cta-row .cta { width: 100%; text-align: center; }
  }
</style>
