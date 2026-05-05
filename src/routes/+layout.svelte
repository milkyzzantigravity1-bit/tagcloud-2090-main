<script lang="ts">
  import '../app.css';
  import { goto, invalidateAll } from '$app/navigation';
  let { children, data } = $props();

  let userOpen = $state(false);
  let menuRoot: HTMLElement | null = $state(null);

  const userInitial = $derived((data.user?.email ?? '?').slice(0, 1).toUpperCase());

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await invalidateAll();
    userOpen = false;
    await goto('/');
  }

  function closeAll() {
    userOpen = false;
  }

  function onDocClick(e: MouseEvent) {
    if (!userOpen) return;
    const target = e.target as HTMLElement | null;
    if (menuRoot && target && !menuRoot.contains(target)) {
      userOpen = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') closeAll();
  }
</script>

<svelte:window onclick={onDocClick} onkeydown={onKey} />

<header class="topbar">
  <a class="brand" href="/" onclick={closeAll}>
    <img class="brand-logo" src="/logo2090.png" alt="ГБОУ Школа №2090" />
    <span class="brand-text">Облако тегов</span>
  </a>

  <nav class="nav" bind:this={menuRoot}>
    {#if data.user}
      <a class="nav-link desktop-only" href="/my" onclick={closeAll}>Мои опросы</a>
      <a class="btn btn-primary btn-sm desktop-only" href="/new" onclick={closeAll}>+ Опрос</a>

      <button
        type="button"
        class="avatar"
        aria-haspopup="menu"
        aria-expanded={userOpen}
        aria-label="Меню пользователя"
        onclick={() => (userOpen = !userOpen)}
      >
        {userInitial}
      </button>

      {#if userOpen}
        <div class="user-menu" role="menu">
          <div class="user-menu-email" title={data.user.email}>{data.user.email}</div>
          <a class="user-menu-item mobile-only" href="/my" onclick={closeAll}>Мои опросы</a>
          <a class="user-menu-item mobile-only" href="/new" onclick={closeAll}>+ Создать опрос</a>
          <button type="button" class="user-menu-item" onclick={logout}>Выйти</button>
        </div>
      {/if}
    {:else}
      <a class="nav-link" href="/login">Войти</a>
      <a class="btn btn-primary btn-sm" href="/register">Регистрация</a>
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
  .brand:hover {
    text-decoration: none;
  }
  .brand-logo {
    height: 32px;
    width: 32px;
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

  .nav {
    display: inline-flex;
    align-items: center;
    gap: var(--space-3);
    position: relative;
  }
  .nav-link {
    color: var(--c-navy);
    font-weight: 500;
    text-decoration: none;
    white-space: nowrap;
    padding: 6px 4px;
  }
  .nav-link:hover {
    text-decoration: underline;
  }

  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: var(--c-navy);
    color: #fff;
    font-size: 0.875rem;
    font-weight: 600;
    border: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .avatar:hover {
    background: var(--c-navy-hover);
  }

  .user-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: var(--c-bg);
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    min-width: 220px;
    padding: var(--space-2);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .user-menu-email {
    color: var(--c-muted);
    font-size: 0.8125rem;
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--c-border);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .user-menu-item {
    display: block;
    padding: var(--space-2) var(--space-3);
    color: var(--c-text);
    text-decoration: none;
    text-align: left;
    background: transparent;
    border: 0;
    border-radius: 6px;
    font: inherit;
    cursor: pointer;
    width: 100%;
  }
  .user-menu-item:hover {
    background: var(--c-surface);
    text-decoration: none;
  }

  .container {
    max-width: 880px;
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    min-height: calc(100vh - 130px);
  }
  .footer {
    border-top: 1px solid var(--c-border);
    padding: var(--space-4) var(--space-6);
    color: var(--c-muted);
    font-size: 0.875rem;
    text-align: center;
  }

  .mobile-only {
    display: none;
  }

  @media (max-width: 640px) {
    .topbar {
      padding: var(--space-3) var(--space-4);
    }
    .desktop-only {
      display: none;
    }
    .mobile-only {
      display: block;
    }
    .brand-text {
      font-size: 0.95rem;
    }
    .container {
      padding: var(--space-6) var(--space-4);
      min-height: calc(100vh - 160px);
    }
  }
</style>
