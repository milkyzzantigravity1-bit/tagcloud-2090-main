<script lang="ts">
  import '../app.css';
  import { goto, invalidateAll } from '$app/navigation';
  let { children, data } = $props();

  let menuOpen = $state(false);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await invalidateAll();
    menuOpen = false;
    await goto('/');
  }
</script>

<header class="topbar">
  <a class="brand" href="/" onclick={() => (menuOpen = false)}>
    <img class="brand-logo" src="/logo2090.png" alt="ГБОУ Школа №2090" />
    <span class="brand-text">Облако тегов</span>
  </a>

  {#if data.user}
    <button
      class="burger"
      type="button"
      aria-label="Меню"
      aria-expanded={menuOpen}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <span></span><span></span><span></span>
    </button>
  {/if}

  <nav class="auth-nav" class:open={menuOpen}>
    {#if data.user}
      <a class="nav-link" href="/my" onclick={() => (menuOpen = false)}>Мои опросы</a>
      <a class="nav-cta" href="/new" onclick={() => (menuOpen = false)}>+ Опрос</a>
      <span class="user-email" title={data.user.email}>{data.user.email}</span>
      <button class="ghost" onclick={logout}>Выйти</button>
    {:else}
      <a class="nav-link" href="/login">Войти</a>
      <a class="nav-cta" href="/register">Регистрация</a>
    {/if}
  </nav>
</header>

<main class="container">
  {@render children()}
</main>

<footer class="footer">
  <span>ГБОУ Школа №2090 · образовательный проект</span>
</footer>

<style>
  .topbar {
    border-bottom: 1px solid var(--c-border);
    padding: var(--space-3) var(--space-6);
    background: var(--c-bg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    position: relative;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    color: var(--c-navy);
    font-weight: 600;
    text-decoration: none;
    min-width: 0;
  }
  .brand-logo {
    height: 36px;
    width: 36px;
    object-fit: contain;
    display: block;
    flex-shrink: 0;
  }
  .brand-text {
    color: var(--c-text);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .auth-nav {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
  }
  .nav-link {
    color: var(--c-navy);
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
  }
  .nav-link:hover {
    text-decoration: underline;
  }
  .nav-cta {
    background: var(--c-navy);
    color: white;
    padding: 6px 14px;
    border-radius: var(--radius);
    text-decoration: none;
    font-weight: 500;
    white-space: nowrap;
  }
  .nav-cta:hover {
    text-decoration: none;
  }
  .user-email {
    color: var(--c-muted);
    font-size: 0.875rem;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ghost {
    background: transparent;
    color: var(--c-navy);
    border: 1px solid var(--c-border);
    padding: 6px 12px;
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
  }

  .burger {
    display: none;
    background: transparent;
    border: 0;
    padding: 8px;
    cursor: pointer;
    flex-direction: column;
    gap: 4px;
  }
  .burger span {
    display: block;
    width: 22px;
    height: 2px;
    background: var(--c-navy);
    border-radius: 2px;
  }

  .container {
    max-width: 880px;
    margin: 0 auto;
    padding: var(--space-12) var(--space-6);
    min-height: calc(100vh - 130px);
  }
  .footer {
    border-top: 1px solid var(--c-border);
    padding: var(--space-4) var(--space-6);
    color: var(--c-muted);
    font-size: 0.875rem;
    text-align: center;
  }

  @media (max-width: 640px) {
    .topbar {
      padding: var(--space-3) var(--space-4);
      flex-wrap: wrap;
    }
    .burger {
      display: inline-flex;
    }
    .auth-nav {
      display: none;
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-2);
      padding-top: var(--space-3);
      border-top: 1px solid var(--c-border);
      margin-top: var(--space-3);
    }
    .auth-nav.open {
      display: flex;
    }
    .nav-link,
    .nav-cta {
      text-align: center;
      padding: var(--space-3);
    }
    .user-email {
      text-align: center;
      max-width: 100%;
      padding: var(--space-2) 0;
    }
    .ghost {
      padding: var(--space-3);
      width: 100%;
      text-align: center;
    }
    .container {
      padding: var(--space-6) var(--space-4);
      min-height: calc(100vh - 160px);
    }
    .brand-text {
      font-size: 0.95rem;
    }
  }
</style>
