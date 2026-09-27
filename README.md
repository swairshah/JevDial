# Word Dial

## Run

```bash
cp .env.example .env
python3 jev_proxy.py
```

Open http://127.0.0.1:8787. Add `?mock` for offline demo mode.

## Develop

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

`dist/app.js` is committed so the page runs without Node.

## Layout

```
src/
  main.ts                    bootstrap
  app.ts                     card stack, persistence, settings reactions
  config.ts                  constants
  settings.ts                settings + localStorage
  types.ts                   shared types, Backend interface
  prompts.ts                 LLM prompts, JSON schemas, Jev criteria
  services/
    openrouter.ts            chatJSON: retries, fallbacks, concurrency limit
    jev.ts                   TypeSafe System One client
    proxy.ts                 local proxy detection
  backends/
    live.ts                  Jev + OpenRouter implementation of Backend
    mock.ts                  offline implementation of Backend
    index.ts                 picks one from settings
  dial/
    DialSentence.ts          dialable sentence component
    Ladder.ts                floating ladder popover
    interactions.ts          wheel, drag, keyboard, hover delegation
    token.ts, colors.ts
  analysis/
    ClassificationPanel.ts   question histograms for a card
    Histogram.ts             one question's bars
    questions.ts             normalising specs and distributions
  feedback/                  sound clicks and haptics
  dataset/                   dataset page: prompts, generation, coverage, saved datasets
  ui/                        header, composer, sentence card, swap panel, settings, theme, toast
```
