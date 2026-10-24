/* Matrix digital rain behind every page of The Cyber Casebook, plus the light/dark mode button. */
(() => {
  const root = document.documentElement;
  const set = light => {
    if (light) root.dataset.theme = 'light'; else delete root.dataset.theme;
    const keep = document.querySelector('.banner-keep'), banner = document.getElementById('banner');
    if (light && keep && banner && !keep.getAttribute('src')) keep.src = banner.currentSrc || banner.src;
    document.querySelectorAll('[data-theme-toggle]').forEach(b => {
      b.textContent = light ? 'Dark mode' : 'Light mode';
      b.setAttribute('aria-pressed', String(light));
      b.title = light ? 'Switch to the black background' : 'Switch to a white background';
    });
  };
  set(root.dataset.theme === 'light');
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-theme-toggle]'); if (!b) return;
    const light = root.dataset.theme !== 'light';
    set(light);
    try { localStorage.setItem('ccTheme', light ? 'light' : 'dark'); } catch (err) {}
  });
})();
(() => {
  const c = document.getElementById('rain'), ctx = c.getContext('2d');
  const chars = '01アカサタナハマヤラワ0123456789ABCDEF<>/{}#$%'.split('');
  const fs = 16; let cols = [], w, h;
  const size = () => { w = c.width = innerWidth; h = c.height = innerHeight; cols = Array(Math.ceil(w / fs)).fill(0).map(() => Math.random() * -h / fs); };
  size(); addEventListener('resize', size);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(){
    ctx.fillStyle = 'rgba(0,5,3,.12)'; ctx.fillRect(0, 0, w, h);
    ctx.font = fs + 'px monospace';
    cols.forEach((y, i) => {
      const ch = chars[(Math.random() * chars.length) | 0];
      ctx.fillStyle = Math.random() > .975 ? '#CFFFE0' : '#00FF66';
      ctx.fillText(ch, i * fs, y * fs);
      cols[i] = (y * fs > h && Math.random() > .975) ? 0 : y + 1;
    });
  }
  if (still) { for (let k = 0; k < 120; k++) frame(); return; }
  let last = 0;
  (function loop(t){ if (t - last > 55 && document.documentElement.dataset.theme !== 'light') { frame(); last = t; } requestAnimationFrame(loop); })(0);
})();

/* Keep each page title on one line: shrink its font just enough to fit the column. */
(function () {
  function fit() {
    document.querySelectorAll('.page h1').forEach(function (h) {
      h.style.fontSize = '';
      var w = h.clientWidth, s = h.scrollWidth;
      if (w && s > w) h.style.fontSize = Math.max(12, Math.floor(parseFloat(getComputedStyle(h).fontSize) * w / s * 10) / 10) + 'px';
    });
  }
  var t; window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fit, 80); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
})();
