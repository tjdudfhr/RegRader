-- RegRader 대응 현황 관리 (Supabase)
-- Supabase 대시보드 > SQL Editor > New query 에 전부 붙여 넣고 Run.
-- 여러 번 실행해도 안전합니다 (이미 있으면 건너뜀).
--
-- 구조
--   members       사용할 사람 (이메일 · 이름 · 직무 · 역할). 총괄(admin)은 전체, 담당자(member)는 자기 직무만 고칠 수 있다.
--   responses     개정 1건당 대응 상태 1줄 (상태 · 영향도 · 조치 내용 · 기한 · 완료일 · 증빙 링크)
--   response_log  누가 언제 무엇을 바꿨는지 자동 기록 (지울 수 없음)
-- 로그인은 이메일 링크(비밀번호 없음). members 에 없는 이메일은 로그인해도 아무것도 보거나 고칠 수 없다.

-- ---------- 표 ----------
create table if not exists public.members (
  email      text primary key check (email = lower(email)),
  name       text not null default '',
  job        text check (job in ('재무회계','인사노무','환경','지식재산권','공정거래','안전','지배구조','정보보호')),
  role       text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  key            text primary key,                 -- 개정 키: 법령명|시행일|개정구분 (사이트와 같음)
  job            text not null,                    -- 그 개정의 직무 (권한 판단에 씀)
  title          text not null default '',
  effective_date date,
  amendment_type text not null default '',
  status         text not null default '미검토' check (status in ('미검토','검토중','조치필요','조치완료','해당없음')),
  impact         text check (impact in ('상','중','하')),
  action         text not null default '',         -- 조치 내용 · 메모
  due_date       date,                             -- 조치 기한
  done_date      date,                             -- 완료일
  evidence_url   text not null default '',         -- 증빙 문서 링크 (사내 문서함 등)
  updated_by     text not null default '',
  updated_at     timestamptz not null default now()
);

create table if not exists public.response_log (
  id         bigserial primary key,
  key        text not null,
  changed_by text not null default '',
  changed_at timestamptz not null default now(),
  old_row    jsonb,
  new_row    jsonb
);
create index if not exists response_log_key_idx on public.response_log (key, changed_at desc);

-- ---------- 로그인한 사람 확인 ----------
create or replace function public.my_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = public.my_email())
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where email = public.my_email() and role = 'admin')
$$;

create or replace function public.my_job() returns text
language sql stable security definer set search_path = public as $$
  select job from public.members where email = public.my_email()
$$;

-- ---------- 수정 시각 · 수정한 사람 · 이력 ----------
create or replace function public.responses_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := public.my_email();
  insert into public.response_log (key, changed_by, old_row, new_row)
  values (new.key, public.my_email(), case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;

drop trigger if exists responses_touch on public.responses;
create trigger responses_touch before insert or update on public.responses
for each row execute function public.responses_touch();

-- ---------- 권한 (행 단위) ----------
alter table public.members      enable row level security;
alter table public.responses    enable row level security;
alter table public.response_log enable row level security;

drop policy if exists members_read  on public.members;
drop policy if exists members_admin on public.members;
create policy members_read  on public.members for select to authenticated using (public.is_member());
create policy members_admin on public.members for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists responses_read   on public.responses;
drop policy if exists responses_insert on public.responses;
drop policy if exists responses_update on public.responses;
drop policy if exists responses_delete on public.responses;
create policy responses_read   on public.responses for select to authenticated using (public.is_member());
create policy responses_insert on public.responses for insert to authenticated with check (public.is_admin() or job = public.my_job());
create policy responses_update on public.responses for update to authenticated using (public.is_admin() or job = public.my_job()) with check (public.is_admin() or job = public.my_job());
create policy responses_delete on public.responses for delete to authenticated using (public.is_admin());

drop policy if exists log_read on public.response_log;
create policy log_read on public.response_log for select to authenticated using (public.is_member());

-- ---------- 사용할 사람 ----------
-- 총괄(본인). 회사 메일로 로그인할 거라면 아래 이메일을 회사 메일로 바꿔서 실행하세요.
insert into public.members (email, name, job, role) values ('tjdudfhr1@gmail.com', '총괄', null, 'admin')
on conflict (email) do nothing;

-- 직무별 담당자: 이메일·이름을 채운 뒤 맨 앞의 -- 를 지우고 실행 (나중에 사이트에서 추가해도 됩니다)
-- insert into public.members (email, name, job) values
--   ('담당자1@company.com', '홍길동', '재무회계'),
--   ('담당자2@company.com', '김철수', '인사노무'),
--   ('담당자3@company.com', '이영희', '환경'),
--   ('담당자4@company.com', '박민수', '지식재산권'),
--   ('담당자5@company.com', '최지은', '공정거래'),
--   ('담당자6@company.com', '정우성', '안전'),
--   ('담당자7@company.com', '한가인', '지배구조'),
--   ('담당자8@company.com', '오세훈', '정보보호')
-- on conflict (email) do update set name = excluded.name, job = excluded.job;
