// La tecla `d` (documento original) — Leandro, 25-sep-2026: «d» tiene que funcionar SIEMPRE.
// Fichas sintéticas (este repo es público). Corre las funciones REALES extraídas de index.html, y
// cada control re-planta un defecto en una copia y exige rojo.
//   A) http vivo → abre el enlace.
//   B) sin enlace (descarga:, sin source, fuente_caducada) → abre el TEXTO y lo DICE en un toast.
//   C) fuente_caducada: la placa, la barra de teclas y la tecla comparten UNA puerta — un enlace
//      caducado no se anuncia como «documento original» en ningún sitio.
//   D) sin texto ni enlace → sólo el toast, nada se abre.
const fs = require('fs');
const SRC = fs.readFileSync(__dirname + '/index.html', 'utf8');

function load(html) {
  const src = html.split('\n');
  const at = re => { const i = src.findIndex(l => re.test(l)); if (i < 0) throw new Error('missing ' + re); return i; };
  const fn = re => { const a = at(re); let b = a; while (!/^}/.test(src[b])) b++; return src.slice(a, b + 1).join('\n'); };
  for (const name of ['enlaceOriginal', 'abrirDocumento', 'abrirTexto'])
    if (src.filter(l => new RegExp('^function ' + name + '\\(').test(l)).length !== 1) throw new Error(name + ' no está declarada exactamente una vez');
  const body = [fn(/^function enlaceOriginal/), fn(/^function abrirDocumento/), fn(/^function abrirTexto/),
    'return { enlaceOriginal, abrirDocumento };'].join('\n');
  const log = { opened: [], toasts: [] };
  const api = new Function('toast', 'abrirEnPestaña', 'state', body)(
    m => log.toasts.push(m), u => log.opened.push(u), { corpus: { repo: 'o/c', branch: 'main' } });
  // la placa y la barra usan la puerta: comprobarlo en el texto, no suponerlo
  const placa = src.find(l => /documento original <kbd>d<\/kbd>/.test(l)) || '';
  const barra = src.find(l => /'<kbd>d<\/kbd> documento original'/.test(l)) || '';
  return { api, log, compartida: /enlaceOriginal\(n\)/.test(placa) && /enlaceOriginal\(n\)/.test(barra) };
}

function check(html) {
  const errs = [], { api, log, compartida } = load(html);
  const run = (fm) => { log.opened.length = 0; log.toasts.length = 0; api.abrirDocumento({ fm }); return { o: [...log.opened], t: [...log.toasts] }; };
  let r = run({ source: 'https://www.jstor.org/stable/x', texto: 'textos/local-a.md' });
  if (r.o[0] !== 'https://www.jstor.org/stable/x') errs.push('A: http vivo no abre el enlace');
  for (const [tag, fm] of [['descarga', { source: 'descarga:PS1.pdf', texto: 'textos/local-b.md' }],
                           ['sin source', { texto: 'textos/local-c.md' }],
                           ['caducada', { source: 'https://cdn.x.net/f.pdf', fuente_caducada: true, texto: 'textos/local-d.md' }]]) {
    r = run(fm);
    if (!(r.o[0] || '').endsWith(fm.texto)) errs.push(`B ${tag}: no abre el texto (${r.o[0]})`);
    if (!r.t.length) errs.push(`B ${tag}: fallback SILENCIOSO`);
  }
  if (api.enlaceOriginal({ fm: { source: 'https://cdn.x.net/f.pdf', fuente_caducada: true } })) errs.push('C: caducada pasa la puerta');
  if (!compartida) errs.push('C: placa o barra no usan enlaceOriginal');
  r = run({ source: 'descarga:x.pdf' });
  if (r.o.length || !r.t.length) errs.push('D: sin texto abre algo o calla');
  return errs;
}

let ok = true;
const real = check(SRC);
real.forEach(e => console.log('  ✗', e));
console.log('real:', real.length ? 'ROJO' : 'OK'); ok = ok && !real.length;

const controls = [
  ['sin fallback (la regla vieja)', s => s.replace("if (n.fm.texto) { toast(`${porque} — abro el texto guardado.`); abrirTexto(n); return; }", ''), /^B /],
  ['fallback mudo', s => s.replace("toast(`${porque} — abro el texto guardado.`); abrirTexto(n);", 'abrirTexto(n);'), /SILENCIOSO/],
  ['puerta ignora caducada', s => s.replace(" && n.fm.fuente_caducada !== true", ''), /^[BC] /],
  ['placa con su propia regla', s => s.replace('${enlaceOriginal(n) ? `<a href="${escapeHtml(enlaceOriginal(n))}"', '${/^https?:/.test(String(n.fm.source)) ? `<a href="${escapeHtml(String(n.fm.source))}"'), /^C: placa/],
];
for (const [name, plant, want] of controls) {
  const broken = plant(SRC);
  if (broken === SRC) { console.log(`control «${name}»: el re-plantado no cambió nada`); ok = false; continue; }
  const e = check(broken), red = e.some(x => want.test(x));
  console.log(`control «${name}»: ${red ? 'rojo' : 'VERDE — ciego'}`); ok = ok && red;
}
console.log(ok ? 'TODO OK' : 'FALLA'); process.exit(ok ? 0 : 1);
