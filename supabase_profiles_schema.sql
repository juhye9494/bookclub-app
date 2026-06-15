-- ============================================
-- 1. profiles 테이블 생성 (회원 관리용)
-- ============================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  phone text,
  address text,
  has_paid boolean default false,
  created_at timestamp with time zone default now()
);

-- ============================================
-- 2. 신규 회원가입 시 자동 프로필 생성 트리거
-- ============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, phone, address, has_paid)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address',
    coalesce((new.raw_user_meta_data->>'has_paid')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer;

-- 트리거 연결 (이미 있으면 먼저 삭제)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 3. 기존 가입 회원 백필 (이미 가입한 사람들)
-- ============================================
insert into public.profiles (id, email, name, phone, address, has_paid)
select 
  id, email,
  raw_user_meta_data->>'name',
  raw_user_meta_data->>'phone', 
  raw_user_meta_data->>'address',
  coalesce((raw_user_meta_data->>'has_paid')::boolean, false)
from auth.users
on conflict (id) do nothing;

-- ============================================
-- 4. RLS 보안 정책
-- ============================================
alter table public.profiles enable row level security;

-- 관리자: 모든 프로필 조회/수정 가능
create policy "Admin full access to profiles"
on public.profiles for all
using (
  auth.jwt() ->> 'email' = 'xn940@naver.com' or 
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com'
);

-- 일반 회원: 본인 프로필만 조회 가능
create policy "Users can view own profile"
on public.profiles for select
using (auth.uid() = id);
