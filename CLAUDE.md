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
- **That cache is best-effort until Chrome says otherwise, and Chrome says no to a plain tab.**
  `navigator.storage.persist()` returns a BOOLEAN and grants durability on heuristics (installed
  app / bookmarked / high engagement). Aug 15 it was refused, Chrome evicted the entire
  IndexedDB, and the leveldb came back virgin (MANIFEST-000001) — 3,179 fichas cold-pulled with
  nothing on screen to explain why. `probeStorageDurability()` now reads the verdict and settings
  prints it — the readout only says whether the grant landed, it can't cause it. Chrome's three
  documented heuristics are engagement, installed, and bookmarked. **El marcador NO sirve en este
  perfil, probado el 15-ago:** marcador puesto 13:43:56 → la app arrancó 13:44:04 (el IDB se
  tocó, o sea `persist()` volvió a preguntar) → Preferences se escribió 13:44:29, 33s DESPUÉS, y
  `durable_storage` seguía nombrando sólo a chatgpt.com. La hipótesis (no confirmada en fuentes
  de Chromium) es que la heurística del marcador sólo aplica a perfiles con poquísimos
  marcadores; éste tiene 72. Engagement iba en 43.8 con tope de ~5 puntos/día y el umbral no
  está documentado. **INSTALAR SÍ FUNCIONÓ: `durable_storage` concedió el origen a las 13:59:41
  del 15-ago, minutos después de instalarla.** No la desinstales — es la única palanca que
  resultó, y el diálogo de desinstalar trae una casilla «borrar datos» que se llevaría la caché
  entera. Instalada no te quita la pestaña normal: la URL se sigue abriendo como siempre.
  El sondeo se repite al ABRIR settings, no sólo en el arranque: la concesión llegó 5 segundos
  después de que el panel pintara «DESECHABLE» y el renglón se quedó mintiendo hasta la
  siguiente recarga — un readout de una sola foto envejece en silencio. Never restore the old
  `.catch(() => {})` form: it threw the answer away, so refused and granted looked identical
  from inside the app for 12 days.
- **The icons are 192 + 512 because Chrome won't offer «install» below that.** The escudo used to
  be painted only at 180 (apple-touch-icon's size), which quietly made the app non-installable
  and closed off one of those heuristics. `pintarEscudo(familia, lado)` still DESIGNS in a
  180 space and scales; `repintar()` rebuilds favicon + apple-touch + the whole manifest, so the
  installed icon is the Fraunces one and not the fallback serif. Don't drop a size from `ICONOS`.
  **El manifiesto `blob:` generado en runtime SÍ le sirve a Chrome para instalar** (probado el
  15-ago: instaló). No hace falta migrar a un `manifest.webmanifest` estático con ficheros de
  icono — era la sospecha obvia cuando no aparecía «instalar», y era falsa: faltaban las medidas.
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
- `pullCorpus()` — tree API for the file list + shas, then **GraphQL** blob batches of 150
  (`fetchNotesBatch`); a batch costs **1 rate-limit point**, so a cold pull of ~3,180 fichas is
  ~22 requests instead of ~3,180 contents-API calls. Batch size is bound by GitHub's ~10s query
  timeout, not by quota (measured: 200 blobs 4.6s, 400 blobs 9.9s). `fetchNotesBatchREST` is the
  fallback for a token GraphQL rejects — it fires once, on the first batch only, and the route
  that actually SERVED is recorded in `corpus.route` and printed in settings. Not the tarball
  endpoint: it 302s to codeload.github.com, whose CORS header names render.githubusercontent.com
  only. Fichas live in a folder (`f.path.includes('/')`), `textos/` excluded
- `parseFrontmatter/parseNote` — the README-defined YAML subset only (no nesting)
- `mdRender/mdInline` — hand-rolled markdown; **escape HTML first**, then transform;
  `[[wikilinks]]` resolve against corpus slugs (filename sans .md, must stay unique)
- `renderDrawers/renderView` — catalogue (cards grouped by folder) vs folio (reader +
  backlinks scan); `view` is the tiny router
- Search: `/` focuses, title(10)>tags(5)>body(1) scoring — the F14 seed. `searchNotesScored`
  is the ranker; `searchNotes` is the names-only wrapper
- **Teclado.** Three grammars, one law (`k` baja / `j` sube — inverted vs vim on purpose):
  the list (j/k/↵/b), the mesa+sala (their six verdict letters), and **el folio**
  (`folioScroll` + the `view.mode === 'note'` block): j/k/↑↓ step 96px, espacio/AvPág page,
  `g`/`G` ends, `d` documento original, `t` texto completo, `n`/`p` the drawer's neighbours.
  `,` opens settings from anywhere. The step **accumulates on `FOLIO.destino`, never on
  `scrollTop`** — summing on the live position while the eased tween is still travelling
  shortens every repeat and reads as "se traba al bajar rápido".
  `hacerTabulables()` (called once from `renderAll`) stamps `tabindex` on the div-shaped
  clickables inside `#app-root`; an `#app-root` keydown re-emits ↵/espacio as a **click**, so
  keyboard and mouse share one path. Two traps worth keeping: **`el.tabIndex` reads 0 on an
  `<a>` with no href even though it cannot take focus** (guard on the *attribute*, or you skip
  every wikilink), and rows (`data-i`/`data-idx`/`tl-item`) are excluded on purpose — they're a
  selection, not links. The folio's key bar hides under 760px **but not at width 0**: an
  un-laid-out tab reports `innerWidth 0`, which satisfies `max-width:760px`
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
bugs get fixed in app-shell first, then hand-ported here. **But VERIFY THE SELECTORS EXIST before
porting anything that touches chrome** — the V2 redesign removed the shell's mobile scaffolding
(bottom tabs, side sheet, FAB — see `index.html:1162`) and renamed the rest, so `.topbar`,
`.content` and `.claude-panel` have ZERO matches here; this app uses `#top`, `#work`, `#app`. A
shell block pasted in blind styles nothing while reading as a fix in the diff, and the gate cannot
see it. (Audit 2026-08-17 P1-4/P3-9: the prescribed safe-area port was exactly this no-op.)
