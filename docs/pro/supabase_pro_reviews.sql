-- RegRader Pro 기업별 검토 결과 (Supabase) — 어느 컴퓨터에서 체크해도 공유되고, 회사를 검색하면 자동으로 불러온다.
-- RegRader 의 '대응 현황 관리'와 같은 Supabase 프로젝트 · 같은 로그인 · 같은 구성원(members)을 쓴다.
-- 먼저 scripts/supabase_tracker.sql (RegRader 저장소)이 실행되어 있어야 한다 (members · my_email · is_member).
-- Supabase 대시보드 > SQL Editor > New query 에 전부 붙여 넣고 Run. 여러 번 실행해도 안전합니다.
--
--   pro_reviews     회사 1곳당 검토 1줄 (맞음/아님 답 · 법령/행정규칙 체크 — Pro 화면의 '검토 결과')
--   pro_review_log  누가 언제 바꿨는지 자동 기록

create table if not exists public.pro_reviews (
  key        text primary key,                  -- Pro 회사 키 (예: 포스코퓨처엠|c506810)
  company    text not null default '',
  data       jsonb not null,                    -- 검토 결과 (화면의 '검토 결과 복사'와 같은 내용)
  updated_by text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_review_log (
  id         bigserial primary key,
  key        text not null,
  changed_by text not null default '',
  changed_at timestamptz not null default now(),
  data       jsonb
);
create index if not exists pro_review_log_key_idx on public.pro_review_log (key, changed_at desc);

-- 저장할 때 저장한 사람 · 시각을 붙이고 기록을 남긴다
create or replace function public.pro_reviews_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := public.my_email();
  new.updated_at := now();
  insert into public.pro_review_log (key, changed_by, data) values (new.key, new.updated_by, new.data);
  return new;
end $$;
drop trigger if exists pro_reviews_stamp on public.pro_reviews;
create trigger pro_reviews_stamp before insert or update on public.pro_reviews
  for each row execute function public.pro_reviews_stamp();

-- 권한: 로그인한 구성원(members)만 읽고 쓴다
alter table public.pro_reviews enable row level security;
alter table public.pro_review_log enable row level security;
drop policy if exists pro_reviews_read on public.pro_reviews;
create policy pro_reviews_read on public.pro_reviews for select to authenticated using (public.is_member());
drop policy if exists pro_reviews_insert on public.pro_reviews;
create policy pro_reviews_insert on public.pro_reviews for insert to authenticated with check (public.is_member());
drop policy if exists pro_reviews_update on public.pro_reviews;
create policy pro_reviews_update on public.pro_reviews for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists pro_reviews_delete on public.pro_reviews;
create policy pro_reviews_delete on public.pro_reviews for delete to authenticated using (public.is_member());
drop policy if exists pro_review_log_read on public.pro_review_log;
create policy pro_review_log_read on public.pro_review_log for select to authenticated using (public.is_member());

grant select, insert, update, delete on public.pro_reviews to authenticated;
grant select on public.pro_review_log to authenticated;
grant usage, select on sequence public.pro_review_log_id_seq to authenticated;
grant execute on function public.is_member() to authenticated;
