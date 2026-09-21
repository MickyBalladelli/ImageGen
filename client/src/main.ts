import { component, computed, html, mount, onMount, onUnmount, signal } from '@mickyballadelli/matrix';
import { BackgroundComponent, ButtonComponent as Button, prismTheme } from '@mickyballadelli/prism';
import { getRuntime } from './api';
import { PromptFormComponent } from './components/PromptForm';
import { ImageViewerComponent } from './components/ImageViewer';
import { Logo } from './components/Logo';
import { motionSignal, isLoadingSignal, runtimeSignal, runtimeErrorSignal, providerNameSignal } from './state';
import './style.css';

function Studio() {
  const visible = signal(true);
  let request: AbortController | undefined;
  async function checkRuntime() {
    request?.abort(); request = new AbortController();
    const current = request;
    try {
      const info = await getRuntime(AbortSignal.any([current.signal, AbortSignal.timeout(5000)]));
      if (!current.signal.aborted) { runtimeSignal.set(info); runtimeErrorSignal.set(false); }
    } catch { if (!current.signal.aborted) runtimeErrorSignal.set(true); }
  }
  onMount(() => {
    void checkRuntime();
    const visibility = () => visible.set(document.visibilityState === 'visible');
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  });
  onUnmount(() => request?.abort());
  const runtimeLabel = computed(() => runtimeErrorSignal.get() ? 'Server unavailable' : !runtimeSignal.get() ? 'Checking runtime'
    : runtimeSignal.get()?.imageProvider === 'stable-diffusion' ? 'Stable Diffusion API'
    : runtimeSignal.get()?.runtimeInstalled ? 'MFLUX installed' : 'Install MFLUX');

  return html`<main class="studio" use:style=${prismTheme}>
    <div class="ambient" aria-hidden="true">${BackgroundComponent({
      animation: 'veil', palette: 'midnight', class: 'studio-veil',
      animated: computed(() => motionSignal.get() && visible.get() && !isLoadingSignal.get()),
      speed: 0.32, intensity: 0.42, grain: 0.012, overlayOpacity: 0.25,
      baseColor: '#080d1b', accentColor: '#7b8dff', glowColor: '#59c8ee',
      height: '100%', minHeight: '0', padding: '0', ariaLabel: 'Veil background',
    })}</div>
    <div class="studio-content">
      <header class="studio-header">
        <a href="/" class="wordmark" aria-label="ImageGen home">${Logo()}<span>ImageGen<small>Local image studio</small></span></a>
        <div class="header-controls"><span class="runtime-badge" title="Checks the executable, not model readiness"><i class=${computed(() => runtimeErrorSignal.get() || runtimeSignal.get()?.runtimeInstalled === false ? 'status-dot unavailable' : 'status-dot')}></i>${runtimeLabel}</span>
          ${Button({ label: 'Check runtime', ariaLabel: 'Check runtime', title: 'Check runtime', icon: html`<svg viewBox="0 0 20 20" fill="none"><path d="M16 9a6 6 0 1 0-1.5 5M16 4v5h-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`, showLabel: false, size: 'small', variant: 'secondary', class: 'quiet-button', onClick: () => { void checkRuntime(); } })}
          ${Button({ label: computed(() => motionSignal.get() ? 'Pause Veil' : 'Resume Veil'), ariaLabel: 'Toggle Veil animation', pressed: motionSignal, size: 'small', variant: 'secondary', class: 'motion-button quiet-button', onClick: () => motionSignal.set(!motionSignal.get()) })}
        </div>
      </header>
      <div class="studio-intro"><div><span class="model-chip"><span class="model-spark" aria-hidden="true">✦</span>${providerNameSignal}</span><p>A little direction. An entirely new image.</p></div><span class="workspace-label">Create / Studio</span></div>
      <div class="workspace"><aside class="composer" aria-label="Image controls">${PromptFormComponent()}</aside>${ImageViewerComponent()}</div>
      <footer class="studio-footer"><span>Made with Matrix & Prism</span><span>${computed(() => isLoadingSignal.get() ? 'Veil paused while rendering to free GPU resources.' : 'Nocturne theme / Veil atmosphere')}</span></footer>
    </div>
  </main>`;
}
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root is missing.');
const mounted = mount(component(Studio), app);
if (import.meta.hot) import.meta.hot.dispose(() => mounted.unmount());
