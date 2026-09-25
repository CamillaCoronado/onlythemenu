<script lang="ts">
  import { page } from '$app/state';
  import { env } from '$env/dynamic/public';

  let email = $state('');
  let sent = $state(false);
  let err = $state('');
  let busy = $state(false);
  const next = $derived(page.url.searchParams.get('next') ?? '/owner');
  const configured = !!env.PUBLIC_FIREBASE_API_KEY;

  async function fb() {
    const [{ initializeApp, getApps }, a] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
    const app = getApps()[0] ?? initializeApp({ apiKey: env.PUBLIC_FIREBASE_API_KEY, authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: env.PUBLIC_FIREBASE_PROJECT_ID });
    return { a, auth: a.getAuth(app) };
  }

  async function finish(idToken: string) {
    const res = await fetch('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
    if (!res.ok) { err = 'sign-in failed. try again?'; return; }
    location.href = next.startsWith('/') ? next : '/owner';
  }

  async function google() {
    busy = true; err = '';
    try {
      const { a, auth } = await fb();
      const cred = await a.signInWithPopup(auth, new a.GoogleAuthProvider());
      await finish(await cred.user.getIdToken());
    } catch { err = 'sign-in cancelled'; }
    busy = false;
  }

  async function link(e: SubmitEvent) {
    e.preventDefault();
    busy = true; err = '';
    try {
      const { a, auth } = await fb();
      await a.sendSignInLinkToEmail(auth, email, { url: location.href, handleCodeInApp: true });
      localStorage.setItem('otm:email', email);
      sent = true;
    } catch { err = "couldn't send the link"; }
    busy = false;
  }

  // returning from an email link
  $effect(() => {
    if (!configured) return;
    fb().then(async ({ a, auth }) => {
      if (!a.isSignInWithEmailLink(auth, location.href)) return;
      const saved = localStorage.getItem('otm:email') ?? prompt('confirm your email') ?? '';
      const cred = await a.signInWithEmailLink(auth, saved, location.href);
      await finish(await cred.user.getIdToken());
    }).catch(() => (err = 'that link expired'));
  });
</script>

<svelte:head><title>sign in · onlythemenu</title><meta name="robots" content="noindex" /></svelte:head>

<main class="login">
  <a href="/" class="home">onlythemenu</a>
  <h1 class="display">owners sign in</h1>
  <p class="muted">diners never need an account. this is for restaurant owners fixing their own menu.</p>
  {#if !configured}
    <p class="err">sign-in isn't configured on this deploy.</p>
  {:else if sent}
    <p>check your email for the sign-in link.</p>
  {:else}
    <button class="pop btn mustard wide" onclick={google} disabled={busy}>continue with google</button>
    <p class="or muted">or</p>
    <form onsubmit={link}>
      <label for="email" class="sr-only">email</label>
      <input id="email" class="pop field" type="email" required bind:value={email} placeholder="you@restaurant.com" autocomplete="email" />
      <button class="pop btn wide" disabled={busy}>email me a link</button>
    </form>
  {/if}
  {#if err}<p class="err" role="alert">{err}</p>{/if}
</main>

<style>
  .login { padding: calc(var(--safe-top) + 6px) var(--pad) 40px; }
  .home { display: inline-flex; align-items: center; min-height: 44px; font-weight: 800; font-size: 15px; text-decoration: none; }
  h1 { font-size: 32px; margin: 18px 0 8px; }
  .wide { width: 100%; min-height: 52px; margin-top: 12px; }
  .field { width: 100%; min-height: 52px; padding: 0 14px; background: var(--mayo-deep); font: 600 17px var(--font-ui); color: var(--ink); }
  .or { text-align: center; margin: 14px 0 0; }
  .err { color: var(--ketchup); font-weight: 600; }
</style>
