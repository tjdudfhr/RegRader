/* 적용법규 추가 요청
 * 적용법규 탭의 [+ 법규 추가] → 법령명·직무 입력 → 내용이 채워진 GitHub Issue(라벨 law-add) 작성 화면을 연다.
 * 국내 IP 컴퓨터의 scripts/process_requests.sh 가 10분마다 요청을 읽어 법령정보센터에서 검증하고
 * docs/base_laws_207.json 에 추가한 뒤 개정 데이터를 다시 수집한다.
 */
(function () {
  'use strict';
  var REPO = 'tjdudfhr/RegRader';
  var LABEL = 'law-add';
  var CATS = [['인사노무', '👥'], ['공정거래', '⚖️'], ['정보보호', '🔒'], ['지식재산권', '💡'], ['재무회계', '💰'], ['안전', '🛡️'], ['환경', '🌱'], ['지배구조', '🏛️']];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function compact(s) { return String(s || '').replace(/[\s·ㆍ・.]/g, ''); }

  var css = document.createElement('style');
  css.textContent = [
    '.rr-add-btn { display:inline-flex; align-items:center; gap:6px; padding:0.6rem 1rem; border-radius:12px; border:1px solid var(--primary); background:var(--primary-gradient); color:#fff; font:600 0.9rem Inter,-apple-system,sans-serif; cursor:pointer; box-shadow:0 4px 16px rgba(102,126,234,.3); transition:transform .2s ease; }',
    '.rr-add-btn:hover { transform:translateY(-2px); }',
    '.rr-pending { font-size:0.8rem; color:var(--text-muted); margin-top:6px; text-align:right; }',
    '.rr-pending b { color:#dd6b20; }',
    '#rr-add-modal { position:fixed; inset:0; z-index:3000; display:none; }',
    '.rr-cats { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; } .rr-cats .rr-chipx { justify-content:center; }',
    '@media (max-width:600px){ .rr-cats { grid-template-columns:repeat(2,1fr); } }'
  ].join('\n');
  document.head.appendChild(css);

  var baseTitles = null;
  function loadBase() {
    if (baseTitles) return Promise.resolve(baseTitles);
    return fetch('./base_laws_207.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { baseTitles = (d.items || []).map(function (x) { return x.title; }); return baseTitles; })
      .catch(function () { return []; });
  }

  function buildModal() {
    var m = document.createElement('div');
    m.id = 'rr-add-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    var ic = function (n) { return window.rrIcon ? window.rrIcon(n) : ''; };
    var dot = function (c) { return window.rrCatColor ? window.rrCatColor(c) : '#a0aec0'; };
    m.innerHTML =
      '<div class="rr-dlg" style="--dlg-w:540px">' +
        '<div class="rr-dlg-h"><span class="rr-dlg-ic">' + ic('plus') + '</span><div class="rr-dlg-t"><h2>적용법규 추가</h2><p>추가하면 그 법령의 개정을 매일 자동으로 확인합니다</p></div>' +
        '<button class="rr-dlg-x rr-add-x" type="button" aria-label="닫기">' + ic('x') + '</button></div>' +
        '<div class="rr-dlg-b"><section class="rr-box" style="display:flex;flex-direction:column;gap:12px">' +
          '<label class="rr-f"><span>법령명</span><input type="text" id="rr-add-name" placeholder="예: 중대재해 처벌 등에 관한 법률" autocomplete="off"></label>' +
          '<div class="rr-warn" id="rr-add-dup" style="display:none"></div>' +
          '<div class="rr-f"><span>직무</span><div class="rr-cats" id="rr-add-cats">' + CATS.map(function (c) {
            return '<button type="button" class="rr-chipx" data-cat="' + c[0] + '"><i style="background:' + dot(c[0]) + '"></i>' + c[0] + '</button>';
          }).join('') + '</div></div>' +
          '<label class="rr-sw"><input type="checkbox" id="rr-add-sub" checked><i></i>시행령·시행규칙도 함께 추가</label>' +
          '<label class="rr-f"><span>메모 (선택)</span><textarea id="rr-add-memo" placeholder="추가 사유 등"></textarea></label>' +
        '</section></div>' +
        '<div class="rr-dlg-f"><span class="sp">GitHub 요청 화면에서 Submit 을 누르면 10분 안에 반영됩니다</span>' +
          '<button class="rr-btn pri" id="rr-add-go" type="button" disabled>' + ic('send') + '요청 등록</button></div>' +
      '</div>';
    document.body.appendChild(m);

    var name = m.querySelector('#rr-add-name');
    var go = m.querySelector('#rr-add-go');
    var dup = m.querySelector('#rr-add-dup');
    var cat = '';
    function validate() {
      var v = name.value.trim();
      var hit = v && baseTitles && baseTitles.filter(function (t) { return compact(t) === compact(v); })[0];
      dup.style.display = hit ? 'block' : 'none';
      dup.textContent = hit ? '「' + hit + '」은(는) 이미 적용법규에 있습니다.' : '';
      go.disabled = !(v && cat && !hit);
    }
    name.addEventListener('input', validate);
    m.querySelectorAll('#rr-add-cats button').forEach(function (b) {
      b.addEventListener('click', function () {
        m.querySelectorAll('#rr-add-cats button').forEach(function (x) { x.classList.toggle('on', x === b); });
        cat = b.getAttribute('data-cat');
        validate();
      });
    });
    function close() { m.classList.remove('show'); }
    m.querySelector('.rr-add-x').addEventListener('click', close);
    m.addEventListener('click', function (e) { if (e.target === m) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.classList.contains('show')) close(); });
    go.addEventListener('click', function () {
      var v = name.value.trim();
      var body = [
        '<!-- RegRader 적용법규 추가 요청 — 아래 형식은 그대로 두세요 -->',
        '법령명: ' + v,
        '직무: ' + cat,
        '하위법령 함께 추가: ' + (m.querySelector('#rr-add-sub').checked ? '예' : '아니오'),
        '메모: ' + m.querySelector('#rr-add-memo').value.trim().replace(/\n+/g, ' '),
        '',
        '_RegRader 사이트에서 작성된 요청입니다. 처리 결과는 이 요청에 댓글로 남습니다._'
      ].join('\n');
      var url = 'https://github.com/' + REPO + '/issues/new?labels=' + LABEL +
        '&title=' + encodeURIComponent('[적용법규 추가] ' + v) + '&body=' + encodeURIComponent(body);
      window.open(url, '_blank', 'noopener');
      close();
      setTimeout(loadPending, 20000);
    });
    return m;
  }

  var modal = null;
  function open() {
    modal = modal || buildModal();
    modal.classList.add('show');
    loadBase().then(function () { modal.querySelector('#rr-add-name').dispatchEvent(new Event('input')); });
    setTimeout(function () { modal.querySelector('#rr-add-name').focus(); }, 50);
  }

  /* 처리 대기 중인 요청 (GitHub 공개 API) */
  function loadPending() {
    var el = document.getElementById('rr-pending');
    if (!el) return;
    fetch('https://api.github.com/repos/' + REPO + '/issues?labels=' + LABEL + '&state=open&per_page=10')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        if (!Array.isArray(list) || !list.length) { el.innerHTML = ''; return; }
        el.innerHTML = '<b>처리 대기 ' + list.length + '건</b> · ' + list.map(function (i) {
          return '<a href="' + esc(i.html_url) + '" target="_blank" rel="noopener" style="color:inherit">' + esc(String(i.title).replace('[적용법규 추가] ', '')) + '</a>';
        }).join(', ');
      })
      .catch(function () {});
  }

  function mount() {
    var tot = document.getElementById('registry-total-count');
    if (!tot || document.getElementById('rr-add-btn')) return;
    var row = tot.parentNode.parentNode;
    var wrap = document.createElement('div');
    wrap.innerHTML = '<button type="button" class="rr-add-btn" id="rr-add-btn">＋ 법규 추가</button><div class="rr-pending" id="rr-pending"></div>';
    row.appendChild(wrap);
    wrap.querySelector('#rr-add-btn').addEventListener('click', open);
    loadPending();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
