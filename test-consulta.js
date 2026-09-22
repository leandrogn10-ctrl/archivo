// node test-consulta.js — pins the consulta desk's retrieval against a SYNTHETIC corpus (this repo is
// public: no real ficha ever appears here). Runs the REAL functions extracted from index.html, then
// re-plants each defect in a scratch copy and requires the matching check to go red.
const fs = require('fs'), vm = require('vm');
const SRC = fs.readFileSync(__dirname + '/index.html', 'utf8');

function load(html) {
  const src = html.split('\n');
  const at = re => { const i = src.findIndex(l => re.test(l)); if (i < 0) throw new Error('missing ' + re); return i; };
  const fn = re => { const a = at(re); let b = a; while (!/^}/.test(src[b])) b++; return src.slice(a, b + 1).join('\n'); };
  const code = [
    src.slice(at(/^const HIDDEN_FOLDERS/), at(/^const TICKET_FOLDERS/) + 1).join('\n'),
    src[at(/^const esCatalogo/)],
    src.slice(at(/^\/\* ── search \(F14 seed\)/), at(/^const searchInput = document/)).join('\n'),
    'const ASK_SCORE_FLOOR = 0.15;',
    src.slice(at(/^const ASK_EXPAND_MODEL/), at(/^let askRosterCache/)).join('\n'),
    fn(/^function askMergeRanked/), fn(/^function askParseExpansion/), fn(/^function losText/), fn(/^function losFlatten/),
    'this.api = { searchNotesScored, askMergeRanked, askParseExpansion, losFlatten, W: ASK_EXPAND_WEIGHT, R: ASK_EXPAND_RESERVED };',
    'this.subSrc = ' + JSON.stringify(fn(/^async function callClaudeSub/)) + ';',
    'this.streamSrc = ' + JSON.stringify(fn(/^async function streamClaude/)) + ';',
    src.slice(at(/^const ASK_ES_WORDS/), at(/^function askLangLine/) + 1).join('\n'),
    fn(/^function askCorpusFile/),
    'const ask = { cites: [], seen: new Set() }; const ASK_PER_FICHA = 7000;',
    fn(/^function askContextBlock/),
    'Object.assign(this.api, { askLang, askCorpusFile, askContextBlock });',
  ].join('\n');
  const ctx = { corpus: null };
  vm.createContext(ctx); vm.runInContext(code, ctx);
  return ctx;
}

// synthetic corpus: 40 chatty notes full of filler, and 3 notes about an invented org whose text
// never says "ngo" — only its tag knows what it is
const note = (slug, title, tags, body) => ({ slug, folder: 'notas', fm: { title, tags }, body, wikilinks: [] });
const NOTES = [];
for (let i = 0; i < 40; i++) NOTES.push(note('filler-' + i, 'Misc notes ' + i, ['misc'], 'I have been interested in the past in many things, any of them.'));
// the org's notes must OUTSCORE the literal hit once widened — otherwise removing the seat
// reservation changes nothing and its control is blind. They must also avoid every word in the
// ngo synonym group, or the literal search finds them and the control arm is contaminated.
for (let i = 0; i < 3; i++) NOTES.push(note('quillwater-' + i, 'Quillwater handbook ' + i, ['quillwater', 'internship'], 'Built worksheets for clients at Quillwater.'));
NOTES.push(note('ngo-essay', 'Essay on funding', ['policy'], 'An NGO is funded by donors.'));

function run(ctx) {
  ctx.corpus = { notes: NOTES };
  const { searchNotesScored: S, askMergeRanked: M, askParseExpansion: X, losFlatten: F, W, R } = ctx.api;
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const Q = 'any NGO ive been interested in in the past';

  const exp = X('```json\n{"tags":["quillwater","invented-tag"],"terms":["clients"]}\n```', new Set(['quillwater', 'internship']));
  ok(exp.ok && exp.tags.includes('quillwater'), 'parse: a real tag survives');
  ok(!exp.tags.includes('invented-tag') && exp.dropped === 1, 'parse: a tag not in the roster is dropped');
  ok(!X('no json here', new Set()).ok, 'parse: prose with no JSON is a failure, not an empty success');

  const base = S(Q), wide = S(Q, [...exp.tags, ...exp.terms], W);
  const without = M(base, []).slice(0, 10).map(n => n.slug), withExp = M(base, wide).map(n => n.slug);
  ok(!without.some(s => s.startsWith('quillwater')), 'control: without expansion the org is out of the top 10');
  ok(withExp.some(s => s.startsWith('quillwater')), 'expansion: the org is reached');
  const reserved = base.filter(x => x.score >= base[0].score * 0.15).slice(0, R).map(x => x.n.slug);
  ok(wide[0].n.slug !== base[0].n.slug, 'fixture: the widened ranking must disagree with the literal one');
  ok(reserved.every((s, i) => withExp[i] === s), 'merge: the literal top hits keep the first seats');
  ok(base[0].n.slug === 'ngo-essay', 'idf: the one content word outranks the filler');

  const flat = F([{ role: 'user', content: 'q1' }, { role: 'assistant', content: 'a1' }, { role: 'user', content: [{ type: 'text', text: 'q2', cache_control: {} }] }]);
  ok(flat.includes('q2') && !flat.includes('[object Object]'), 'flatten: block content arrives as text');
  ok(typeof F([{ role: 'user', content: [{ type: 'text', text: 'solo' }] }]) === 'string', 'flatten: a one-turn block thread is a string');
  // the Max path must ask for a tool-less run: fichas are data this app doesn't author (gap #1)
  // only 'corpus' or 'none' may leave the browser — a helper that doesn't know a value runs its FULL default tool set
  ok(/body: JSON\.stringify\(\{[^}]*tools: tools === 'corpus' \? 'corpus' : 'none'/.test(ctx.subSrc), 'tools: the Max-path body sends only corpus or none');
  // research mode (gap #2)
  const { askLang: L, askCorpusFile: CF, askContextBlock: CB } = ctx.api;
  ok(L('any NGO ive been interested in in the past') === 'en' && L('what abt quillwater') === 'en', 'lang: english questions answer in english');
  ok(L('que cursos de economia he tomado') === 'es' && L('¿quién es?') === 'es', 'lang: spanish questions answer in spanish');
  const cf = CF('/Users/x/Projects/archivo-corpus/proyectos/quillwater-0.md');
  ok(cf && cf.folder === 'proyectos' && cf.slug === 'quillwater-0' && CF('/Users/x/.leandro-os/token.md') === null, 'paths: only files inside the corpus count as opened');
  const hdr = CB([{ slug: 'q', folder: 'fuentes', fm: { title: 'Q', type: 'evaluation', texto: 'textos/abc.md' }, body: 'b' }]);
  ok(hdr.includes('texto: textos/abc.md'), 'header: the seed names its original, or research mode cannot open it');
  // the API path has no tools: the prose describing them must only ride the Max call
  const apiBody = (ctx.streamSrc.match(/stream: true, system[^\n]*/) || [''])[0];
  ok(apiBody.includes('system, messages') && !apiBody.includes('systemExtra'), 'api: the research prompt never reaches the tool-less API path');
  return fails;
}

const green = run(load(SRC));
green.forEach(f => console.log('FAIL', f));

// re-plants: each must turn at least its own check red
const PLANTS = [
  ['roster gate removed', s => s.replace('proposed.filter(t => rosterSet.has(t))', 'proposed'), 'dropped'],
  ['seat reservation removed', s => s.replace('b.slice(0, ASK_EXPAND_RESERVED).forEach(add);', ''), 'first seats'],
  ['IDF removed', s => s.replace('const w = idf.map(x => top > 0 ? x / top : 1);', 'const w = idf.map(() => 1);'), 'idf'],
  ['losText bypassed', s => s.replace("+ ': ' + losText(m.content)", "+ ': ' + m.content"), 'flatten'],
  ['tools value passed through', s => s.replace("tools: tools === 'corpus' ? 'corpus' : 'none'", 'tools'), 'only corpus or none'],
  ['lang forced to spanish', s => s.replace("if (/[ñ¿¡áéíóú]/i.test(q)) return 'es';", "return 'es';"), 'lang: english'],
  ['texto dropped from header', s => s.replace('${prov}${tags}${texto})', '${prov}${tags})'), 'header'],
  ['research prompt leaks to API', s => s.replace('stream: true, system, messages', "stream: true, system: system + (sub.systemExtra || ''), messages"), 'api:'],
  ['extra groups ignored', s => s.replace('for (const ph of extra) {', 'for (const ph of []) {'), 'org is reached'],
];
let bad = 0;
for (const [name, plant, expect] of PLANTS) {
  const broken = plant(SRC);
  if (broken === SRC) { console.log('PLANT DID NOT APPLY:', name); bad++; continue; }
  const f = run(load(broken));
  const hit = f.some(m => m.includes(expect));
  console.log((hit ? 'red  ' : 'GREEN') + ' control: ' + name + (hit ? '' : '  ← the check cannot see this defect'));
  if (!hit) bad++;
}
console.log(green.length || bad ? `✗ ${green.length} failing, ${bad} blind control(s)` : '✓ consulta: all checks green, all controls red');
process.exit(green.length || bad ? 1 : 0);
