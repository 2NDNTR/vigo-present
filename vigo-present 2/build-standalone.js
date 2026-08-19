/**
 * Portable single-file build.
 * Transpiles the application sources with TypeScript and links them with a
 * tiny CommonJS runtime so the whole platform runs from one HTML file.
 * The Next.js app and this bundle share 100% of the component code.
 */
const ts = require('/home/claude/.npm-global/lib/node_modules/typescript');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const NM = '/home/claude/.npm-global/lib/node_modules';

const INCLUDE_DIRS = ['lib', 'components', 'standalone'];
const INCLUDE_FILES = [
  'app/dashboard/page.tsx',
  'app/login/page.tsx',
  'app/present/[id]/PresentClient.tsx',
  'app/p/[slug]/PublicClient.tsx',
];
const EXCLUDE = ['lib/store/server-pg.ts'];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const rel = dir + '/' + f;
    const abs = path.join(ROOT, rel);
    if (fs.statSync(abs).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(f)) out.push(rel);
  }
  return out;
}

let sources = [];
INCLUDE_DIRS.forEach((d) => walk(d, sources));
sources = sources.concat(INCLUDE_FILES).filter((f) => !EXCLUDE.includes(f));

const idOf = (rel) => rel.replace(/\.(tsx|ts)$/, '');
const known = new Set(sources.map(idOf));

function resolve(spec, fromId) {
  if (spec === 'next/navigation') return 'standalone/router';
  if (spec.startsWith('@/')) {
    const base = spec.slice(2);
    if (known.has(base)) return base;
    if (known.has(base + '/index')) return base + '/index';
    return base;
  }
  if (spec.startsWith('.')) {
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromId), spec));
    if (known.has(base)) return base;
    if (known.has(base + '/index')) return base + '/index';
    return base;
  }
  return spec; // react, react-dom/client, react/jsx-runtime
}

const parts = [];

// --- vendor modules -------------------------------------------------------
const vendor = {
  react: NM + '/react/cjs/react.production.js',
  'react/jsx-runtime': NM + '/react/cjs/react-jsx-runtime.production.js',
  'react-dom': NM + '/react-dom/cjs/react-dom.production.js',
  'react-dom/client': NM + '/react-dom/cjs/react-dom-client.production.js',
  scheduler: NM + '/react-dom/node_modules/scheduler/cjs/scheduler.production.js',
};

Object.entries(vendor).forEach(([id, file]) => {
  const code = fs.readFileSync(file, 'utf8');
  parts.push(`__def(${JSON.stringify(id)}, function(module, exports, require){\n${code}\n});`);
});

// --- application modules --------------------------------------------------
let errors = 0;
sources.forEach((rel) => {
  const id = idOf(rel);
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const out = ts.transpileModule(src, {
    fileName: rel,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  });
  (out.diagnostics || []).forEach((d) => {
    if (d.category === ts.DiagnosticCategory.Error) {
      errors++;
      console.log('ERR', rel, ts.flattenDiagnosticMessageText(d.messageText, ' '));
    }
  });
  const code = out.outputText.replace(/require\((["'])(.*?)\1\)/g, (m, q, spec) => {
    return `require(${JSON.stringify(resolve(spec, id))})`;
  });
  parts.push(`__def(${JSON.stringify(id)}, function(module, exports, require){\n${code}\n});`);
});

if (errors) {
  console.log(errors + ' transpile errors');
  process.exit(1);
}

const runtime = `
(function(){
  var __mods = {}, __cache = {};
  function __def(id, fn){ __mods[id] = fn; }
  function __req(id){
    if (__cache[id]) return __cache[id].exports;
    var m = { exports: {} };
    __cache[id] = m;
    var fn = __mods[id];
    if (!fn) throw new Error('Module not found: ' + id);
    fn(m, m.exports, __req);
    return m.exports;
  }
  if (typeof window !== 'undefined' && !window.process) window.process = { env: { NODE_ENV: 'production' } };
  if (typeof window !== 'undefined') window.__req = __req;
`;

const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8');

const FONTS =
  'https://fonts.googleapis.com/css2' +
  '?family=Inter:wght@400;500;600;700' +
  '&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600' +
  '&family=Archivo:wght@400;500;600;700' +
  '&family=Cormorant+Garamond:wght@400;500;600' +
  '&display=swap';

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vigo Present</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script>
${runtime}
${parts.join('\n')}
  __req('standalone/main');
})();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'dist/index.html'), html);
console.log('built dist/index.html', (html.length / 1024).toFixed(0) + 'KB');
