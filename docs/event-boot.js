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
    /* 타법개정: 원인 법령 + 이 법에서 실제로 바뀐 것 */
    var byOther = '';
    if (b.x && (b.x.cause || b.x.body || b.x.subs)) {
      var x = b.x;
      var chg = '';
      if (x.mode === 'rename' && x.subs && x.subs.length) {
        chg = x.subs.map(function (p) {
          return '<div style="margin:2px 0"><span style="color:#64748b">' + esc(p[0]) +
                 '</span> <span style="color:#9a3412">→</span> <b>' + esc(p[1]) + '</b></div>';
        }).join('') +
        '<div style="margin-top:6px;font-size:12px;color:#64748b">' +
        (x.arts ? (x.arts + '개 조문에 반영 · ') : '') +
        '용어·부처명 정비로 실질 의무 변화는 없습니다.</div>';
      } else if (x.body && x.body.length) {
        chg = x.body.map(function (t) {
          return '<div style="margin:3px 0;padding-left:10px;border-left:2px solid #fed7aa">' + esc(t) + '</div>';
        }).join('');
      }
      byOther =
        '<div style="margin:0 0 10px;padding:10px 12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa">' +
        '<div style="font-size:12px;font-weight:700;color:#9a3412;margin-bottom:6px">' +
        '타법개정 — 이 법 자체의 정책 변경이 아니라 다른 법령 개정에 따른 정비입니다</div>' +
        (x.cause
          ? ('<div style="margin:0 0 8px;font-size:13px"><b>원인 법령</b><br>「' + esc(x.cause) + '」' +
             (x.no ? ('  <span style="color:#64748b;font-size:12px">' + esc(x.no) + '</span>') : '') + '</div>')
          : '') +
        (chg ? ('<div style="font-size:13px"><b>이 법에서 바뀐 것</b>' + chg + '</div>') : '') +
        '</div>';
    }

    /* 일부개정·제정: 요약을 앞에, 법제처 원문은 접어둔다 */
    var mainBlock = '';
    if (!b.x) {
      var summary = b.summaryShort || '';
      var full = '';
      if (b.why) {
        full += '<div style="margin:6px 0 0"><b>개정이유</b><br><span style="white-space:pre-line">' +
                esc(b.why) + '</span></div>';
      }
      if (b.what) {
        full += '<div style="margin:8px 0 0"><b>주요내용</b><br><span style="white-space:pre-line">' +
                esc(b.what) + '</span></div>';
      }
      if (summary) {
        mainBlock =
          '<div style="margin:0 0 10px;font-size:14px;line-height:1.6">' + esc(summary) + '</div>' +
          (full
            ? ('<details style="margin:0 0 10px">' +
               '<summary style="cursor:pointer;font-size:12px;color:#4f46e5;font-weight:700">' +
               '법제처 원문 보기</summary>' +
               '<div style="margin-top:6px;font-size:13px;color:#334155">' + full + '</div></details>')
            : '');
      } else {
        /* 요약이 없으면 원문을 그대로 보여준다 */
        mainBlock = full
          ? ('<div style="font-size:13px">' + full + '</div>')
          : ('<div style="margin:0 0 8px">' + esc(item.summary || '개정이유 확인 중') + '</div>');
      }
    }

    return '<div id="rr-brief" class="summary-section" style="border:1px solid #c7d2fe;border-radius:12px;padding:14px;margin:0 0 12px;background:#f8fafc">' +
      '<div style="font-size:12px;color:#4f46e5;margin-bottom:6px;font-weight:700">실무 개정요지</div>' +
      '<div style="font-weight:700;margin-bottom:8px">' + esc(item.amendmentType || '') + ' · ' + esc(item.effectiveDate || '') +
      ((item.eventCount > 1) ? (' · 올해 ' + item.eventIndex + '/' + item.eventCount + '회') : '') + '</div>' +
      byOther +
      mainBlock +
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
      /* 넘어온 목록(직무별 필터·검색 결과)을 그대로 존중한다.
         예전에는 무조건 window.__rrItems(전체 327건)로 바꿔치기해서
         어떤 직무를 눌러도, 무엇을 검색해도 항상 전체가 나왔다. */
      var src = (items && items.length) ? items : (window.__rrItems || []);
      try { orig(src); } catch (e) { try { orig(items); } catch (e2) {} }
      try {
        /* 목록은 src 순서 그대로 그려지므로 개수가 같으면 인덱스로 1:1 대응시킨다.
           예전에는 법령명+시행일로 찾았는데, 같은 법령이 같은 날 '일부개정'과 '타법개정'으로
           두 번 시행되는 경우(2026년 15건) 두 행이 같은 이벤트를 가리켜
           한쪽 행에 엉뚱한 개정이유가 떴다. */
        var nodes = [].slice.call(document.querySelectorAll('#law-list .law-item'));
        var data = src;
        function stamp(node, hit) {
          if (!node || !hit) return;
          node.setAttribute('data-eid', hit.id);
          if (hit._key) node.setAttribute('data-key', hit._key);
          node.setAttribute('onclick', "window.showLawDetail('" + hit.id + "')");
        }
        if (nodes.length === data.length) {
          nodes.forEach(function (node, i) { stamp(node, data[i]); });
        } else {
          var used = {};
          nodes.forEach(function (node, i) {
            var titleEl = node.querySelector('.law-title');
            var title = titleEl ? titleEl.textContent.trim() : '';
            var dateEl = node.querySelector('.date-badge');
            var dateHint = dateEl ? dateEl.textContent.trim() : '';
            var idx = -1, j;
            for (j = 0; j < data.length; j++) {
              if (!used[j] && data[j].title === title &&
                  dateHint.indexOf(data[j].effectiveDate) >= 0) { idx = j; break; }
            }
            if (idx < 0) for (j = 0; j < data.length; j++) {
              if (!used[j] && data[j].title === title) { idx = j; break; }
            }
            if (idx < 0 && !used[i] && data[i]) idx = i;
            if (idx >= 0) { used[idx] = 1; stamp(node, data[idx]); }
          });
        }
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
    /* banner(items) 는 부르지 않는다: 상단 요약 바가 잠깐 떴다가 stats-ui.js 가 지우면서 화면이 깜빡였다. */
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
      /* 모든 파일을 한 번에 요청한다. 예전에는 summaries/sum_a/sum_b/events_mini 를 하나씩 기다렸는데
         이 파일들이 없어서(404) 요청마다 수백 ms 씩 첫 화면이 늦어졌다. */
      function ok(s) { return s.status === 'fulfilled' ? s.value : null; }
      function isRows(v) { return Array.isArray(v) && v.length && v[0].t; }
      var names = ['summaries', 'sum_a', 'sum_b', 'events_mini', 'm0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'extra11'];
      var got = await Promise.allSettled(names.map(function (n) { return loadJSON('./' + n + '.json'); }));
      [0, 1, 2].forEach(function (i) { if (ok(got[i]) && typeof ok(got[i]) === 'object') Object.assign(sums, ok(got[i])); });
      if (isRows(ok(got[3]))) rows = ok(got[3]);
      if (!rows.length) {
        got.slice(4).forEach(function (s) { if (isRows(ok(s))) rows = rows.concat(ok(s)); });
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
