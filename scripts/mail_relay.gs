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
