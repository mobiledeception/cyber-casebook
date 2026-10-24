// Builds dist/school.html: a single self-contained page for the Google Apps Script / Google Sites version.
// No ads, no links to the Cloudflare domain, CSS/JS/images inline. Data comes from google.script.run when
// served by Apps Script, or from the feed URL otherwise.
const fs = require('fs'), path = require('path');
module.exports = function buildSchool({ ROOT, OUT, cfg, cases, EKMAP, json }) {
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  // Images are embedded as-is (no image tools needed, so this works on Cloudflare's build servers).
  const img = f => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(ROOT, f)).toString('base64');
  let s = read('src/index.html');
  const css = read('assets/site.css'), rain = read('assets/rain.js');
  const rep = (a, b) => { if (!s.includes(a)) throw new Error('school build: missing ' + a); s = s.replace(a, () => b); };
  rep('<link rel="stylesheet" href="assets/site.css">', `<style>\n${css}\n.school-foot{text-align:center;color:var(--faint);font:12px var(--mono);padding:28px 0 36px}\n</style>`);
  rep('<script src="assets/rain.js"></script>', `<script>\n${rain}\n</script>`);
  rep('__GA__', ''); rep('__HEAD__', '');
  rep('__FEATURED__', '<div class="empty">Loading case studies…</div>');
  rep('<!--AD:home-->', ''); rep('<!--AD:results-->', '');
  rep('__FOOTER__', '<footer class="school-foot">The Cyber Casebook · Real-world case studies for grades 9–12 · New cases every school day</footer>');
  rep('src="img/banner.jpg"', `src="${img('img/banner.jpg')}"`);
  for (const n of ['latest', 'ek', 'search', 'results']) rep(`src="img/${n}.jpg"`, `src="${img(`img/${n}.jpg`)}"`);
  rep('__DATA_URL__', JSON.stringify(String(cfg.dataUrl || '')));
  rep('__SNAPSHOT__', json(cases.map(({ _i, page, slug, ...c }) => c)));
  rep('__EKMAP__', json(EKMAP));
  rep('__PAGES__', '{}');
  rep('async function load(){\n  let data = null;',
`// Apps Script version: ask the script for the data directly (no cross-site request needed).
function gasData(){
  return new Promise(res => {
    if (!(window.google && google.script && google.script.run)) return res(null);
    const t = setTimeout(() => res(null), 20000);
    google.script.run.withSuccessHandler(txt => { clearTimeout(t); try { res(JSON.parse(txt)); } catch (e) { res(null); } })
      .withFailureHandler(() => { clearTimeout(t); res(null); }).getSiteData();
  });
}
async function load(){
  let data = await gasData();
  if (data && Array.isArray(data.cases)) { CASES = normalize(data.cases); applyAssets(data.assets); finishLoad(); return; }`);
  rep('  CASES.sort((a,b) => b.date.localeCompare(a.date) || a._i - b._i);\n  const openResults', '  finishLoad();\n}\nfunction finishLoad(){\n  CASES.sort((a,b) => b.date.localeCompare(a.date) || a._i - b._i);\n  const openResults');
  rep('<a href="test-generator.html">Test generator</a>', '');   // main site only
  // every remaining link opens in a new tab (the page runs inside a frame)
  s = s.replace(/<a href="https?:/g, '<a target="_blank" rel="noopener" href="https:');
  const left = s.match(/__[A-Z_]+__/); if (left) throw new Error('school build placeholder: ' + left[0]);
  if (/thecybercasebook\.com|googlesyndication|<ins /.test(s)) throw new Error('school build still references the main domain or ads');
  fs.writeFileSync(path.join(OUT, 'school.html'), s);
  return s.length;
};
