/* The Cyber Casebook - Multiple-Choice Test Generator.
   Teachers pick questions by hand; nothing is assembled automatically and nothing is saved on the site.
   The Word file is built in the browser. Answers are requested only for the chosen questions, at download time. */
(function () {
  'use strict';
  var root = document.getElementById('tg');
  if (!root) return;
  var FEED = root.getAttribute('data-feed');      // Apps Script web app URL
  var UNITS = {
    'AP Cybersecurity': ['Introduction to Security', 'Securing Spaces', 'Securing Networks', 'Securing Devices', 'Securing Applications and Data'],
    'AP Networking': ['Managing My Connections', 'Managing My Shared Connections', 'Managing Many Connections', 'Managing Our Global Connections']
  };
  var PAGE = 40;
  var all = [], byId = {}, shown = PAGE, arrangement = null;
  var sel = load('ccTestSel', []);                 // ordered list of selected question IDs
  var $ = function (id) { return document.getElementById(id); };

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return Array.isArray(v) ? v : d; } catch (e) { return d; } }
  function save() { try { localStorage.setItem('ccTestSel', JSON.stringify(sel)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jsonp(url, ms) {
    return new Promise(function (ok, fail) {
      var cb = 'tg' + Date.now() + Math.floor(Math.random() * 1e6), s = document.createElement('script');
      var t = setTimeout(function () { done(); fail(new Error('timeout')); }, ms || 30000);
      function done() { clearTimeout(t); delete window[cb]; s.remove(); }
      window[cb] = function (d) { done(); ok(d); };
      s.onerror = function () { done(); fail(new Error('network')); };
      s.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'callback=' + cb;
      document.head.appendChild(s);
    });
  }

  /* ---------- load ---------- */
  function start(data) {
    all = (data && data.questions) || [];
    all.sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); });
    all.forEach(function (q) { byId[q.id] = q; });
    sel = sel.filter(function (id) { return byId[id]; });
    $('tgStatus').textContent = all.length ? '' : 'No questions are available yet. The bank is still being filled - check back soon.';
    fillSelects(); render(); renderSel();
  }
  fetch('data/questions.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d && d.questions && d.questions.length) return d; return FEED ? jsonp(FEED + '?view=questions') : d; })
    .then(start).catch(function () {
      (FEED ? jsonp(FEED + '?view=questions') : Promise.reject()).then(start)
        .catch(function () { $('tgStatus').textContent = 'The question bank could not be loaded. Please try again later.'; });
    });

  /* ---------- filters ---------- */
  function val(id) { return $(id).value; }
  function fillSelects() {
    var s = val('tgSubject'), u = $('tgUnit'), cur = u.value;
    u.innerHTML = '<option value="">All units</option>' + (s ? UNITS[s].map(function (n, i) {
      return '<option value="' + (i + 1) + '">Unit ' + (i + 1) + ': ' + esc(n) + '</option>'; }).join('') : '');
    u.disabled = !s; if (s) u.value = cur;
    var ek = $('tgEk'), curE = ek.value, set = {};
    all.forEach(function (q) { if ((!s || q.subject === s) && (!u.value || String(q.unit) === u.value)) set[(s ? '' : (q.subject === 'AP Networking' ? 'Net ' : 'Cyber ')) + q.ek] = q.subject + '|' + q.ek; });
    var keys = Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); });
    ek.innerHTML = '<option value="">All EKs</option>' + keys.map(function (k) { return '<option value="' + esc(set[k]) + '">' + esc(k) + '</option>'; }).join('');
    ek.value = curE; if (ek.value !== curE) ek.value = '';
  }
  function matches(q) {
    var s = val('tgSubject'), u = val('tgUnit'), e = val('tgEk'), d = val('tgDiff'), t = val('tgSearch').trim().toLowerCase();
    if (s && q.subject !== s) return false;
    if (u && String(q.unit) !== u) return false;
    if (e && q.subject + '|' + q.ek !== e) return false;
    if (d && q.difficulty !== d) return false;
    if (t) {
      var hay = (q.stem + ' ' + q.caseHeadline + ' ' + q.ek + ' ' + q.choices.map(function (c) { return c.text; }).join(' ')).toLowerCase();
      if (hay.indexOf(t) < 0) return false;
    }
    return true;
  }
  ['tgSubject', 'tgUnit'].forEach(function (id) { $(id).addEventListener('change', function () { fillSelects(); shown = PAGE; render(); }); });
  ['tgEk', 'tgDiff'].forEach(function (id) { $(id).addEventListener('change', function () { shown = PAGE; render(); }); });
  $('tgSearch').addEventListener('input', function () { shown = PAGE; render(); });

  /* ---------- results ---------- */
  function meta(q) {
    return '<span>' + (q.subject === 'AP Networking' ? 'AP Net' : 'AP Cyber') + ' · Unit ' + q.unit + '</span><span>EK ' + esc(q.ek) + '</span><span>' + esc(q.skill) + '</span><span>' + esc(q.difficulty) + '</span>';
  }
  function render() {
    var list = all.filter(matches), box = $('tgList');
    $('tgCount').textContent = list.length + ' question' + (list.length === 1 ? '' : 's');
    box.innerHTML = list.slice(0, shown).map(function (q) {
      var on = sel.indexOf(q.id) >= 0;
      return '<article class="tgq' + (on ? ' on' : '') + '"><div class="tgq-meta">' + meta(q) + '</div>' +
        '<p class="tgq-stem">' + esc(q.stem) + '</p><ol class="tgq-ch" type="A">' +
        q.choices.map(function (c) { return '<li>' + esc(c.text) + '</li>'; }).join('') + '</ol>' +
        '<div class="tgq-foot"><span class="tgq-case">From: ' + (q.sourceUrl ? '<a href="' + esc(q.sourceUrl) + '" target="_blank" rel="noopener">' + esc(q.caseHeadline) + '</a>' : esc(q.caseHeadline)) + '</span>' +
        '<button type="button" class="btn' + (on ? '' : ' primary') + '" data-pick="' + esc(q.id) + '" aria-pressed="' + on + '">' + (on ? 'Remove' : 'Add to test') + '</button></div></article>';
    }).join('');
    $('tgMore').hidden = list.length <= shown;
  }
  $('tgMore').addEventListener('click', function () { shown += PAGE; render(); });
  root.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pick]');
    if (b) { toggle(b.getAttribute('data-pick')); return; }
    var m = e.target.closest('[data-move]');
    if (m) {
      var id = m.getAttribute('data-id'), i = sel.indexOf(id), j = i + Number(m.getAttribute('data-move'));
      if (m.getAttribute('data-move') === 'x') { sel.splice(i, 1); }
      else if (j >= 0 && j < sel.length) { sel.splice(i, 1); sel.splice(j, 0, id); }
      changed();
    }
  });
  function toggle(id) { var i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); changed(); }
  function changed() { arrangement = null; $('tgPreview').hidden = true; save(); render(); renderSel(); }

  /* ---------- selection ---------- */
  function renderSel() {
    $('tgSelCount').textContent = sel.length;
    $('tgSelList').innerHTML = sel.length ? sel.map(function (id, i) {
      var q = byId[id];
      return '<li><span class="n">' + (i + 1) + '.</span><span class="t">' + esc(q.stem) + '</span><span class="ctl">' +
        '<button type="button" data-move="-1" data-id="' + esc(id) + '" aria-label="Move up">↑</button>' +
        '<button type="button" data-move="1" data-id="' + esc(id) + '" aria-label="Move down">↓</button>' +
        '<button type="button" data-move="x" data-id="' + esc(id) + '" aria-label="Remove">✕</button></span></li>';
    }).join('') : '<li class="empty">No questions selected yet. Use "Add to test" on any question.</li>';
    ['tgPrevBtn', 'tgWordBtn', 'tgClear'].forEach(function (b) { $(b).disabled = !sel.length; });
  }
  $('tgClear').addEventListener('click', function () { sel = []; changed(); });
  ['tgShufQ', 'tgShufC'].forEach(function (id) { $(id).addEventListener('change', function () { arrangement = null; $('tgPreview').hidden = true; }); });

  /* ---------- arrangement (randomize, then key) ---------- */
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function arrange() {
    var ids = $('tgShufQ').checked ? shuffle(sel) : sel.slice();
    return ids.map(function (id) { var q = byId[id]; return { q: q, choices: $('tgShufC').checked ? shuffle(q.choices) : q.choices.slice() }; });
  }
  function title() { return val('tgTitle').trim() || 'Cyber Casebook Quiz'; }
  $('tgPrevBtn').addEventListener('click', function () {
    arrangement = arrange();
    var p = $('tgPreview');
    p.innerHTML = '<div class="tgp-head"><h3>' + esc(title()) + '</h3><p>Name ____________________ Date __________ Period ____</p></div><ol class="tgp-q">' +
      arrangement.map(function (a) { return '<li><p>' + esc(a.q.stem) + '</p><ol type="A">' + a.choices.map(function (c) { return '<li>' + esc(c.text) + '</li>'; }).join('') + '</ol></li>'; }).join('') +
      '</ol><p class="tgp-note">The answer key is added on its own last page when you download.</p>';
    p.hidden = false; p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Word export ---------- */
  $('tgWordBtn').addEventListener('click', function () {
    if (!arrangement) arrangement = arrange();
    var arr = arrangement, btn = $('tgWordBtn'), msg = $('tgMsg');
    btn.disabled = true; msg.textContent = 'Building your Word file...';
    jsonp(FEED + '?view=key&ids=' + encodeURIComponent(arr.map(function (a) { return a.q.id; }).join(',')))
      .then(function (d) {
        if (!d || !d.key) throw new Error('key');
        var missing = arr.filter(function (a) { return !d.key[a.q.id]; });
        if (missing.length) throw new Error('missing');
        var blob = docx(title(), arr, d.key);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = title().replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) + '.docx';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        msg.textContent = 'Downloaded. To use it in Google Drive, upload it and choose Open with > Google Docs.';
      })
      .catch(function (e) {
        msg.textContent = e.message === 'missing' ? 'One or more selected questions were just retired. Remove them and try again.' : 'The answer key could not be loaded. Please try again in a minute.';
      })
      .then(function () { btn.disabled = false; });
  });

  function x(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function run(t, o) {
    o = o || {};
    return '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' + (o.b ? '<w:b/>' : '') + (o.i ? '<w:i/>' : '') +
      '<w:sz w:val="' + (o.sz || 22) + '"/></w:rPr><w:t xml:space="preserve">' + x(t) + '</w:t></w:r>';
  }
  function para(runs, o) {
    o = o || {};
    return '<w:p><w:pPr>' + (o.keep ? '<w:keepNext/>' : '') + (o.center ? '<w:jc w:val="center"/>' : '') +
      '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after == null ? 80 : o.after) + '"/>' +
      (o.ind ? '<w:ind w:left="' + o.ind + '" w:hanging="' + (o.hang || 0) + '"/>' : '') + '</w:pPr>' + runs + '</w:p>';
  }
  function docx(t, arr, key) {
    var L = 'ABCD', body = '';
    body += para(run(t, { b: true, sz: 32 }), { center: true, after: 120 });
    body += para(run('Name ______________________________   Date ______________   Period ______'), { after: 280 });
    arr.forEach(function (a, i) {
      body += para(run((i + 1) + '. ', { b: true }) + run(a.q.stem), { keep: true, before: 160, ind: 360, hang: 360 });
      a.choices.forEach(function (c, k) { body += para(run(L[k] + '. ' + c.text), { keep: k < 3, ind: 720, hang: 360, after: 40 }); });
    });
    body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    body += para(run('Answer Key - ' + t, { b: true, sz: 28 }), { after: 200 });
    arr.forEach(function (a, i) {
      var k = key[a.q.id], letter = '?';
      a.choices.forEach(function (c, j) { if (c.id === k.correct) letter = L[j]; });
      body += para(run((i + 1) + '. ' + letter, { b: true }) + run('   (' + (a.q.subject === 'AP Networking' ? 'AP Net' : 'AP Cyber') + ' Unit ' + a.q.unit + ' · EK ' + a.q.ek + ' · ' + a.q.skill + ')', { sz: 18 }), { keep: true, before: 120, after: 20 });
      body += para(run(k.rationale, { sz: 20 }), { ind: 360 });
    });
    var doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body +
      '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>';
    return zip([
      ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
      ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
      ['word/document.xml', doc]
    ]);
  }

  /* Minimal ZIP writer (stored, no compression). */
  var CRC = (function () { var t = [], c; for (var n = 0; n < 256; n++) { c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(entries) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    function h(n, v) { var a = new Uint8Array(n); for (var i = 0; i < n; i++) a[i] = (v / Math.pow(256, i)) & 255; return a; }
    entries.forEach(function (e) {
      var name = enc.encode(e[0]), data = enc.encode(e[1]), crc = crc32(data);
      var common = [h(2, 20), h(2, 0x0800), h(2, 0), h(2, 0), h(2, 0x21), h(4, crc), h(4, data.length), h(4, data.length), h(2, name.length), h(2, 0)];
      var local = [h(4, 0x04034b50)].concat(common, [name, data]);
      central.push([h(4, 0x02014b50), h(2, 20)].concat(common, [h(2, 0), h(2, 0), h(2, 0), h(4, 0), h(4, off), name]));
      local.forEach(function (p) { parts.push(p); off += p.length; });
    });
    var cdStart = off, cdLen = 0;
    central.forEach(function (c) { c.forEach(function (p) { parts.push(p); cdLen += p.length; }); });
    parts.push(h(4, 0x06054b50), h(2, 0), h(2, 0), h(2, entries.length), h(2, entries.length), h(4, cdLen), h(4, cdStart), h(2, 0));
    return new Blob(parts, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  window.__tgDocx = docx;   // used by the build check only
})();
