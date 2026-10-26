# Building and Development

Requires Node 22+ and pnpm 10+.

```bash
pnpm install
pnpm dev           # dev mode with hot reload
pnpm build         # Chrome  → .output/chrome-mv3
pnpm build:edge    # Edge    → .output/edge-mv3
pnpm zip           # store zip (zip:edge, zip:firefox for the others)
pnpm compile       # type check
pnpm test          # unit tests
```

Load the build from `chrome://extensions` → Developer mode → Load unpacked.

## Google Drive sync with your own OAuth client

The build ships with the official client ID. For a fork:

1. In Google Cloud Console, create an OAuth client of type **Web application**, enable the Google Drive API, and add only the `drive.appdata` scope to the consent screen.
2. Add a redirect URI `https://<extension-id>.chromiumapp.org/` for each browser. Settings → Sync shows this device's callback address.
3. Copy `.env.example` to `.env` and set `WXT_GOOGLE_CLIENT_ID`. Set `WXT_EXTENSION_KEY` too if you want a fixed extension ID.
4. Run `pnpm build` again.

## Translations

The UI source is Chinese; `src/i18n/*.json` holds English, Spanish, Portuguese (Brazil), Russian, Japanese, German, French and Indonesian. Every new string needs all eight files; `pnpm test` checks keys and placeholders.

## Releases

Pushing a version tag builds Chrome, Edge and Firefox zips and creates a GitHub Release. Formal versions are submitted to the Chrome Web Store, Edge Add-ons and Firefox Add-ons automatically.

## Stack

WXT · TypeScript · React · Kumo · Tailwind CSS v4 · Dexie (IndexedDB) · Vitest

## This wiki

The wiki is generated from the repo's `wiki/` folder (English at the root, Chinese in `wiki/zh/`) and syncs on every push. Don't edit pages on the web; the next sync overwrites them.
