-- inquiries 테이블에 RLS 정책 추가
-- Supabase Dashboard > SQL Editor에서 실행하세요

-- 1. 로그인한 사용자가 자기 문의를 INSERT 할 수 있도록 허용
create policy "Allow authenticated users to insert inquiries"
on public.inquiries for insert
with check (auth.uid()::text = user_id);

-- 2. 로그인한 사용자가 자기 문의를 SELECT 할 수 있도록 허용
create policy "Allow users to read own inquiries"
on public.inquiries for select
using (auth.uid()::text = user_id);

-- 3. 관리자는 모든 문의에 대한 전체 접근 허용
create policy "Allow admin full access to inquiries"
on public.inquiries for all
using (
  auth.jwt() ->> 'email' = 'xn940@naver.com' or 
  auth.jwt() ->> 'email' = 'juhye94@hankyung.com' or
  auth.jwt() ->> 'email' = 'pakrjh@hankyung.com' or
  auth.jwt() ->> 'email' = 'lygin729@hankyung.com'
);
