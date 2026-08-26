-- 1. base_like_count 추가 및 기존 데이터 처리
DO $$
BEGIN
  -- 컬럼이 없을 때만 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'insights' AND column_name = 'base_like_count'
  ) THEN
    ALTER TABLE public.insights ADD COLUMN base_like_count integer;
  END IF;
END $$;

-- 기존 데이터(NULL)에 최초 1회 랜덤값 할당
UPDATE public.insights 
SET base_like_count = floor(random() * 13 + 8)::int 
WHERE base_like_count IS NULL;

-- 디폴트 설정 및 NOT NULL 제약 추가
ALTER TABLE public.insights 
ALTER COLUMN base_like_count SET DEFAULT floor(random() * 13 + 8)::int,
ALTER COLUMN base_like_count SET NOT NULL;

-- 8~20 CHECK 제약 조건 추가 (이름 중복 방지)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public' 
      AND t.relname = 'insights' 
      AND c.conname = 'check_base_like_count'
  ) THEN
    ALTER TABLE public.insights
    ADD CONSTRAINT check_base_like_count CHECK (base_like_count BETWEEN 8 AND 20);
  END IF;
END $$;


-- 2. 실제 좋아요 집계 RPC 생성 (SECURITY DEFINER, search_path 보안 적용)
CREATE OR REPLACE FUNCTION public.get_insight_like_counts()
RETURNS TABLE (post_id text, like_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT l.post_id, count(*)::integer
  FROM public.insight_likes l
  GROUP BY l.post_id;
END;
$$;

-- 모든 PUBLIC 실행 권한 회수 후 필요한 권한만 부여
REVOKE ALL ON FUNCTION public.get_insight_like_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_insight_like_counts() TO anon, authenticated, service_role;


-- 3. insight_likes 테이블 RLS 정책 설정 (본인 데이터만 조회 및 조작)
GRANT SELECT, INSERT, DELETE ON TABLE public.insight_likes TO authenticated;

DROP POLICY IF EXISTS "본인 좋아요만 조회 가능" ON public.insight_likes;
DROP POLICY IF EXISTS "본인 명의로만 좋아요 생성 가능" ON public.insight_likes;
DROP POLICY IF EXISTS "본인 좋아요만 삭제 가능" ON public.insight_likes;

CREATE POLICY "본인 좋아요만 조회 가능" 
ON public.insight_likes FOR SELECT 
TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "본인 명의로만 좋아요 생성 가능" 
ON public.insight_likes FOR INSERT 
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 좋아요만 삭제 가능" 
ON public.insight_likes FOR DELETE 
TO authenticated USING (auth.uid() = user_id);
