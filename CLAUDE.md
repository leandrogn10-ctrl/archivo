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

## Identity — Archivo General de la Nación, V2 «El Canto» (en vivo desde Ago 5 2026)
**Fraunces** carries every piece of content (opsz pinned to 14 in the wordmark so it reads
printed, not editorial); **Geist** carries the chrome at three sizes (15/13/11) and one
tracking; **Special Elite** is stamps ONLY — never chrome. **No monospace anywhere.**
UNA sola sala: the old `folio` (manila light) theme was retired and `migrate()` deletes
`settings.theme` at schema 6. The hour drives the panorama's light, not the room.
Palette: the room CITES LeandroOS's 39-colour city ramp, published as `--p0…--p38` by
`publishPalette()` and aliased in `SLOT:APP-THEME` — **every alias cites, nothing copies a
hex**, and each `var(--pN)` carries a literal fallback because CSS resolves before JS runs.
Sello rojo (#c8553d = p38) stays the only loud voice. Don't reuse other apps' palettes.

**Los prototipos y los documentos de diseño (`identity-pitches/`, `REDESIGN.md`,
`PORT-V2-PLAN.md`, `prototype-v2.html`) NO viven en este repo**: su corpus de muestra usa
títulos reales del archivo y este repo es PÚBLICO. Están en local, en la rama
`v2-canto-fase1`. Si vuelven, que sea con datos inventados.

## Domain code map (all in index.html, below the shell plumbing)
- `pullCorpus()` — tree API → contents API in batches of 6; README.md excluded
- `parseFrontmatter/parseNote` — the README-defined YAML subset only (no nesting)
- `mdRender/mdInline` — hand-rolled markdown; **escape HTML first**, then transform;
  `[[wikilinks]]` resolve against corpus slugs (filename sans .md, must stay unique)
- `renderDrawers/renderView` — catalogue (cards grouped by folder) vs folio (reader +
  backlinks scan); `view` is the tiny router
- Search: `/` focuses, title(10)>tags(5)>body(1) scoring — the F14 seed. `searchNotesScored`
  is the ranker; `searchNotes` is the names-only wrapper
- Consulta desk (`?` or ✦ preguntar): multi-turn streamed chat over the corpus. Retrieval is
  **budget-driven, never a fixed hit count** — every hit above 15% of the top score goes in
  until `ASK_CHAR_BUDGET` is spent; follow-ups append only fichas the thread hasn't seen.
  `ask.cites` keeps `[n]` numbering stable across the whole conversation.
  **`max_tokens` covers thinking + answer** on opus-5/sonnet-5 (adaptive thinking is ON by
  default) — that's why `ASK_MAX_TOKENS` is 8k, not 1.6k; a `stop_reason: max_tokens` renders
  a "continuar" button instead of a severed sentence. One `cache_control` breakpoint rides the
  newest user block so the next turn re-reads the ficha prefix at ~10% of input price.
  `askThreadBudget()` caps cumulative ficha text and is **derived from the chosen model's
  context window** (`ASK_MODEL_WINDOW`), never a constant — the old flat 520k-char ceiling was
  sized for a 200k window and silently starved every follow-up once opus-5/sonnet-5 went to 1M.
  When the budget can't fit a relevant unseen ficha, the turn appends a visible "hilo lleno"
  line and the sub-header keeps saying so; degradation is never silent.

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
