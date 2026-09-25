/* RegRader 초기화 정리
 *
 * 배경: 예전에는 index.html 이 고정 커밋의 앱 HTML 을 받아와 document.write 로 갈아끼웠고,
 *       그 결과 (1) 옛 index.json 으로 목록이 한 번 그려지고
 *              (2) event-boot.js 가 m0~m7.json 으로 다시 그리는
 *       2단계 렌더가 발생했다. 그래서 과거 데이터가 잠깐 보였고,
 *       그 사이에 법령을 클릭하면 팝업이 열리지 않았다.
 *
 * 이 파일은 데이터 주도권을 event-boot.js 하나로 통일한다.
 *   - loadData() 는 더 이상 index.json 을 읽지 않고, event-boot 데이터가 준비될 때까지 기다린다.
 *   - 준비 전에는 목록을 그리지 않으므로 "데이터를 로딩 중입니다" 상태가 유지되고,
 *     클릭할 카드 자체가 없어 조기 클릭 실패가 발생하지 않는다.
 *   - event-boot 가 실패하면 예전 경로로 폴백한다.
 */
(function () {
  'use strict';

  var READY_TIMEOUT_MS = 20000;
  var POLL_MS = 50;

  /* 예전 버전이 남긴 서비스워커/캐시 정리 (service-worker.js 는 passthrough 라 캐시를 남기지 않음) */
  try {
    if ('serviceWorker' in navigator && window.caches) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) { caches.delete(k); });
      }).catch(function () {});
    }
  } catch (e) {}

  function itemsReady() {
    return !!(window.__rrItems && window.__rrItems.length);
  }

  function waitForItems() {
    return new Promise(function (resolve) {
      if (itemsReady()) return resolve(true);
      var t0 = Date.now();
      var iv = setInterval(function () {
        if (itemsReady()) {
          clearInterval(iv);
          resolve(true);
        } else if (Date.now() - t0 > READY_TIMEOUT_MS) {
          clearInterval(iv);
          resolve(false);
        }
      }, POLL_MS);
    });
  }

  function setHeader() {
    try {
      var y = document.getElementById('year');
      if (y) y.textContent = window.RR_YEAR;
    } catch (e) {}
  }

  /* 최종 업데이트 시각과 전체 현행/시행예정 수는 meta.json(자동 갱신 스크립트가 생성)에서 읽는다.
     예전에는 접속 시각을 그대로 보여줘서 데이터가 언제 갱신됐는지 알 수 없었다. */
  function fmtNum(n) { return Number(n).toLocaleString('ko-KR'); }
  function setBaseCount(n) {
    if (!n) return;
    window.__rrBaseCount = n;
    ['rr-base-count', 'rr-base-sub-n'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = n;
    });
  }
  window.__rrSetBaseCount = setBaseCount;
  function applyMeta(meta) {
    window.__rrMeta = meta;
    if (meta.year && window.rrSetYear) window.rrSetYear(meta.year);
    setBaseCount(meta.baseLaws);
    var ts = document.getElementById('timestamp');
    if (ts && meta.generatedAt) {
      var d = new Date(meta.generatedAt);
      if (!isNaN(d.getTime())) ts.textContent = d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    }
    var u = meta.universe || {};
    var cur = document.getElementById('rr-universe-current');
    var fut = document.getElementById('rr-universe-future');
    if (cur && u.openapiCurrent != null) cur.textContent = fmtNum(u.openapiCurrent);
    if (fut && u.openapiFuture != null) fut.textContent = fmtNum(u.openapiFuture);
    var sub = document.getElementById('rr-universe-sub');
    if (sub && meta.asOf) sub.textContent = '국가법령정보센터 OpenAPI · ' + meta.asOf + ' 조회 (시행일 ' + (meta.year || window.RR_YEAR) + '-01-01~12-31)';
  }
  function loadMeta() {
    fetch('./meta.json?v=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('meta.json ' + r.status); return r.json(); })
      .then(applyMeta)
      .catch(function (e) {
        console.warn('[app-init] meta.json 을 읽지 못했습니다.', e);
        var ts = document.getElementById('timestamp');
        if (ts) ts.textContent = '확인 불가';
      });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadMeta);
  else loadMeta();

  /* ---- 1. loadData: 단일 데이터 소스로 전환 ---- */
  var origLoadData = window.loadData;

  window.loadData = async function () {
    var ok = await waitForItems();

    if (!ok) {
      console.warn('[app-init] event-boot 데이터를 받지 못해 예전 경로로 폴백합니다.');
      if (typeof origLoadData === 'function') {
        return origLoadData.apply(this, arguments);
      }
      return;
    }

    var items = window.__rrItems;
    try { lawsData = items; } catch (e) {}
    window.lawsData = items;
    try { filteredLaws = items.slice(); } catch (e) {}

    setHeader();

    /* event-boot 의 apply() 가 건드리지 않는 대시보드 수치만 보완 */
    try { updateQuarterlyDataWithFinalPrecise(); } catch (e) {}
    try { updateMainDashboardWithCompanyLaws(); } catch (e) {}
  };

  /* ---- 2. 대시보드 상단 수치: 하드코딩(259/59) 대신 실제 데이터로 계산 ---- */
  window.updateMainDashboardWithCompanyLaws = function () {
    var items = window.__rrItems || window.lawsData || [];
    if (!items.length) return;

    var titles = {};
    items.forEach(function (x) { if (x.title) titles[x.title] = 1; });
    var pending = items.filter(function (x) { return x.inForce === false; }).length;

    var m = document.querySelectorAll('.metric-number');
    if (m[0]) m[0].textContent = Object.keys(titles).length;
    if (m[1]) m[1].textContent = pending;
  };

  /* ---- 3. 새로고침 버튼: 옛 index.json 을 다시 끌어오지 않도록 페이지 재적재로 대체 ---- */
  window.triggerDataRefresh = async function () {
    var btn = document.getElementById('refresh-btn');
    if (btn) {
      btn.classList.add('loading');
      btn.innerHTML = '⏳';
      btn.style.pointerEvents = 'none';
    }
    try {
      if (window.caches) {
        var keys = await caches.keys();
        await Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }
    } catch (e) {}
    location.reload();
  };
})();
