/* Event-model overlay: popup + 개정요지 + 직무별 집계 */
(function () {
  var CATS = ['인사노무','공정거래','정보보호','지식재산권','재무회계','안전','환경','지배구조'];
  var ACTION = {
    '인사노무': '취업규칙·근로계약·휴가/장려금 신청 시기와 제출서류를 개정 조문에 맞게 수정하세요.',
    '공정거래': '거래약관·내부 공정거래 자율준수(CP) 체크리스트에 개정 내용을 반영하세요.',
    '정보보호': '보안정책·개인정보처리방침·위탁/이전 계약을 개정 조문 기준으로 점검하세요.',
    '지식재산권': '지식재산 관리규정과 라이선스·비밀유지 계약 조항을 개정 내용에 맞게 정비하세요.',
    '재무회계': '회계처리·공시·내부통제 체크리스트를 개정 조문에 맞게 갱신하세요.',
    '안전': '안전보건관리규정·교육·점검 주기를 개정 조문에 맞게 반영하세요.',
    '환경': '인허가·배출/폐기물 관리 절차와 사내 환경매뉴얼을 개정하세요.',
    '지배구조': '정관·이사회 규정·공시 체계를 개정 조문에 맞게 점검하세요.'
  };

  function todayKST() {
    var k = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    return new Date(k.getFullYear(), k.getMonth(), k.getDate());
  }
  function atype(a) {
    if (a === '일') return '일부개정';
    if (a === '타') return '타법개정';
    return a || '';
  }
  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c];
    });
  }
  function packReason(am, sum) {
    if (!sum) return '';
    var arts = (sum.articles || []).join(', ');
    return '[' + (sum.type || am || '개정') + ']\n◇ 개정이유\n' + (sum.why || '') +
      '\n\n◇ 주요내용\n' + (sum.what || '') +
      (arts ? ('\n【개정문】\n' + arts) : '') +
      (sum.action ? ('\n◇ 실무 반영\n' + sum.action) : '');
  }
  function fallbackBrief(r, am) {
    var cat = r.c || '';
    var kind = am || '개정';
    var why = (r.t || '해당 법령') + '이(가) 2026년 ' + (r.d || '') + '부터 ' + kind + '으로 시행됩니다.';
    var what = kind === '타법개정'
      ? '다른 법령 개정에 따른 인용·용어 정비입니다. 직접 의무가 바뀌는지 원문 조문을 확인하세요.'
      : '본 법령의 조문·절차가 바뀝니다. 아래 원문·신구비교에서 변경 조문을 확인하세요.';
    return {
      why: why,
      what: what,
      articles: [],
      action: ACTION[cat] || '개정 조문을 업무 절차·계약서·사규에 반영할 항목이 있는지 확인하세요.',
      type: kind
    };
  }
  function expandMini(rows, sums) {
    sums = sums || {};
    return (rows || []).map(function (r, i) {
      var am = atype(r.a);
      var sum = sums[String(r.u)] || fallbackBrief(r, am);
      if (!sum.why) sum = Object.assign(fallbackBrief(r, am), sum);
      if (!sum.action) sum.action = ACTION[r.c] || sum.action;
      var reason = packReason(am, sum);
      var stable = [r.t || '', r.d || '', r.a || ''].join('|');
      return {
        id: 'ev_' + (r.u || i) + '_' + String(r.d || '').replace(/-/g, '') + '_' + (r.a || 'x'),
        altIds: ['ev_' + i, stable],
        title: r.t,
        summary: sum.why,
        effectiveDate: r.d,
        amendmentType: am,
        lawType: /시행규칙/.test(r.t || '') ? '부령' : (/시행령/.test(r.t || '') ? '대통령령' : '법률'),
        status: r.s === 0 ? '현행' : '시행예정',
        ministry: r.m || '',
        categories: r.c ? [r.c] : [],
        source: { url: r.u ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + r.u) : '' },
        amendments: [{ date: r.d, amendmentType: am, reason: reason, mainContents: sum.what }],
        originalTitle: r.t,
        meta: { lsiSeq: String(r.u || ''), matchType: '100%완전일치' },
        brief: sum,
        _key: stable
      };
    });
  }
  function enrich(items) {
    var today = todayKST();
    items.forEach(function (it) {
      if (!it.effectiveDate) return;
      var days = Math.round((new Date(it.effectiveDate + 'T00:00:00+09:00') - today) / 86400000);
      it.daysUntil = days; it.inForce = days <= 0;
      it.status = days <= 0 ? '현행' : '시행예정';
    });
    var by = {};
    items.forEach(function (it) { (by[it.title] = by[it.title] || []).push(it); });
    Object.keys(by).forEach(function (title) {
      var group = by[title].slice().sort(function (a, b) {
        return String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || ''));
      });
      var past = group.filter(function (g) { return g.inForce; }).length;
      var timeline = group.map(function (g) {
        return { effectiveDate: g.effectiveDate, amendmentType: g.amendmentType || '', status: g.status, id: g.id };
      });
      group.forEach(function (g, i) {
        g.eventIndex = i + 1; g.eventCount = group.length;
        g.sameTitlePastCount = past; g.sameTitleUpcomingCount = group.length - past; g.timeline = timeline;
      });
    });
    return items;
  }
  function banner(items) {
    var el = document.getElementById('event-model-banner');
    var past = items.filter(function (x) { return x.inForce; }).length;
    var titles = {}, multi = {}, both = {};
    items.forEach(function (x) {
      titles[x.title] = 1;
      if ((x.eventCount || 1) > 1) multi[x.title] = 1;
      if ((x.sameTitlePastCount || 0) > 0 && (x.sameTitleUpcomingCount || 0) > 0) both[x.title] = 1;
    });
    var html = '<b>이벤트 모델</b> 개정 ' + items.length + '건 / 법령 ' + Object.keys(titles).length +
      '개 · 시행완료 ' + past + ' · 시행예정 ' + (items.length - past) +
      ' · 복수개정 ' + Object.keys(multi).length +
      ' · 이미시행+추가예정 ' + Object.keys(both).length +
      ' <a href="./watch.html" style="color:#9fd1ff">Watch D-30</a>';
    if (!el) {
      el = document.createElement('div');
      el.id = 'event-model-banner';
      el.style.cssText = 'position:sticky;top:0;z-index:9999;background:#12324f;color:#e8eef4;padding:10px 14px;font:14px/1.45 -apple-system,sans-serif';
      document.body.insertBefore(el, document.body.firstChild);
    }
    el.innerHTML = html;
  }
  function stampJobCounts(items) {
    items = items || window.lawsData || [];
    var unique = {};
    items.forEach(function (law) { if (law.title && !unique[law.title]) unique[law.title] = law; });
    var counts = {}; CATS.forEach(function (c) { counts[c] = 0; });
    Object.keys(unique).forEach(function (t) {
      (unique[t].categories || []).forEach(function (c) { if (counts[c] != null) counts[c]++; });
    });
    /* count-* 만 담당한다. job-count-* / registry-* 는 적용법규(207개) 소관이라
       registry-fix.js 가 관리한다. 예전에는 여기서도 덮어써서 적용법규 탭이
       목록 207줄 · 헤더 136 으로 어긋났다. */
    CATS.forEach(function (c) {
      var el = document.getElementById('count-' + c);
      if (el) el.textContent = counts[c];
    });
    var allUnique = Object.keys(unique).length;
    var evAll = document.getElementById('count-all');
    if (evAll) evAll.textContent = items.length;
    var tot = document.getElementById('total-law-count');
    if (tot) tot.textContent = items.length;
    var past = items.filter(function (x) { return x.inForce; }).length;
    var imp = document.getElementById('implemented-law-count');
    if (imp) imp.textContent = past;
    var pen = document.getElementById('amendment-law-count');
    if (pen) pen.textContent = items.length - past;
  }
  function findLaw(lawId) {
    var data = window.__rrItems || window.lawsData || [];
    if (!data.length || lawId == null) return null;
    var key = String(lawId);
    var hit = data.find(function (x) { return String(x.id) === key; });
    if (hit) return hit;
    hit = data.find(function (x) { return (x.altIds || []).indexOf(key) >= 0; });
    if (hit) return hit;
    hit = data.find(function (x) { return x._key === key; });
    if (hit) return hit;
    hit = data.find(function (x) { return x.title === key; });
    if (hit) return hit;
    if (key.indexOf('|') > 0) {
      var p = key.split('|');
      hit = data.find(function (x) { return x.title === p[0] && x.effectiveDate === p[1]; });
      if (hit) return hit;
    }
    var mst = key.replace(/^matched_2026_/, '').split('_')[0];
    if (/^\d+$/.test(mst)) {
      hit = data.find(function (x) { return x.meta && String(x.meta.lsiSeq) === mst; });
    }
    return hit || null;
  }
  function renderBrief(item) {
    var b = item.brief || {};
    var arts = (b.articles || []).map(function (a) {
      return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:999px;background:#eef2ff;font-size:12px;">' + esc(a) + '</span>';
    }).join('');
    var lsi = (item.meta && item.meta.lsiSeq) || '';
    var src = (item.source && item.source.url) || (lsi ? ('https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi) : '');
    var tl = '';
    if (item.timeline && item.timeline.length > 1) {
      tl = '<div style="margin:0 0 8px;font-size:12px;color:#475569"><b>올해 타임라인</b><br>' +
        item.timeline.map(function (t) {
          var on = t.effectiveDate === item.effectiveDate;
          return '<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:8px;border:1px solid ' +
            (on ? '#2563eb' : '#e5e7eb') + '">' + esc(t.effectiveDate) + ' ' + esc(t.amendmentType) + '</span>';
        }).join('') + '</div>';
    }
    return '<div id="rr-brief" class="summary-section" style="border:1px solid #c7d2fe;border-radius:12px;padding:14px;margin:0 0 12px;background:#f8fafc">' +
      '<div style="font-size:12px;color:#4f46e5;margin-bottom:6px;font-weight:700">실무 개정요지</div>' +
      '<div style="font-weight:700;margin-bottom:8px">' + esc(item.amendmentType || '') + ' · ' + esc(item.effectiveDate || '') +
      ((item.eventCount > 1) ? (' · 올해 ' + item.eventIndex + '/' + item.eventCount + '회') : '') + '</div>' +
      /* 법제처 원문이 '개정이유 및 주요내용'을 한 덩어리로 제공하는 경우(b.merged)에는
         억지로 두 칸으로 쪼개지 않고 원문 그대로 한 칸에 보여준다. */
      (b.merged
        ? '<div style="margin:0 0 8px"><b>개정이유 및 주요내용</b><br><span style="white-space:pre-line">' +
            esc(b.why || item.summary || '개정이유 확인 중') + '</span></div>'
        : '<div style="margin:0 0 8px"><b>왜 개정됐나</b><br><span style="white-space:pre-line">' +
            esc(b.why || item.summary || '개정이유 확인 중') + '</span></div>' +
          '<div style="margin:0 0 8px"><b>무엇이 바뀌었나</b><br><span style="white-space:pre-line">' +
            esc(b.what || '원문 조문에서 변경 범위를 확인하세요.') + '</span></div>') +
      (arts ? ('<div style="margin:0 0 8px"><b>개정 조항</b><br>' + arts + '</div>') : '') +
      '<div style="margin:0 0 8px"><b>실무 반영</b><br>' + esc(b.action || ACTION[(item.categories||[])[0]] || '내부 절차 반영 여부를 확인하세요.') + '</div>' +
      tl +
      (src ? ('<div><a href="' + src + '" target="_blank">국가법령정보센터 원문</a>' +
        (lsi ? (' · <a href="https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + lsi + '&viewCls=lsOldAndNew" target="_blank">신구비교</a>') : '') +
        '</div>') : '') +
      '</div>';
  }
  function openModal(item) {
    try {
      var t = document.getElementById('modal-title');
      if (t) t.textContent = item.title || '법령 제목';
      var s = document.getElementById('modal-subtitle');
      if (s) s.textContent = (item.ministry || '') + ' • ' + (item.amendmentType || '') + ' • ' + (item.effectiveDate || '');
    } catch (e) {}
    try {
      if (typeof generateAISummary === 'function') generateAISummary(item);
    } catch (e) {}
    var box = document.getElementById('modal-summary');
    if (box) {
      var old = document.getElementById('rr-brief');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      box.insertAdjacentHTML('afterbegin', renderBrief(item));
    }
    var modal = document.getElementById('law-modal');
    if (modal) {
      modal.classList.add('show');
      if (modal.style.display === 'none') modal.style.display = 'flex';
    }
  }
  function patchPopup() {
    window.showLawDetail = function (lawId) {
      var data = window.__rrItems || window.lawsData || [];
      if (!data.length) {
        alert('법령 데이터를 로드하는 중입니다. 잠시 후 다시 시도해주세요.');
        return;
      }
      var item = findLaw(lawId);
      if (!item) {
        console.warn('law not found', lawId);
        alert('해당 법령 이벤트를 찾지 못했습니다. 목록을 새로고침한 뒤 다시 눌러주세요.');
        return;
      }
      openModal(item);
    };
    if (!window.__rrClickBound) {
      window.__rrClickBound = true;
      document.addEventListener('click', function (ev) {
        var n = ev.target;
        while (n && n !== document) {
          var eid = n.getAttribute && (n.getAttribute('data-eid') || n.getAttribute('data-law-id') || n.getAttribute('data-key'));
          if (eid) {
            ev.preventDefault();
            ev.stopPropagation();
            window.showLawDetail(eid);
            return;
          }
          var oc = n.getAttribute && n.getAttribute('onclick');
          if (oc && oc.indexOf('showLawDetail') >= 0) {
            var m = oc.match(/showLawDetail\(['"]([^'"]+)['"]\)/);
            if (m && m[1]) {
              ev.preventDefault();
              ev.stopPropagation();
              window.showLawDetail(m[1]);
              return;
            }
          }
          n = n.parentNode;
        }
      }, true);
    }
  }
  function patchDisplayList() {
    if (typeof displayLawList !== 'function' || displayLawList.__rr) return;
    var orig = displayLawList;
    window.displayLawList = function (items) {
      var src = window.__rrItems || items;
      try { orig(src); } catch (e) { try { orig(items); } catch (e2) {} }
      try {
        var nodes = document.querySelectorAll('.law-item');
        var data = window.__rrItems || [];
        nodes.forEach(function (node, i) {
          var titleEl = node.querySelector('.law-title');
          var title = titleEl ? titleEl.textContent.trim() : '';
          var dateEl = node.querySelector('.date-badge');
          var dateHint = dateEl ? dateEl.textContent.trim() : '';
          var hit = data.find(function (x) { return x.title === title && (dateHint.indexOf(x.effectiveDate) >= 0 || /D-/.test(dateHint)); });
          if (!hit) hit = data.find(function (x) { return x.title === title; });
          if (!hit && data[i]) hit = data[i];
          if (hit) {
            node.setAttribute('data-eid', hit.id);
            node.setAttribute('data-key', hit._key);
            node.setAttribute('onclick', "window.showLawDetail('" + hit.id + "')");
          }
        });
      } catch (e) {}
    };
    window.displayLawList.__rr = true;
  }
  function patchJobTab() {
    window.showJobFunctionLaws = function (jobFunction, jobTitle) {
      try {
        document.querySelectorAll('.job-function-item').forEach(function (el) { el.classList.remove('active'); });
        var active = document.querySelector('[data-job="' + jobFunction + '"]');
        if (active) active.classList.add('active');
      } catch (e) {}
      var items = window.__rrItems || window.lawsData || [];
      var view = items;
      if (jobFunction && jobFunction !== 'all') {
        view = items.filter(function (law) {
          return law.categories && law.categories.indexOf(jobFunction) >= 0;
        });
      }
      view = view.slice().sort(function (a, b) {
        var t = String(a.title || '').localeCompare(String(b.title || ''), 'ko-KR');
        if (t) return t;
        return String(a.effectiveDate || '').localeCompare(String(b.effectiveDate || ''));
      });
      try {
        if (jobFunction === 'all') {
          document.getElementById('job-function-icon').textContent = '📋';
          document.getElementById('job-function-title').textContent = '전체 개정 이벤트';
        } else {
          var parts = String(jobTitle || jobFunction).split(' ');
          document.getElementById('job-function-icon').textContent = parts[0];
          document.getElementById('job-function-title').textContent = parts.slice(1).join(' ') + ' 개정 현황';
        }
        document.getElementById('job-function-count').textContent = view.length + '건';
      } catch (e) {}
      var html = view.map(function (law, index) {
        var badge = law.inForce ? '시행완료' : '시행예정';
        return '<div class="registry-law-item" data-eid="' + esc(law.id) + '" style="cursor:pointer">' +
          '<div class="registry-law-number">' + (index + 1) + '.</div>' +
          '<div class="registry-law-title" style="flex:1">' + esc(law.title) +
          '<div style="font-size:12px;color:#64748b;margin-top:2px">' + esc(law.effectiveDate || '') + ' · ' + esc(law.amendmentType || '') + ' · ' + badge +
          ((law.eventCount > 1) ? (' · 올해 ' + law.eventCount + '회') : '') + '</div></div>' +
          '<div class="registry-law-type" style="padding:0 10px;color:var(--text-muted);font-size:0.85rem">' + esc(law.lawType || '') + '</div>' +
          '<div class="registry-law-link"><span>요지</span></div></div>';
      }).join('');
      var box = document.getElementById('job-function-laws');
      if (box) {
        box.innerHTML = html || '<div style="padding:2rem;text-align:center;color:var(--text-muted)">해당 직무의 2026년 개정 이벤트가 없습니다.</div>';
      }
    };
    window.updateJobFunctionDataWithCompanyLaws = function () {
      stampJobCounts(window.__rrItems || window.lawsData || []);
    };
  }
  function holdData(items) {
    window.__rrItems = items;
    window.lawsData = items;
    try { lawsData = items; } catch (e) {}
    try { filteredLaws = items.slice(); } catch (e) {}
  }
  function apply(items) {
    items = enrich(items);
    holdData(items);
    banner(items);
    stampJobCounts(items);
    patchPopup();
    patchDisplayList();
    patchJobTab();
    try { if (typeof displayLawList === 'function') displayLawList(items); } catch (e) {}
    try { if (typeof updateTabCounts === 'function') updateTabCounts(); } catch (e) {}
    try { if (typeof updateQuarterlyCounts === 'function') updateQuarterlyCounts(); } catch (e) {}
    stampJobCounts(items);
    try {
      var q = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
      items.forEach(function (it) {
        var d = it.effectiveDate || '';
        if (d >= '2026-01-01' && d <= '2026-03-31') q.Q1++;
        else if (d <= '2026-06-30') q.Q2++;
        else if (d <= '2026-09-30') q.Q3++;
        else if (d <= '2026-12-31') q.Q4++;
      });
      [['q1-count', q.Q1], ['q2-count', q.Q2], ['q3-count', q.Q3], ['q4-count', q.Q4]].forEach(function (p) {
        var el = document.getElementById(p[0]); if (el) el.textContent = p[1];
      });
    } catch (e) {}
  }
  async function loadJSON(url) {
    var r = await fetch(url + '?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(url);
    return r.json();
  }
  function guardOverwrite() {
    if (window.__rrGuard) return;
    window.__rrGuard = true;
    setInterval(function () {
      if (window.__rrItems && window.__rrItems.length) {
        try { if (!lawsData || lawsData.length !== window.__rrItems.length) lawsData = window.__rrItems; } catch (e) {}
        if (!window.lawsData || window.lawsData.length !== window.__rrItems.length) window.lawsData = window.__rrItems;
        stampJobCounts(window.__rrItems);
      }
    }, 2500);
  }
  async function boot() {
    try {
      var rows = [];
      var sums = {};
      try { sums = await loadJSON('./summaries.json'); } catch (eS) { sums = {}; }
      try { Object.assign(sums, await loadJSON('./sum_a.json')); } catch (eA) {}
      try { Object.assign(sums, await loadJSON('./sum_b.json')); } catch (eB) {}
      try {
        var mini = await loadJSON('./events_mini.json');
        if (Array.isArray(mini) && mini.length && mini[0].t) rows = mini;
      } catch (e0) {}
      if (!rows.length) {
        var settled = await Promise.allSettled([0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return loadJSON('./m' + i + '.json'); }));
        settled.forEach(function (s) {
          if (s.status === 'fulfilled' && Array.isArray(s.value) && s.value.length && s.value[0].t) rows = rows.concat(s.value);
        });
        try {
          var extra = await loadJSON('./extra11.json');
          if (Array.isArray(extra) && extra.length && extra[0].t) rows = rows.concat(extra);
        } catch (e2) {}
        var seen = {};
        rows = rows.filter(function (r) {
          var k = (r.t || '') + '|' + (r.d || '') + '|' + (r.a || '');
          if (seen[k]) return false;
          seen[k] = 1;
          return true;
        });
      }
      if (!rows.length) {
        var data = await loadJSON('./index.json');
        apply(Array.isArray(data) ? data : (data.items || []));
        guardOverwrite();
        return;
      }
      apply(expandMini(rows, sums));
      guardOverwrite();
    } catch (e) { console.warn('event-boot', e); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 200); });
  else setTimeout(boot, 200);
})();
