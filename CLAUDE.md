# El Archivo — project guide

The **reading room** of LeandroOS's knowledge organ. Single-file C3 PWA (copied from
`~/Projects/app-shell`, slots filled). Vision + design constraints:
`~/Downloads/leandro-os/prototype/EL-ARCHIVO-PLAN.md` — read it before adding features.

## Architecture (hybrid storage — the one C3 deviation, deliberate)
- **Corpus** = markdown notes in the **private repo `leandrogn10-ctrl/archivo-corpus`**
  (schema in its README). Pulled read-only via the GitHub contents API using the sync PAT
  (**token needs `gist` + `repo` scopes** — plain gist tokens can't see the private repo).
- **App state** = standard C3 gist sync, untouched shell plumbing. `looksLikeMyState`
  requires `s.corpus.repo`.
- **The corpus cache lives in its OWN IndexedDB store (`archivo-corpus-cache`, key
  `archivo.corpus.v1`), never inside `state`** — note content must never reach the app-state
  gist. Don't "simplify" this. (Was localStorage until Jul 2026: the corpus outgrew the ~5MB
  quota, every cache write threw, and each open re-pulled ~1k fichas off a fossilized cache.)
- This app **reads** — with ONE exception: **veto-pass micro-writes** (`setSensitivity`-style
  human verdicts: single frontmatter fields, contents-API PUT, sha-guarded, commit message
  `veto: …`). The app never generates or edits note *content*; that's the sweep's job or git.

## Identity — Archivo General de la Nación
Verde archivo + manila ink, **sello rojo** accent (#c8553d), brass gold. Themes: `archivo`
(night reading room) / `folio` (manila light). Type: Libre Caslon Text (folio serif),
Special Elite (rubber stamps ONLY — badges, group labels), JetBrains Mono (chrome).
No Inter/Space Grotesk; don't reuse other apps' palettes.

## Domain code map (all in index.html, below the shell plumbing)
- `pullCorpus()` — tree API → contents API in batches of 6; README.md excluded
- `parseFrontmatter/parseNote` — the README-defined YAML subset only (no nesting)
- `mdRender/mdInline` — hand-rolled markdown; **escape HTML first**, then transform;
  `[[wikilinks]]` resolve against corpus slugs (filename sans .md, must stay unique)
- `renderDrawers/renderView` — catalogue (cards grouped by folder) vs folio (reader +
  backlinks scan); `view` is the tiny router
- Search: `/` focuses, title(10)>tags(5)>body(1) scoring — the F14 seed

## Ship rule (SW pinning)
**Every index.html change ships with a `sw.js` CACHE_NAME bump.** The SW is cache-first for
the shell: clients pin whatever index.html their current cache grabbed, and only a changed
sw.js byte-stream triggers a refresh. Jul 10 incident: a commit that skipped the bump left
clients running v1 IDB code against a v2-upgraded database — every cache open threw
VersionError and "nothing persisted". If two sessions ship near-simultaneously, LAST one
must still land on a fresh CACHE_NAME.

## Dev loop
```bash
python3 -m http.server <fresh port>   # SW caches aggressively — bump the port per session
```
Verify round-trip: seed a repo-scoped PAT in Settings → ⟳ → cards appear → open a note →
click a wikilink → reload (corpus must survive from cache). Backport policy: shell plumbing
bugs get fixed in app-shell first, then hand-ported here.
