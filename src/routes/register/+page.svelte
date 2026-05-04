<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let submitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let claimedExisting = $state(false);

  async function submit() {
    submitting = true;
    errorMessage = null;
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await r.json();
      if (!r.ok) {
        const issue = data.error?.issues?.[0];
        errorMessage = issue ? `${issue.path?.join('.') ?? ''}: ${issue.message}` : data.error?.message ?? 'Ошибка';
        return;
      }
      claimedExisting = !!data.claimedExisting;
      await invalidateAll();
      await goto('/my');
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head><title>Регистрация — Облако тегов 2090</title></svelte:head>

<div class="auth">
  <h1>Регистрация</h1>
  <p class="muted">После регистрации в разделе «Мои опросы» появятся все опросы, ранее созданные с этим email.</p>
  <form onsubmit={(e) => { e.preventDefault(); submit(); }}>
    <label>
      <span>Email</span>
      <input type="email" bind:value={email} required autocomplete="email" maxlength="254" />
    </label>
    <label>
      <span>Пароль (минимум 8 символов)</span>
      <input type="password" bind:value={password} required autocomplete="new-password" minlength="8" maxlength="72" />
    </label>
    {#if errorMessage}
      <div class="error">{errorMessage}</div>
    {/if}
    <button type="submit" class="primary" disabled={submitting}>
      {submitting ? 'Создаём…' : 'Создать аккаунт'}
    </button>
  </form>
  <p class="muted">Уже есть аккаунт? <a href="/login">Войти</a></p>
</div>

<style>
  .auth { max-width: 400px; margin: 0 auto; }
  h1 { margin-bottom: var(--space-2); }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--c-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    margin-top: var(--space-6);
  }
  label { display: flex; flex-direction: column; gap: var(--space-2); }
  label > span { font-weight: 500; }
  input {
    padding: var(--space-3);
    border: 1px solid var(--c-border);
    border-radius: var(--radius);
    font-family: inherit;
    font-size: 1rem;
  }
  button.primary {
    background: var(--c-navy);
    color: white;
    border: 0;
    padding: var(--space-3) var(--space-6);
    border-radius: var(--radius);
    font-weight: 500;
    font-family: inherit;
    font-size: 1rem;
  }
  button:disabled { opacity: 0.5; }
  .error {
    background: #fef2f2;
    color: var(--c-danger);
    padding: var(--space-3);
    border-radius: var(--radius);
    border: 1px solid #fecaca;
    font-size: 0.9rem;
  }
  .muted { color: var(--c-muted); margin-top: var(--space-4); }
  .muted:last-of-type { text-align: center; }

  @media (max-width: 480px) {
    .auth { max-width: 100%; }
    form { padding: var(--space-4); }
    button.primary { width: 100%; padding: var(--space-4); }
    input { font-size: 16px; }
  }
</style>
