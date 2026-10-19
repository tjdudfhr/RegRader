/* 실무 판단: 개정마다 회사가 해야 할 일 · 대상 조건 · 바뀐 숫자 · 조문 전후 (scripts/amend_actions.py 가 매일 만든다)
 *   amend_actions.json        이벤트 키 -> { v: act|check|tidy, acts:[…], nums:[…], n:{…} }
 *   oan/<법령일련번호>.json   바뀐 조문 전·후 — 상세 화면에서 '바뀐 조문 전후'를 펼 때 받는다
 *
 * window.rrJudge
 *   .ready            자료를 다 읽으면 끝나는 Promise
 *   .verdict(item)    'act' | 'check' | 'tidy' | null
 *   .acts(item)       해야 할 일 목록 (당사 해당 → 기준 확인 → 해당 시 순)
 *   .section(item)    상세 화면 '실무 판단' 칸 { body, extra } | null
 */
(function () {
  var DATA = null, promise = null, OAN = {};
  var FIT = { yes: ['당사 해당', 'yes'], no: ['당사 비해당', 'no'], cond: ['기준 확인', 'cond'], 'if': ['해당 시', 'if'] };
  var FIT_ORDER = { yes: 0, cond: 1, 'if': 2, no: 3 };
  var DUTY = /((?:여야|해야|아야|어야|워야|켜야|와야|러야|라야|려야|져야)\s*한다|아니\s*된다|안\s*된다|하지\s*못한다)/g;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function short(t) { return t === '일부개정' ? '일' : t === '타법개정' ? '타' : (t || ''); }
  function keyOf(it) { return it ? (it.title + '|' + it.effectiveDate + '|' + short(it.amendmentType)) : ''; }
  function dataPath(f) { return window.rrDataPath ? window.rrDataPath(f) : './' + f; }

  function refreshModal() {
    var m = document.getElementById('law-modal');
    if (m && m.classList.contains('show') && window.__rrBriefRefresh) window.__rrBriefRefresh();
  }
  function load() {
    if (!promise) {
      promise = fetch(dataPath('amend_actions.json') + '?v=' + Date.now(), { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { DATA = j || { items: {} }; refreshModal(); })
        .catch(function () { DATA = { items: {} }; });
    }
    return promise;
  }
  setTimeout(load, 2800);

  /* undefined = 아직 안 받음, null = 이 개정은 분석 없음(행정규칙 · 자료 없음) */
  function get(it) {
    if (!it || it.kind) return null;
    if (!DATA) { load(); return undefined; }
    return (DATA.items || {})[keyOf(it)] || null;
  }
  function verdict(it) { var d = get(it); return d ? d.v : null; }
  function acts(it) {
    var d = get(it);
    if (!d || !d.acts) return [];
    return d.acts.slice().sort(function (a, b) {
      return (FIT_ORDER[a.fit] - FIT_ORDER[b.fit]) || ((a.state === '신설' ? 0 : 1) - (b.state === '신설' ? 0 : 1));
    });
  }

  function duty(s) { return esc(s).replace(DUTY, '<b>$1</b>'); }
  function condText(c) {
    if (!c) return '';
    if (c.deleg) return esc(c.t) + ' — 하위 법령 기준 확인';
    if (c.why) return esc(c.t) + (c.src ? ' (' + esc(c.src) + ')' : '') + ' → ' + esc(c.why) + (c.ok ? ' 해당' : ' 비해당');
    return esc(c.t);
  }
  function actHtml(a) {
    var f = FIT[a.fit] || FIT['if'];
    var meta = [];
    if (a.who) meta.push('<span><i>대상</i>' + esc(a.who) + '</span>');
    if (a.cond) meta.push('<span><i>기준</i>' + condText(a.cond) + '</span>');
    if (a.when) meta.push('<span><i>시기</i>' + esc(a.when) + '</span>');
    return '<li class="rr-jd-act fit-' + f[1] + '">' +
      '<div class="rr-jd-top"><span class="rr-jd-type">' + esc(a.type) + '</span>' +
      '<span class="rr-jd-state ' + (a.state === '신설' ? 'new' : 'chg') + '">' + esc(a.state) + '</span>' +
      '<span class="rr-jd-fit ' + f[1] + '">' + f[0] + '</span>' +
      '<span class="rr-jd-ref">' + esc(a.ref) + (a.title ? ' · ' + esc(a.title) : '') + '</span></div>' +
      '<p class="rr-jd-text">' + duty(a.text) + '</p>' +
      (a.items && a.items.length ? '<ul class="rr-jd-items">' + a.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
      (meta.length ? '<div class="rr-jd-meta">' + meta.join('') + '</div>' : '') +
      (a.before ? '<details class="rr-jd-before"><summary>변경 전</summary><p>' + esc(a.before) + '</p></details>' : '') +
      '</li>';
  }

  function section(it) {
    var d = get(it);
    if (d === undefined) return { body: '<div class="rr-jd-wait">실무 판단을 불러오는 중입니다…</div>', extra: '' };
    if (!d) return null;
    var list = acts(it);
    var cnt = { yes: 0, cond: 0, 'if': 0, no: 0 };
    list.forEach(function (a) { cnt[a.fit] = (cnt[a.fit] || 0) + 1; });
    var V = { act: ['회사 할 일', 'act'], check: ['숫자 · 기준 확인', 'check'], tidy: ['정비만', 'tidy'] }[d.v] || ['정비만', 'tidy'];
    var chips = [];
    if (cnt.yes) chips.push('<span class="c-yes">당사 해당 <b>' + cnt.yes + '</b></span>');
    if (cnt.cond) chips.push('<span class="c-cond">기준 확인 <b>' + cnt.cond + '</b></span>');
    if (cnt['if']) chips.push('<span class="c-if">해당 시 <b>' + cnt['if'] + '</b></span>');
    if (cnt.no) chips.push('<span class="c-no">당사 비해당 <b>' + cnt.no + '</b></span>');
    if (d.nums && d.nums.length) chips.push('<span>숫자 변경 <b>' + d.nums.length + '</b></span>');
    if (d.n && d.n.tidy) chips.push('<span>정비 <b>' + d.n.tidy + '</b>개 조</span>');
    var h = '<div class="rr-jd"><div class="rr-jd-sum"><span class="rr-jd-v ' + V[1] + '">' + V[0] + '</span>' + chips.join('') + '</div>';
    if (list.length) {
      var head = list.slice(0, 6), rest = list.slice(6);
      h += '<ol class="rr-jd-acts">' + head.map(actHtml).join('') + '</ol>';
      if (rest.length) h += '<details class="rr-jd-more"><summary>나머지 ' + rest.length + '건</summary><ol class="rr-jd-acts">' + rest.map(actHtml).join('') + '</ol></details>';
    }
    if (d.nums && d.nums.length) {
      h += '<table class="rr-jd-nums"><thead><tr><th>조항</th><th>변경 전</th><th></th><th>변경 후</th></tr></thead><tbody>' +
        d.nums.map(function (x) {
          return '<tr' + (x.s ? ' class="s"' : '') + '><td>' + esc(x.ref) + (x.title ? '<small>' + esc(x.title) + '</small>' : '') + '</td><td class="b">' + esc(x.b) + '</td><td class="ar">→</td><td class="a">' + esc(x.a) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    var u = it.meta && it.meta.lsiSeq;
    if (u && d.n && d.n.art) {
      h += '<details class="rr-jd-cmp" data-u="' + esc(u) + '" data-arts="' + esc((d.arts || []).join('|')) + '"><summary>바뀐 조문 전후 <b>' + d.n.art + '</b>개 조</summary><div class="rr-jd-cmp-b">불러오는 중…</div></details>';
    }
    h += '</div>';
    var extra = list.length ? '<span class="rr-sec-extra">할 일 ' + list.length + '</span>' : '';
    return { body: h, extra: extra };
  }

  /* ---------- 바뀐 조문 전후 (펼칠 때 받는다) ---------- */
  function marks(s) { return esc(s).replace(/&lt;P&gt;/g, '<mark>').replace(/&lt;\/P&gt;/g, '</mark>'); }
  var KIND = { '신설': 'new', '삭제': 'del', '변경': 'chg' };
  function cmpHtml(j, only) {
    var arts = (j && j.arts) || [];
    /* 시행일이 나뉜 개정: 이 시행일에 들어가는 조문만 */
    if (only && only.length) arts = arts.filter(function (a) { return only.indexOf(a.ref) >= 0; });
    if (!arts.length) return '<div class="rr-jd-wait">바뀐 조문이 없습니다.</div>';
    return arts.map(function (a) {
      return '<div class="rr-jd-art"><div class="rr-jd-art-h">' + esc(a.ref || '') + (a.title ? ' <span>' + esc(a.title) + '</span>' : '') + '</div>' +
        a.items.map(function (x) {
          return '<div class="rr-jd-pair ' + (KIND[x.k] || 'chg') + '"><span class="k">' + esc(x.k) + '</span>' +
            '<div class="o">' + (x.o ? marks(x.o) : '<em>없음</em>') + '</div><div class="n">' + (x.n ? marks(x.n) : '<em>삭제</em>') + '</div></div>';
        }).join('') + '</div>';
    }).join('');
  }
  document.addEventListener('toggle', function (e) {
    var el = e.target;
    if (!el || !el.classList || !el.classList.contains('rr-jd-cmp') || !el.open) return;
    var u = el.getAttribute('data-u'), box = el.querySelector('.rr-jd-cmp-b');
    var only = (el.getAttribute('data-arts') || '').split('|').filter(Boolean);
    if (!u || !box) return;
    if (OAN[u]) { box.innerHTML = cmpHtml(OAN[u], only); return; }
    fetch(dataPath('oan/' + u + '.json'), { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { OAN[u] = j; box.innerHTML = cmpHtml(j, only); })
      .catch(function () {
        box.innerHTML = '<div class="rr-jd-wait">불러오지 못했습니다. <a href="https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + encodeURIComponent(u) + '&viewCls=lsOldAndNew" target="_blank" rel="noopener">법령정보센터 신구조문 비교 ↗</a></div>';
      });
  }, true);

  window.rrJudge = { ready: load(), verdict: verdict, acts: acts, section: section, keyOf: keyOf };
})();
