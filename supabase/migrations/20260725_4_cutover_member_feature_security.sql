BEGIN;

-- ============================================
-- 1. 테스트 데이터 정리
-- ============================================
DELETE FROM public.group_participants WHERE role = 'member';
DELETE FROM public.event_participants;

-- group.membersCount 재계산 (실제 남은 참가자 수로 업데이트, status 유지)
UPDATE public.groups g
SET "membersCount" = (
  SELECT COUNT(*)
  FROM public.group_participants gp
  WHERE gp.group_id = g.id
);

-- ============================================
-- 2. 중복, NULL, leader 무결성 검증 로직 (실패 시 트랜잭션 전체 롤백)
-- ============================================
DO $$
DECLARE
  v_count integer;
BEGIN
  -- group_participants 중복 검증
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT group_id, user_id, role
    FROM public.group_participants
    GROUP BY group_id, user_id, role
    HAVING COUNT(*) > 1
  ) sub;
  IF v_count > 0 THEN RAISE EXCEPTION 'Duplicate group_participants found'; END IF;

  -- 같은 그룹에 leader와 member 동시 존재 검증
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT group_id, user_id
    FROM public.group_participants
    GROUP BY group_id, user_id
    HAVING COUNT(DISTINCT role) > 1
  ) sub;
  IF v_count > 0 THEN RAISE EXCEPTION 'Users with both leader and member roles in the same group found'; END IF;

  -- event_participants 중복 검증
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT event_id, user_id
    FROM public.event_participants
    GROUP BY event_id, user_id
    HAVING COUNT(*) > 1
  ) sub;
  IF v_count > 0 THEN RAISE EXCEPTION 'Duplicate event_participants found'; END IF;

  -- NULL 검증
  SELECT COUNT(*) INTO v_count FROM public.group_participants WHERE user_id IS NULL;
  IF v_count > 0 THEN RAISE EXCEPTION 'group_participants with NULL user_id found'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.event_participants WHERE user_id IS NULL;
  IF v_count > 0 THEN RAISE EXCEPTION 'event_participants with NULL user_id found'; END IF;

  -- leader 행이 없는 그룹 검증
  SELECT COUNT(*) INTO v_count
  FROM public.groups g 
  LEFT JOIN public.group_participants gp ON g.id = gp.group_id AND gp.role = 'leader'
  WHERE gp.id IS NULL;
  IF v_count > 0 THEN RAISE EXCEPTION 'Groups without a leader found'; END IF;

  -- leader 행이 2개 이상인 그룹 검증
  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT group_id
    FROM public.group_participants 
    WHERE role = 'leader' 
    GROUP BY group_id 
    HAVING COUNT(*) > 1
  ) sub;
  IF v_count > 0 THEN RAISE EXCEPTION 'Groups with multiple leaders found'; END IF;
END $$;

-- ============================================
-- 3. UNIQUE constraint 추가 (재실행 가능)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'group_participants_unique_join' 
      AND conrelid = 'public.group_participants'::regclass
  ) THEN
    ALTER TABLE public.group_participants ADD CONSTRAINT group_participants_unique_join UNIQUE (group_id, user_id, role);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_participants_unique_join' 
      AND conrelid = 'public.event_participants'::regclass
  ) THEN
    ALTER TABLE public.event_participants ADD CONSTRAINT event_participants_unique_join UNIQUE (event_id, user_id);
  END IF;
END $$;

-- ============================================
-- 4. 권한 차단 (직접 쓰기 방지)
-- ============================================
-- 기존 create_group_with_leader 시그니처 동적 확인 후 차단
DO $$
DECLARE
  func_sig text;
BEGIN
  FOR func_sig IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_group_with_leader'
  LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || func_sig || ' FROM PUBLIC, anon, authenticated;';
  END LOOP;
END $$;

-- 테이블 직접 수정 차단
REVOKE INSERT ON public.groups FROM PUBLIC, anon, authenticated;
REVOKE INSERT, DELETE, UPDATE ON public.group_participants FROM PUBLIC, anon, authenticated;
REVOKE INSERT, DELETE, UPDATE ON public.event_participants FROM PUBLIC, anon, authenticated;

COMMIT;
