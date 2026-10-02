/* Matrix digital rain behind every page of The Cyber Casebook. */
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
  (function loop(t){ if (t - last > 55) { frame(); last = t; } requestAnimationFrame(loop); })(0);
})();
