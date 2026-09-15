/* 적용법규 탭은 항상 base 207개만 사용 */
(function () {
  var BASE = null;
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
    if (tab) tab.textContent = String((items || []).length || 207);
    var tot = document.getElementById('registry-total-count');
    if (tot) tot.textContent = String((items || []).length || 207);
  }
  function render(job, title) {
    if (!BASE) return;
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
      if (evs.length) {
        var badge = '<span style="margin-left:8px;padding:1px 7px;border-radius:999px;background:#eef2ff;' +
                    'color:#4f46e5;font-size:11px;font-weight:700">올해 개정 ' + evs.length + '건</span>';
        return '<div class="registry-law-item" data-eid="' + evs[0].id + '" style="cursor:pointer">' +
               '<span>' + esc + '</span>' + badge + '</div>';
      }
      var url = 'https://www.law.go.kr/lsSc.do?query=' + encodeURIComponent(title);
      return '<div class="registry-law-item" title="올해 개정 없음 · 국가법령정보센터에서 원문 보기" ' +
             'onclick="window.open(\'' + url.replace(/'/g, '') + '\',\'_blank\')" style="cursor:pointer">' +
             '<span>' + esc + '</span>' +
             '<span style="margin-left:8px;color:#94a3b8;font-size:11px">올해 개정 없음</span></div>';
    }).join('');
  }
  function hook() {
    if (!BASE) return;
    window.baseLawsData = BASE;
    window.showJobFunctionLaws = function (job, title) { render(job, title); };
    setCounts(BASE);
  }
  fetch('./base_laws_207.json?v=20260915s', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      BASE = j.items || j || [];
      hook();
      var n = 0;
      var t = setInterval(function () { hook(); if (++n > 50) clearInterval(t); }, 250);
    }).catch(function () {});
})();
