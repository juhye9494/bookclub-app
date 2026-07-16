-- inquiries 테이블 RLS 정책 (전체)
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- 기존 정책이 있으면 먼저 삭제하고 실행

-- 기존 정책 삭제 (에러 무시)
DROP POLICY IF EXISTS "Allow authenticated users to insert inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow users to read own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow admin full access to inquiries" ON public.inquiries;

-- 1. 로그인한 사용자가 자기 문의를 INSERT
CREATE POLICY "Allow authenticated users to insert inquiries"
ON public.inquiries FOR INSERT
WITH CHECK (auth.uid()::text = user_id);

-- 2. 로그인한 사용자가 자기 문의를 SELECT
CREATE POLICY "Allow users to read own inquiries"
ON public.inquiries FOR SELECT
USING (auth.uid()::text = user_id);

-- 3. 로그인한 사용자가 자기 문의를 UPDATE (상태 확인 등)
CREATE POLICY "Allow users to update own inquiries"
ON public.inquiries FOR UPDATE
USING (auth.uid()::text = user_id);

-- 4. 관리자는 모든 문의에 대한 전체 접근 (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Allow admin full access to inquiries"
ON public.inquiries FOR ALL
USING (
  auth.jwt() ->> 'email' IN (
    'xn940@naver.com',
    'juhye94@hankyung.com',
    'pakrjh@hankyung.com',
    'lygin729@hankyung.com'
  )
);
