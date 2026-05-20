-- 1. 이벤트(Events) 테이블 생성
create table public.events (
  id text primary key,
  title text not null,
  category text not null, -- '저자강연', '패밀리행사', '문화제휴' 등
  date text not null, -- 일시 (예: 2026-06-15 (월) 19:30)
  location text not null, -- 장소 (예: 한국경제신문사 18F 다산홀)
  cover text, -- 포스터/썸네일 이미지 URL
  description text, -- 상세 설명 (HTML/Text 지원)
  order_idx integer default 0, -- 정렬 순서
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 보안 정책(RLS) 설정
alter table public.events enable row level security;

-- 누구나 이벤트를 조회할 수 있음
create policy "Allow public read access to events"
on public.events for select
using (true);

-- 관리자(xn940@naver.com, juhye94@hankyung.com)는 모든 권한을 가짐
create policy "Allow admin full access to events"
on public.events for all
using (
  auth.jwt() ->> 'email' = 'xn940@naver.com' or 
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com'
);
