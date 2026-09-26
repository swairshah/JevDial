import { App } from './app';
import { installDialInteractions } from './dial/interactions';
import { hasJevAccess } from './services/jev';
import { hasLlmAccess } from './services/openrouter';
import { detectProxy } from './services/proxy';
import { loadSettings, settings } from './settings';
import { applyTheme } from './ui/theme';
import { mountToast } from './ui/toast';

async function main(): Promise<void> {
  loadSettings();
  applyTheme(settings.theme);
  await detectProxy();
  mountToast();
  installDialInteractions();
  const root = document.getElementById('app');
  if (!root) throw new Error('#app not found');
  const app = new App(root);
  if (!settings.mock && !hasLlmAccess() && !hasJevAccess()) app.openSettings();
}

void main();
