-- ============================================
-- insights 테이블 생성
-- ============================================
create table if not exists public.insights (
  id text primary key,
  title text not null,
  author text not null,
  day text not null,           -- '월요일', '수요일', '금요일'
  type text not null,          -- '에디터 칼럼', '마케터 베스트 리뷰', '독서 습관 에세이'
  date text not null,
  summary text,
  content text,
  cover text,
  likes integer default 0,
  order_idx integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS 설정
alter table public.insights enable row level security;

-- 누구나 조회 가능
create policy "Allow public read access to insights"
on public.insights for select
using (true);

-- 관리자 전체 권한
create policy "Allow admin full access to insights"
on public.insights for all
using (
  auth.jwt() ->> 'email' = 'xn940@naver.com' or 
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com'
);

-- ============================================
-- events 테이블에 status 컬럼 추가 (없으면)
-- ============================================
alter table public.events add column if not exists status text default '모집중';
