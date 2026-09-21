import { html, mount } from '@mickyballadelli/matrix';
import { prismTheme } from '@mickyballadelli/prism';
import { PromptFormComponent } from './components/PromptForm';
import { ImageViewerComponent } from './components/ImageViewer';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Application root is missing.');
const mounted = mount(html`<main class="studio" use:style=${prismTheme}>
  <header class="studio-header"><a href="/" class="wordmark" aria-label="ImageGen home">ImageGen<span class="wordmark-dot" aria-hidden="true"></span></a><span class="muted">Your image studio</span></header>
  <div class="workspace">
    <section class="composer" aria-labelledby="composer-title"><h1 id="composer-title">Give your idea<br />a little detail.</h1><p class="intro">A few words are all you need to begin.</p>${PromptFormComponent()}</section>
    ${ImageViewerComponent()}
  </div>
  <footer class="studio-footer">Built for local creation. Your prompts go to the services configured on your server.</footer>
</main>`, app);
if (import.meta.hot) import.meta.hot.dispose(() => mounted.unmount());
