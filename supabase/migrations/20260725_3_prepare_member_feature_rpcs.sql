BEGIN;

-- ============================================
-- 1. 신규 안전 RPC 생성 (사전 배포)
-- ============================================

-- (1) 독서모임 생성
CREATE OR REPLACE FUNCTION create_group_secure(
  p_id text, p_title text, p_desc text, p_book text,
  p_creator_id uuid, p_creator_email text, p_creator_name text,
  p_max_members integer, p_tags text[], p_perks text[],
  p_place text, p_time text, p_intro text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1) groups 테이블 삽입
  INSERT INTO public.groups (
    id, title, "desc", book, leader,
    "maxMembers", "membersCount", tags, perks,
    place, time, intro,
    creator_id, status
  ) VALUES (
    p_id, p_title, p_desc, p_book, p_creator_name,
    p_max_members, 1, p_tags, p_perks,
    p_place, p_time, p_intro,
    p_creator_id, '모집중'
  );

  -- 2) group_participants 방장(leader) 등록
  INSERT INTO public.group_participants (
    group_id, user_id, user_email, user_name, role, group_title
  ) VALUES (
    p_id, p_creator_id, p_creator_email, p_creator_name, 'leader', p_title
  );

  RETURN json_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_group_secure(text, text, text, text, uuid, text, text, integer, text[], text[], text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_secure(text, text, text, text, uuid, text, text, integer, text[], text[], text, text, text) TO service_role;


-- (2) 독서모임 참가 (join) - 방장 중복 차단 포함, status 수정 안함
CREATE OR REPLACE FUNCTION join_group_atomic(p_group_id text, p_user_id uuid, p_user_email text, p_user_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group record;
  v_exists boolean;
  v_is_leader boolean;
BEGIN
  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'code', 'GROUP_NOT_FOUND'); END IF;
  
  -- 방장 여부 확인 (작성자 ID이거나 이미 leader 역할인 경우)
  SELECT EXISTS(SELECT 1 FROM public.group_participants WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'leader') INTO v_is_leader;
  IF v_group.creator_id = p_user_id OR v_is_leader THEN
    RETURN json_build_object('success', false, 'code', 'CREATOR_CANNOT_JOIN');
  END IF;

  IF v_group.status = '모집마감' OR v_group."membersCount" >= v_group."maxMembers" THEN
    RETURN json_build_object('success', false, 'code', 'GROUP_CLOSED');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.group_participants WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'member') INTO v_exists;
  IF v_exists THEN RETURN json_build_object('success', false, 'code', 'ALREADY_JOINED'); END IF;

  INSERT INTO public.group_participants (group_id, user_id, user_email, user_name, role, group_title)
  VALUES (p_group_id, p_user_id, p_user_email, p_user_name, 'member', v_group.title);

  UPDATE public.groups SET "membersCount" = (SELECT COUNT(*) FROM public.group_participants WHERE group_id = p_group_id) WHERE id = p_group_id;

  RETURN json_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_group_atomic(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_atomic(text, uuid, text, text) TO service_role;


-- (3) 독서모임 참가 취소 (leave) - status 수정 안함
CREATE OR REPLACE FUNCTION leave_group_atomic(p_group_id text, p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_group record;
  v_deleted boolean;
BEGIN
  SELECT * INTO v_group FROM public.groups WHERE id = p_group_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'code', 'GROUP_NOT_FOUND'); END IF;

  WITH deleted AS (
    DELETE FROM public.group_participants 
    WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'member'
    RETURNING id
  )
  SELECT EXISTS(SELECT 1 FROM deleted) INTO v_deleted;
  
  IF NOT v_deleted THEN
    RETURN json_build_object('success', false, 'code', 'MEMBERSHIP_NOT_FOUND');
  END IF;

  UPDATE public.groups
  SET "membersCount" = (SELECT COUNT(*) FROM public.group_participants WHERE group_id = p_group_id)
  WHERE id = p_group_id;

  RETURN json_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.leave_group_atomic(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group_atomic(text, uuid) TO service_role;


-- (4) 이벤트 참가 (apply_event)
CREATE OR REPLACE FUNCTION apply_event_atomic(p_event_id text, p_user_id uuid, p_user_email text, p_user_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists boolean;
  v_event record;
BEGIN
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'code', 'EVENT_NOT_FOUND'); END IF;

  SELECT EXISTS(SELECT 1 FROM public.event_participants WHERE event_id = p_event_id AND user_id = p_user_id) INTO v_exists;
  IF v_exists THEN RETURN json_build_object('success', false, 'code', 'ALREADY_APPLIED'); END IF;

  INSERT INTO public.event_participants (event_id, user_id, user_email, user_name, event_title)
  VALUES (p_event_id, p_user_id, p_user_email, p_user_name, v_event.title);

  RETURN json_build_object('success', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_event_atomic(text, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_event_atomic(text, uuid, text, text) TO service_role;

COMMIT;
