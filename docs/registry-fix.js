/* 적용법규 탭: 법령(base_laws_207.json) + 그 계열에 연결된 행정규칙(admrul_index.json, 참고용 제외) */
(function () {
  var BASE = null, LAWS = null;
  /* 행정규칙을 적용법규 목록에 합친다 (family-ui.js 가 읽어 둔 것) */
  function mergeAdmrul() {
    var F = window.rrFamilies;
    var adm = F && F.admrul ? F.admrul() : [];
    if (!LAWS || !adm.length) return false;
    BASE = LAWS.concat(adm.map(function (a) {
      return { title: a.title, categories: a.category ? [a.category] : [], lawType: '행정규칙', kind: a.kind, admSeq: a.admSeq, family: a.family };
    }));
    return true;
  }
  function setCounts(items) {
    var CATS = ['인사노무','공정거래','정보보호','지식재산권','재무회계','안전','환경','지배구조'];
    var c = {}; CATS.forEach(function (k) { c[k] = 0; });
    (items || []).forEach(function (law) {
      (law.categories || []).forEach(function (k) { if (c[k] != null) c[k]++; });
    });
    CATS.forEach(function (k) {
      var el = document.getElementById('job-count-' + k);
      if (el) el.textContent = String(c[k]);
    });
    var all = document.getElementById('job-count-all');
    if (all) all.textContent = String((items || []).length);
    var tab = document.getElementById('lawregistry-tab-count');
    if (tab) tab.textContent = String((items || []).length || '–');
    var tot = document.getElementById('registry-total-count');
    if (tot) tot.textContent = String((items || []).length || '–');
    /* 적용법규 수는 목록 파일에서 센다 (법규 추가 시 자동 반영) */
    if (items && items.length && window.__rrSetBaseCount) window.__rrSetBaseCount(items.length);
  }
  var cur = 'all', curTitle = null;
  /* 보기 방식: 계열(법률 → 시행령 → 시행규칙으로 묶음, 기본) / 목록(가나다순). 고른 것은 이 브라우저에 기억한다. */
  var MODE = 'family';
  try { MODE = localStorage.getItem('rr_reg_mode') === 'list' ? 'list' : 'family'; } catch (e) {}
  function escH(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function modeToggle() {
    var cnt = document.getElementById('job-function-count');
    if (!cnt || document.getElementById('rr-reg-mode')) return;
    var box = document.createElement('div');
    box.id = 'rr-reg-mode';
    box.className = 'rr-reg-mode';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '보기 방식');
    box.innerHTML = '<button type="button" data-mode="family" title="법률 · 시행령 · 시행규칙을 계열로 묶어 보기">계열</button>' +
                    '<button type="button" data-mode="list" title="가나다순 목록">목록</button>';
    cnt.parentNode.insertBefore(box, cnt);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]');
      if (!b) return;
      MODE = b.dataset.mode;
      try { localStorage.setItem('rr_reg_mode', MODE); } catch (err) {}
      render(cur, curTitle);
    });
  }
  function familyView(view, job) {
    var F = window.rrFamilies;
    var fams = F && F.all ? F.all() : [];
    if (!fams.length) return null;
    var catOf = {};
    BASE.forEach(function (b) { catOf[b.title] = (b.categories || [])[0]; });
    var inView = {};
    view.forEach(function (b) { inView[b.title] = 1; });
    var list = fams.filter(function (f) { return f.members.some(function (m) { return m.inBase && inView[m.title]; }); });
    var amended = 0, outN = 0, staleN = 0, evN = 0, admEv = 0, refN = 0, nLaw = 0, nAdm = 0;
    var cards = list.map(function (f) {
      var n = 0, cats = {};
      f.members.forEach(function (m) {
        var adm = m.level === '행정규칙';
        if (!m.inBase) { if (adm) refN++; else outN++; return; }
        if (m.notFound) staleN++;
        if (adm) nAdm++; else nLaw++;
        var e = (F.eventsOf ? F.eventsOf(m) : F.events(m.title)).length;
        n += e;
        if (adm) admEv += e;
        var c = catOf[m.title] || m.category;
        if (c && !adm) cats[c] = 1;
      });
      if (n) amended++;
      evN += n;
      var chips = Object.keys(cats).map(function (c) {
        return '<span class="rr-rf-cat" style="--c:' + (window.rrCatColor ? window.rrCatColor(c) : '#667eea') + '">' + escH(c) + '</span>';
      }).join('');
      return '<div class="rr-rf">' +
        '<div class="rr-rf-h"><b>' + escH(f.root) + '</b>' + chips +
        '<span class="rr-rf-n' + (n ? '' : ' zero') + '">' + (n ? '올해 개정 ' + n + '건' : '올해 개정 없음') + '</span></div>' +
        (F.block ? F.block(f) : f.members.map(function (m) { return F.row(f, m); }).join('')) + '</div>';
    }).join('');
    var sum = '<div class="rr-rf-sum"><b>' + list.length + '개 계열</b> · 적용법규 ' + (nLaw + nAdm).toLocaleString('ko-KR') + '개 (법령 ' + nLaw + ' · 행정규칙 ' + nAdm.toLocaleString('ko-KR') + ')' +
      ' · 올해 개정 ' + evN + '건' + (admEv ? ' (행정규칙 ' + admEv + ')' : '') +
      (refN ? ' · <span title="정부 내부용 등 회사 준수사항과 거리가 먼 행정규칙은 적용법규로 세지 않고 흐리게만 보여 줍니다">참고용 행정규칙 ' + refN + '개 (흐리게)</span>' : '') +
      (outN ? ' · <span title="국가법령정보센터 법령체계도상 이 계열에 속하지만 적용법규 목록에는 없는 하위법령">적용법규에 없는 하위법령 ' + outN + '개 (흐리게)</span>' : '') +
      (staleN ? ' · <span class="warn">⚠ 법령명 확인 필요 ' + staleN + '개</span>' : '') + '</div>';
    return { html: sum + (cards || '<div style="padding:2rem;text-align:center;color:var(--text-muted)">해당 직무의 적용법규가 없습니다.</div>'), count: list.length };
  }
  function render(job, title) {
    if (!BASE) return;
    cur = job; curTitle = title;
    try {
      document.querySelectorAll('.job-function-item').forEach(function (el) { el.classList.remove('active'); });
      var active = document.querySelector('[data-job="' + job + '"]');
      if (active) active.classList.add('active');
    } catch (e) {}
    var view = BASE;
    if (job && job !== 'all') view = BASE.filter(function (law) { return (law.categories || []).indexOf(job) >= 0; });
    view = view.slice().sort(function (a, b) {
      return String(a.title || '').localeCompare(String(b.title || ''), 'ko-KR');
    });
    var icon = document.getElementById('job-function-icon');
    var head = document.getElementById('job-function-title');
    var cnt = document.getElementById('job-function-count');
    if (icon) icon.textContent = job === 'all' ? '📋' : '📚';
    if (head) head.textContent = job === 'all' ? '전체 적용 법규' : String(title || job).replace(/^\S+\s/, '') + ' 적용 법규';
    if (cnt) cnt.textContent = view.length + '건';
    var host = document.getElementById('job-function-laws');
    if (!host) {
      var items = document.querySelectorAll('.registry-law-item');
      if (items.length && items[0].parentNode) host = items[0].parentNode;
    }
    if (!host) return;
    modeToggle();
    document.querySelectorAll('#rr-reg-mode button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === MODE); });
    if (MODE === 'family') {
      var fam = familyView(view, job);
      if (fam) {
        if (cnt) cnt.textContent = fam.count + '개 계열 · ' + view.length + '건';
        host.innerHTML = fam.html;
        host.style.maxHeight = '72vh';
        host.setAttribute('data-rr', String(job));
        host.setAttribute('data-mode', 'family');
        return;
      }
    }
    host.style.maxHeight = '';
    host.setAttribute('data-mode', 'list');
    /* 올해 개정 이벤트가 있는 법규는 다른 탭과 똑같이 개정요지 팝업을 띄운다.
       (예전에는 전부 law.go.kr 새 탭으로 보내서, 적용법규 탭에서만 팝업이 안 뜨는 것처럼 보였다.)
       개정 이력이 없는 법규만 원문 검색으로 보낸다. */
    var events = window.__rrItems || [];
    var byTitle = {};
    events.forEach(function (ev) { (byTitle[ev.title] = byTitle[ev.title] || []).push(ev); });

    host.innerHTML = view.map(function (law) {
      var title = String(law.title || '');
      var evs = byTitle[title] || [];
      var esc = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      var kindTag = law.lawType === '행정규칙' ? '<span style="margin-right:8px;padding:1px 7px;border-radius:6px;border:1px solid rgba(15,118,110,.4);' +
                    'color:#0f766e;font-size:11px;font-weight:800">' + escH(law.kind || '행정규칙') + '</span>' : '';
      if (evs.length) {
        var badge = '<span style="margin-left:8px;padding:1px 7px;border-radius:999px;background:#eef2ff;' +
                    'color:#4f46e5;font-size:11px;font-weight:700">올해 개정 ' + evs.length + '건</span>';
        return '<div class="registry-law-item" data-eid="' + evs[0].id + '" style="cursor:pointer">' +
               kindTag + '<span>' + esc + '</span>' + badge + '</div>';
      }
      var url = law.admSeq ? 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=' + encodeURIComponent(law.admSeq)
        : 'https://www.law.go.kr/lsSc.do?query=' + encodeURIComponent(title);
      return '<div class="registry-law-item" title="올해 개정 없음 · 국가법령정보센터에서 원문 보기" ' +
             'onclick="window.open(\'' + url.replace(/'/g, '') + '\',\'_blank\')" style="cursor:pointer">' +
             kindTag + '<span>' + esc + '</span>' +
             '<span style="margin-left:8px;color:#94a3b8;font-size:11px">올해 개정 없음</span></div>';
    }).join('');
    host.setAttribute('data-rr', String(job));
  }
  function hook() {
    if (!BASE) return;
    window.baseLawsData = BASE;
    window.showJobFunctionLaws = function (job, title) { render(job, title); };
    setCounts(BASE);
    /* 적용법규 탭을 처음 열 때도 207개 전체 목록이 보여야 한다.
       예전에는 직무 칩을 눌러야만 render 가 돌아서, 초기에는 index.html 이 그린
       옛 목록과 '100건' 머리글이 그대로 남아 있었다. */
    var host = document.getElementById('job-function-laws');
    if (host && host.getAttribute('data-rr') !== String(cur)) render(cur, curTitle);
  }
  /* 계열 자료와 개정 이벤트가 늦게 도착하면 한 번 더 그린다 */
  if (window.rrFamilies && window.rrFamilies.ready) window.rrFamilies.ready.then(function () {
    if (mergeAdmrul()) { window.baseLawsData = BASE; setCounts(BASE); }
    if (BASE) render(cur, curTitle);
  });
  var tries = 0;
  var waitItems = setInterval(function () {
    if ((window.__rrItems || []).length || ++tries > 40) {
      clearInterval(waitItems);
      if (BASE) render(cur, curTitle);
    }
  }, 250);
  fetch('./base_laws_207.json?v=20260915s', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      LAWS = j.items || j || [];
      BASE = LAWS;
      mergeAdmrul();
      hook();
      var n = 0;
      var t = setInterval(function () { hook(); if (++n > 50) clearInterval(t); }, 250);
    }).catch(function () {});
})();
