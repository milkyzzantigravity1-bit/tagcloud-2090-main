<script lang="ts">
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let resendEmail = $state('');
  let resending = $state(false);
  let resendDone = $state(false);

  async function resend() {
    if (!resendEmail) return;
    resending = true;
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: resendEmail })
      });
      resendDone = true;
    } finally {
      resending = false;
    }
  }
</script>

<svelte:head><title>Подтверждение email — Облако тегов 2090</title></svelte:head>

<div class="auth">
  <h1>Подтверждение email</h1>
  {#if data.code === 'missing'}
    <p class="error">{data.message}. Откройте ссылку из письма целиком.</p>
  {:else if data.code === 'invalid'}
    <p class="error">Ссылка недействительна. Возможно, она была изменена.</p>
  {:else if data.code === 'used'}
    <p class="error">
      Эта ссылка уже была использована. Если у вас не получается войти — запросите новую.
    </p>
  {:else if data.code === 'expired'}
    <p class="error">Срок действия ссылки истёк. Запросите новое письмо ниже.</p>
  {/if}

  {#if data.code === 'expired' || data.code === 'used' || data.code === 'invalid'}
    <form
      onsubmit={(e) => {
        e.preventDefault();
        resend();
      }}
    >
      <label>
        <span>Email, на который пришло письмо</span>
        <input
          type="email"
          bind:value={resendEmail}
          required
          autocomplete="email"
          maxlength="254"
        />
      </label>
      <button type="submit" class="primary" disabled={resending || resendDone}>
        {#if resendDone}
          Письмо отправлено
        {:else if resending}
          Отправляем…
        {:else}
          Отправить новое письмо
        {/if}
      </button>
      {#if resendDone}
        <p class="muted">
          Если этот email действительно зарегистрирован и ещё не подтверждён, на него отправлено
          письмо.
        </p>
      {/if}
    </form>
  {/if}

  <p class="muted"><a href="/login">Назад ко входу</a></p>
</div>

<style>
  .auth {
    max-width: 480px;
    margin: 0 auto;
  }
  h1 {
    margin-bottom: var(--space-4);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    background: var(--c-surface);
    padding: var(--space-6);
    border-radius: var(--radius-lg);
    margin-top: var(--space-4);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  label > span {
    font-weight: 500;
  }
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
  button:disabled {
    opacity: 0.5;
  }
  .error {
    background: #fef2f2;
    color: var(--c-danger);
    padding: var(--space-3);
    border-radius: var(--radius);
    border: 1px solid #fecaca;
    font-size: 0.95rem;
  }
  .muted {
    color: var(--c-muted);
    margin-top: var(--space-4);
    text-align: center;
  }

  @media (max-width: 480px) {
    .auth {
      max-width: 100%;
    }
    form {
      padding: var(--space-4);
    }
    button.primary {
      width: 100%;
      padding: var(--space-4);
    }
    input {
      font-size: 16px;
    }
  }
</style>
