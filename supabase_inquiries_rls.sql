-- ============================================
-- inquiries 테이블 RLS 정책 (최종)
-- Supabase Dashboard > SQL Editor에서 실행
-- ============================================

-- 1단계: 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Allow authenticated users to insert inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow users to read own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow users to update own inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow admin full access to inquiries" ON public.inquiries;

-- 2단계: RLS 비활성화 후 재활성화 (초기화)
ALTER TABLE public.inquiries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- 3단계: 정책 생성

-- 사용자: 자기 문의 작성
CREATE POLICY "inquiries_insert"
ON public.inquiries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 사용자: 자기 문의 조회
CREATE POLICY "inquiries_select"
ON public.inquiries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 사용자: 자기 문의 수정
CREATE POLICY "inquiries_update"
ON public.inquiries FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 관리자: 모든 문의 전체 접근 (조회+답변+수정+삭제)
CREATE POLICY "inquiries_admin"
ON public.inquiries FOR ALL
TO authenticated
USING (
  auth.jwt() ->> 'email' IN (
    'xn940@naver.com',
    'juhye94@hankyung.com',
    'pakrjh@hankyung.com',
    'lygin729@hankyung.com'
  )
);
