import { App } from './app';
import { installDialInteractions } from './dial/interactions';
import { activeModels, hasS1Access } from './services/systemone';
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
  if (!settings.mock && !hasLlmAccess() && !activeModels().some(hasS1Access)) app.openSettings();
}

void main();
