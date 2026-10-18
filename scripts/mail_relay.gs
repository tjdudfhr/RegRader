/* RegRader 메일 보내기 — Google Apps Script 웹 앱
 *
 * 사이트 오른쪽 위 ✉ '메일로 공유' 창에서 [바로 보내기]를 누르면 이 웹 앱이 받아서
 * 배포한 사람(앱 주인)의 Gmail 로 보낸다. 사이트는 서버가 없는 정적 페이지라 메일을 직접 보내지 못해서 둔 중계다.
 *
 * 아무나 쓰지 못하게: '대응 현황 관리'에 로그인한 구성원만 보낼 수 있다.
 *   사이트가 로그인 토큰을 같이 보내고, 여기서 Supabase 에 그 토큰이 진짜인지 · 구성원인지(is_member) 묻는다.
 *   아래 SUPABASE · ANON 은 사이트(docs/tracker.js)에도 있는 공개 값이다. 비밀번호 같은 비밀값은 없다.
 *
 * 처음 한 번 배포 (script.google.com, 앱 주인의 구글 계정으로):
 *   새 프로젝트 → 이 코드를 붙여 넣고 저장 → 배포 → 새 배포 → 유형 '웹 앱'
 *   → 다음 사용자 인증 정보로 실행: 나 · 액세스 권한이 있는 사용자: 모든 사용자 → 배포 → 권한 허용
 *   → 나온 웹 앱 URL(https://script.google.com/macros/s/…/exec)을 docs/mail-ui.js 의 RELAY 에 넣는다.
 * 코드를 고친 뒤에는 배포 관리 → 수정 → 버전 '새 버전' 으로 다시 배포한다 (URL 은 그대로).
 *
 * 한도: 개인 Gmail 은 하루 받는 사람 100명, 메일 본문 200KB (사이트가 넘지 않게 줄여서 보낸다).
 */
var SUPABASE = 'https://gzlyjwvounwdubdvwjen.supabase.co';
var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6bHlqd3ZvdW53ZHViZHZ3amVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzNTg1NTcsImV4cCI6MjEwNTkzNDU1N30.zpEcAFk2xg87xYAEminrsGNJM79NWDeuzKhgL707ShM';
var MAX_TO = 30;   // 한 번에 받는 사람 (참조 포함)

function doGet() {
  return out_({ ok: true, service: 'RegRader 메일', left: MailApp.getRemainingDailyQuota() });
}

function doPost(e) {
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var who = member_(b.token);
    if (!who) return out_({ ok: false, code: 'auth', error: "'대응 현황 관리'에 로그인한 구성원만 보낼 수 있습니다. 로그인한 뒤 다시 눌러 주세요." });
    var to = addrs_(b.to), cc = addrs_(b.cc);
    if (!to.length) return out_({ ok: false, error: '받는 사람을 넣어 주세요.' });
    var bad = [].concat(b.to || [], b.cc || []).filter(function (x) { return !ok_(x); });
    if (bad.length) return out_({ ok: false, error: '이메일 주소를 확인해 주세요: ' + bad.join(', ') });
    var n = to.length + cc.length;
    if (n > MAX_TO) return out_({ ok: false, error: '한 번에 ' + MAX_TO + '명까지 보낼 수 있습니다 (지금 ' + n + '명).' });
    var left = MailApp.getRemainingDailyQuota();
    if (left < n) return out_({ ok: false, error: '오늘 보낼 수 있는 수를 넘었습니다 (남은 수 ' + left + '명, 내일 다시 채워집니다).' });
    var opt = {
      to: to.join(','),
      subject: String(b.subject || 'RegRader 법규 개정').slice(0, 200),
      htmlBody: String(b.html || ''),
      body: String(b.text || ''),
      name: 'RegRader 법규 개정 모니터링',
      replyTo: who.email
    };
    if (cc.length) opt.cc = cc.join(',');
    MailApp.sendEmail(opt);
    return out_({ ok: true, sent: n, by: who.email, left: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out_({ ok: false, error: '보내지 못했습니다: ' + (err && err.message ? err.message : err) });
  }
}

/* 로그인 토큰이 진짜이고 구성원이면 { email } */
function member_(token) {
  if (!token) return null;
  var h = { apikey: ANON, Authorization: 'Bearer ' + token };
  var u = UrlFetchApp.fetch(SUPABASE + '/auth/v1/user', { headers: h, muteHttpExceptions: true });
  if (u.getResponseCode() !== 200) return null;
  var m = UrlFetchApp.fetch(SUPABASE + '/rest/v1/rpc/is_member', { method: 'post', contentType: 'application/json', payload: '{}', headers: h, muteHttpExceptions: true });
  if (m.getResponseCode() !== 200 || m.getContentText().trim() !== 'true') return null;
  return { email: JSON.parse(u.getContentText()).email || '' };
}

function ok_(x) { return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(String(x || '').trim()); }
function addrs_(list) {
  var seen = {};
  return (list || []).map(function (x) { return String(x || '').trim(); }).filter(function (x) {
    var k = x.toLowerCase();
    if (!ok_(x) || seen[k]) return false;
    seen[k] = 1;
    return true;
  });
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }


/* =====================================================================================
 * 매월 1일 직무별 담당자 알림 (2026-10-19)
 *
 * 매월 1일 08시(한국 시각): '다음 달'에 시행되는 개정을 직무별 담당자에게 보낸다 (예: 11월 1일 → 12월 시행분).
 *   - 지난 알림 뒤에 새로 잡힌 '이번 달 시행분'도 따로 묶어 넣는다 (공포 뒤 바로 시행되는 개정을 놓치지 않게)
 *   - 개정마다 지금 대응 상태(미검토 · 검토중 · 조치필요 · 조치완료 · 해당없음)를 함께 보인다
 *   - 총괄(admin)에게는 전체 직무 요약 한 통
 * 개정 목록은 공개 사이트 자료(m0~m7.json · upcoming_next.json), 담당자 · 대응 상태는 Supabase(대응 현황 관리)에서 읽는다.
 * Supabase 는 비밀값(스크립트 속성 RR_NOTIFY_SECRET)이 맞을 때만 열리는 통로(notify_data)로 읽는다. 비밀값은 이 프로젝트에만 있다.
 *
 * 처음 한 번 (편집기 위쪽 함수 고르기 → ▶ 실행):
 *   1) setupMonthly   — 비밀값을 만들고 매월 1일 08시 실행을 예약한다. 실행 로그에 나온 SQL 을 Supabase SQL Editor 에 붙여 Run
 *   2) previewMonthly — 다음 1일에 보낼 메일을 지금 자료로 만들어 모두 '내 메일'로만 미리 보낸다 (담당자에게는 안 감)
 * ===================================================================================== */
var SITE = 'https://tjdudfhr.github.io/RegRader/';
var TZ = 'Asia/Seoul';
var JOBS = ['재무회계', '인사노무', '환경', '지식재산권', '공정거래', '안전', '지배구조', '정보보호'];
var AMEND = { '일': '일부개정', '타': '타법개정' };
var STATUS_COLOR = { '미검토': '#b42318', '검토중': '#3056d3', '조치필요': '#c4320a', '조치완료': '#067647', '해당없음': '#667085' };

function setupMonthly() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('RR_NOTIFY_SECRET');
  if (!secret) {
    secret = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('RR_NOTIFY_SECRET', secret);
  }
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'monthlyNotify') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('monthlyNotify').timeBased().onMonthDay(1).atHour(8).inTimezone(TZ).create();
  Logger.log('매월 1일 08시(한국 시각) 자동 알림을 예약했습니다.\n\n아래 SQL 을 Supabase 대시보드 > SQL Editor > New query 에 붙여 넣고 Run 하세요.\n\n' + notifySql_(secret));
}

/* 담당자 · 대응 상태를 읽는 통로 (Supabase) — 비밀값이 들어간 SQL 을 만들어 보여 준다 */
function notifySql_(secret) {
  return [
    '-- RegRader 매월 담당자 알림: Google Apps Script 가 담당자 · 대응 상태를 읽는 통로 (비밀값이 맞을 때만)',
    'create table if not exists public.notify_secret (id int primary key default 1 check (id = 1), secret text not null);',
    'alter table public.notify_secret enable row level security;   -- 정책이 없으므로 아무도 직접 읽지 못한다',
    "insert into public.notify_secret (id, secret) values (1, '" + secret + "') on conflict (id) do update set secret = excluded.secret;",
    'create or replace function public.notify_data(p_secret text) returns jsonb',
    'language plpgsql stable security definer set search_path = public as $$',
    'begin',
    '  if p_secret is null or not exists (select 1 from public.notify_secret where id = 1 and secret = p_secret) then',
    "    raise exception 'denied';",
    '  end if;',
    '  return jsonb_build_object(',
    "    'members', coalesce((select jsonb_agg(jsonb_build_object('email', email, 'name', name, 'job', job, 'role', role)) from public.members), '[]'::jsonb),",
    "    'responses', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'status', status, 'due', due_date)) from public.responses where effective_date >= current_date - 40), '[]'::jsonb));",
    'end $$;',
    'revoke all on function public.notify_data(text) from public;',
    'grant execute on function public.notify_data(text) to anon, authenticated;'
  ].join('\n');
}

function monthlyNotify() { runMonthly_({ preview: false }); }
function previewMonthly() { runMonthly_({ preview: true, today: nextFirst_() }); }
function nextFirst_() {   // 다음 달 1일 (미리보기는 다음 정기 발송일 기준으로 만든다)
  var t = today_(), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
  return m === 12 ? ymd_(y + 1, 1, 1) : ymd_(y, m + 1, 1);
}

function runMonthly_(opt) {
  var plan = null;
  try {
    plan = planMonthly_(opt.today || today_());
    var mails = buildMails_(plan);
    if (!mails.length) { Logger.log('보낼 사람이 없습니다 (등록된 담당자 · 총괄이 없음 — 대응 현황 관리 > 담당자 관리에서 등록하세요)'); return; }
    var me = opt.preview ? owner_(plan.members) : '';
    if (opt.preview && !me) throw new Error('미리보기를 받을 메일 주소를 알 수 없습니다. 실행 로그의 "권한 제공"을 눌러 이메일 주소 권한을 허용하거나, 대응 현황 관리에 총괄을 등록하세요.');
    if (MailApp.getRemainingDailyQuota() < mails.length) throw new Error('오늘 보낼 수 있는 메일 수가 모자랍니다 (남은 수 ' + MailApp.getRemainingDailyQuota() + ')');
    mails.forEach(function (m) {
      MailApp.sendEmail({
        to: opt.preview ? me : m.to,
        subject: (opt.preview ? '[미리보기 → ' + m.who + '] ' : '') + m.subject,
        htmlBody: m.html, body: m.text, name: 'RegRader 법규 개정 모니터링'
      });
    });
    if (!opt.preview) saveSent_(plan);
    Logger.log((opt.preview ? '미리보기 ' + mails.length + '통을 ' + me + ' 로 보냈습니다' : mails.length + '통을 보냈습니다') +
      ' — ' + mails.map(function (m) { return m.who + ': ' + m.count + '건'; }).join(', '));
  } catch (err) {
    var msg = (err && err.message) || String(err);
    Logger.log('매월 알림 실패: ' + msg);
    if (opt.preview) throw err;
    var to = owner_(plan && plan.members);
    if (to) MailApp.sendEmail(to, '[RegRader] ⚠ 매월 담당자 알림을 보내지 못했습니다', msg + '\n\nApps Script 편집기에서 previewMonthly 를 실행해 원인을 확인하세요.');
  }
}

/* 미리보기 · 실패 알림을 받을 사람: 이 스크립트 주인 (이메일 주소 권한이 없으면 대응 현황 관리의 총괄) */
function owner_(members) {
  try {
    var e = Session.getEffectiveUser().getEmail();
    if (e) return e;
  } catch (err) { /* 이메일 주소 권한을 안 준 경우 */ }
  return (members || []).filter(function (m) { return m.role === 'admin' && m.email; }).map(function (m) { return m.email; }).join(',');
}

function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function ymd_(y, m, d) { return y + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2); }
function lastDay_(y, m) { return new Date(y, m, 0).getDate(); }   // m: 1~12
function days_(from, to) { return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000); }
function hash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)).slice(0, 10);
}

/* 이번 달 알림에 넣을 것: 다음 달 시행분(직무별) + 지난 알림 뒤 새로 잡힌 이번 달 시행분 */
function planMonthly_(today) {
  var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
  var ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  var next = { from: ymd_(ny, nm, 1), to: ymd_(ny, nm, lastDay_(ny, nm)), label: nm + '월' };
  var cur = { from: today, to: ymd_(y, m, lastDay_(y, m)), label: m + '월' };
  var rows = siteRows_();
  var data = supa_();
  var status = {};
  (data.responses || []).forEach(function (r) { status[r.key] = r; });
  var sent = JSON.parse(PropertiesService.getScriptProperties().getProperty('RR_NOTIFY_SENT') || 'null');
  var told = {};
  if (sent) (sent.keys || []).forEach(function (h) { told[h] = 1; });
  var items = rows.map(function (r) {
    var key = r.t + '|' + r.d + '|' + r.a;
    var st = status[key] || {};
    return {
      key: key, h: hash_(key), title: r.t, date: r.d, type: AMEND[r.a] || r.a || '', job: r.c || '기타', kind: r.k || '',
      status: st.status || '미검토', due: st.due || '', dday: days_(today, r.d),
      url: !r.u ? SITE : r.k ? 'https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=' + r.u
        : 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=' + r.u + '&efYd=' + String(r.d).replace(/-/g, '')
    };
  });
  var byDate = function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.title < b.title ? -1 : 1); };
  var nextItems = items.filter(function (x) { return x.date >= next.from && x.date <= next.to; }).sort(byDate);
  var lateItems = items.filter(function (x) { return x.date >= cur.from && x.date <= cur.to && !told[x.h]; }).sort(byDate);
  return { today: today, next: next, cur: cur, nextItems: nextItems, lateItems: lateItems, first: !sent, members: data.members || [] };
}

function siteRows_() {
  var names = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'upcoming_next'];
  var reqs = names.map(function (n) { return { url: SITE + n + '.json?cb=' + Date.now(), muteHttpExceptions: true }; });
  var seen = {}, out = [];
  UrlFetchApp.fetchAll(reqs).forEach(function (res, i) {
    if (res.getResponseCode() !== 200) { if (names[i] === 'upcoming_next') return; throw new Error('사이트 자료를 받지 못했습니다: ' + names[i] + '.json (' + res.getResponseCode() + ')'); }
    (JSON.parse(res.getContentText()) || []).forEach(function (r) {
      var k = r.t + '|' + r.d + '|' + r.a;
      if (!r.t || !r.d || seen[k]) return;
      seen[k] = 1;
      out.push(r);
    });
  });
  return out;
}

function supa_() {
  var secret = PropertiesService.getScriptProperties().getProperty('RR_NOTIFY_SECRET');
  if (!secret) throw new Error('setupMonthly 를 먼저 실행하세요 (비밀값이 없습니다)');
  var res = UrlFetchApp.fetch(SUPABASE + '/rest/v1/rpc/notify_data', {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ p_secret: secret }),
    headers: { apikey: ANON, Authorization: 'Bearer ' + ANON }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('담당자 목록을 읽지 못했습니다 (' + res.getResponseCode() + '). setupMonthly 실행 로그의 SQL 을 Supabase 에 Run 했는지 확인하세요. ' + res.getContentText().slice(0, 200));
  }
  return JSON.parse(res.getContentText());
}

/* 보낸 개정을 기억해 둔다 → 다음 달에 '새로 잡힌 이번 달 시행분'을 가려낸다 */
function saveSent_(plan) {
  var keys = plan.nextItems.concat(plan.lateItems).map(function (x) { return x.h; });
  PropertiesService.getScriptProperties().setProperty('RR_NOTIFY_SENT', JSON.stringify({ month: plan.today.slice(0, 7), keys: keys }));
}

function buildMails_(plan) {
  var mails = [];
  plan.members.forEach(function (mb) {
    var name = mb.name || mb.email;
    if (mb.role === 'admin') {
      var cnt = plan.nextItems.length + plan.lateItems.length;
      mails.push({
        to: mb.email, who: name + ' (총괄)', count: cnt,
        subject: '[RegRader] ' + plan.next.label + ' 시행 예정 법규 개정 — 전체 ' + plan.nextItems.length + '건 (직무별 요약)' + (plan.lateItems.length ? ' · ' + plan.cur.label + ' 추가 ' + plan.lateItems.length + '건' : ''),
        html: mailHtml_(plan, name, null), text: mailText_(plan, name, null)
      });
      return;
    }
    if (!mb.job) return;
    var mine = function (x) { return x.job === mb.job; };
    var n = plan.nextItems.filter(mine).length, l = plan.lateItems.filter(mine).length;
    if (!n && !l) return;   // 이번 달에 알릴 개정이 없으면 보내지 않는다 (총괄 요약에는 '없음'으로 나온다)
    mails.push({
      to: mb.email, who: name + ' (' + mb.job + ')', count: n + l,
      subject: '[RegRader] ' + plan.next.label + ' 시행 예정 법규 개정 — ' + mb.job + ' ' + n + '건' + (l ? ' · ' + plan.cur.label + ' 추가 ' + l + '건' : ''),
      html: mailHtml_(plan, name, mb.job), text: mailText_(plan, name, mb.job)
    });
  });
  return mails;
}

function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function dot_(d) { return d.slice(5).replace('-', '.'); }

function tableHtml_(list) {
  var th = 'padding:8px 10px;border-bottom:2px solid #d0d5dd;text-align:left;font-size:12px;color:#475467;white-space:nowrap';
  var td = 'padding:8px 10px;border-bottom:1px solid #eaecf0;font-size:13px;vertical-align:top';
  return '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:760px">' +
    '<tr><th style="' + th + '">시행일</th><th style="' + th + '">D-day</th><th style="' + th + '">법령 · 행정규칙</th><th style="' + th + '">구분</th><th style="' + th + '">대응 상태</th></tr>' +
    list.map(function (x) {
      var c = STATUS_COLOR[x.status] || '#475467';
      return '<tr><td style="' + td + ';white-space:nowrap">' + dot_(x.date) + '</td>' +
        '<td style="' + td + ';white-space:nowrap;font-weight:700;color:' + (x.dday <= 30 ? '#b42318' : '#3056d3') + '">D-' + x.dday + '</td>' +
        '<td style="' + td + '"><a href="' + esc_(x.url) + '" style="color:#101828;font-weight:600;text-decoration:none">' + esc_(x.title) + '</a>' + (x.kind ? ' <span style="font-size:11px;color:#667085">' + esc_(x.kind) + '</span>' : '') + '</td>' +
        '<td style="' + td + ';white-space:nowrap;color:#475467">' + esc_(x.type) + '</td>' +
        '<td style="' + td + ';white-space:nowrap"><span style="font-weight:700;color:' + c + '">' + esc_(x.status) + '</span>' + (x.due ? '<br><span style="font-size:11px;color:#667085">기한 ' + esc_(x.due) + '</span>' : '') + '</td></tr>';
    }).join('') + '</table>';
}

function mailHtml_(plan, name, job) {
  var pick = function (l) { return job ? l.filter(function (x) { return x.job === job; }) : l; };
  var next = pick(plan.nextItems), late = pick(plan.lateItems);
  var h = '<div style="font-family:Apple SD Gothic Neo,Malgun Gothic,sans-serif;color:#101828;line-height:1.6">' +
    '<p style="font-size:15px;margin:0 0 6px">' + esc_(name) + '님, 안녕하세요.</p>' +
    '<p style="font-size:14px;margin:0 0 18px;color:#344054">' + (job ? '<b>' + esc_(job) + '</b> 직무에서 ' : '') +
    '<b>' + plan.next.label + '</b>에 시행되는 법규 개정 <b>' + next.length + '건</b>을 미리 알려 드립니다. 시행 전에 사규 · 업무 반영 여부를 검토해 주세요.</p>';
  if (job) {
    h += '<h3 style="font-size:15px;margin:0 0 8px">' + plan.next.label + ' 시행 예정 (' + next.length + '건)</h3>' + (next.length ? tableHtml_(next) : '<p style="color:#667085">없습니다.</p>');
  } else {
    var jobs = JOBS.concat(['기타']);
    h += '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 18px">' + jobs.map(function (j) {
      var n = next.filter(function (x) { return x.job === j; }).length, l = late.filter(function (x) { return x.job === j; }).length;
      if (j === '기타' && !n && !l) return '';
      return '<tr><td style="padding:4px 14px 4px 0;font-size:13px;font-weight:600">' + j + '</td><td style="padding:4px 14px 4px 0;font-size:13px">' + plan.next.label + ' <b>' + n + '건</b></td>' +
        '<td style="padding:4px 0;font-size:13px;color:#667085">' + (l ? plan.cur.label + ' 추가 ' + l + '건' : '') + '</td></tr>';
    }).join('') + '</table>';
    jobs.forEach(function (j) {
      var sub = next.filter(function (x) { return x.job === j; });
      if (sub.length) h += '<h3 style="font-size:15px;margin:18px 0 8px">' + j + ' · ' + plan.next.label + ' 시행 예정 (' + sub.length + '건)</h3>' + tableHtml_(sub);
    });
  }
  if (late.length) {
    h += '<h3 style="font-size:15px;margin:22px 0 4px">' + plan.cur.label + ' 시행 · ' + (plan.first ? '이번 달 남은 시행분' : '지난 알림 뒤 새로 잡힌 개정') + ' (' + late.length + '건)</h3>' +
      '<p style="font-size:12.5px;color:#667085;margin:0 0 8px">' + (plan.first ? '첫 알림이라 이번 달에 시행되는 개정도 함께 넣었습니다.'
        : '공포 뒤 곧바로 시행되는 개정이라 지난 알림에 들어가지 못한 것입니다.') + ' 시행이 가까우니 먼저 확인해 주세요.</p>' + tableHtml_(late);
  }
  h += '<p style="margin:24px 0 0"><a href="' + SITE + '#tracker" style="display:inline-block;padding:10px 18px;background:#3056d3;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">RegRader 에서 대응 상태 기록하기</a></p>' +
    '<p style="font-size:12px;color:#98a2b3;margin:20px 0 0">이 메일은 RegRader 가 매월 1일 자동으로 보냅니다. 법령 이름을 누르면 국가법령정보센터 원문이 열립니다.<br>담당 직무가 바뀌었으면 총괄에게 알려 주세요.</p></div>';
  return h;
}

function mailText_(plan, name, job) {
  var pick = function (l) { return job ? l.filter(function (x) { return x.job === job; }) : l; };
  var line = function (x) { return '- ' + dot_(x.date) + ' (D-' + x.dday + ') ' + x.title + ' · ' + x.type + ' · ' + (job ? '' : x.job + ' · ') + x.status; };
  var next = pick(plan.nextItems), late = pick(plan.lateItems);
  return name + '님, ' + (job ? job + ' 직무 ' : '') + plan.next.label + ' 시행 예정 법규 개정 ' + next.length + '건입니다.\n\n' +
    next.map(line).join('\n') + (late.length ? '\n\n' + plan.cur.label + ' 시행 · 새로 잡힌 개정 ' + late.length + '건\n' + late.map(line).join('\n') : '') +
    '\n\n대응 상태 기록: ' + SITE + '#tracker';
}
