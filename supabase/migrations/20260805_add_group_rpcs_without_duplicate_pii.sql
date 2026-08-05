begin;

create or replace function public.create_group_secure_v2(
  p_id text,
  p_title text,
  p_desc text,
  p_book text,
  p_creator_id uuid,
  p_creator_name text,
  p_max_members integer,
  p_tags text[],
  p_perks text[],
  p_place text,
  p_time text,
  p_intro text
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_id is null or trim(p_id) = '' then
    raise exception 'p_id must not be null or empty';
  end if;
  if p_creator_id is null then
    raise exception 'p_creator_id must not be null';
  end if;

  -- 1) groups 테이블 삽입
  insert into public.groups (
    id, title, "desc", book, leader,
    "maxMembers", "membersCount", tags, perks,
    place, time, intro,
    creator_id, status
  ) values (
    p_id, p_title, p_desc, p_book, p_creator_name,
    p_max_members, 1, p_tags, p_perks,
    p_place, p_time, p_intro,
    p_creator_id, '모집중'
  );

  -- 2) group_participants 방장(leader) 등록
  insert into public.group_participants (
    group_id, user_id, user_email, user_name, role, group_title
  ) values (
    p_id, p_creator_id, null, null, 'leader', p_title
  );

  return pg_catalog.json_build_object('success', true);
end;
$$;

revoke all on function public.create_group_secure_v2(
  text,
  text,
  text,
  text,
  uuid,
  text,
  integer,
  text[],
  text[],
  text,
  text,
  text
) from public;

revoke all on function public.create_group_secure_v2(
  text,
  text,
  text,
  text,
  uuid,
  text,
  integer,
  text[],
  text[],
  text,
  text,
  text
) from anon;

revoke all on function public.create_group_secure_v2(
  text,
  text,
  text,
  text,
  uuid,
  text,
  integer,
  text[],
  text[],
  text,
  text,
  text
) from authenticated;

grant execute on function public.create_group_secure_v2(
  text,
  text,
  text,
  text,
  uuid,
  text,
  integer,
  text[],
  text[],
  text,
  text,
  text
) to service_role;


create or replace function public.join_group_atomic_v2(
  p_group_id text,
  p_user_id uuid
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group record;
  v_exists boolean;
  v_is_leader boolean;
begin
  if p_group_id is null or trim(p_group_id) = '' then
    raise exception 'p_group_id must not be null or empty';
  end if;
  if p_user_id is null then
    raise exception 'p_user_id must not be null';
  end if;

  select * into v_group from public.groups where id = p_group_id for update;
  if not found then return pg_catalog.json_build_object('success', false, 'code', 'GROUP_NOT_FOUND'); end if;
  
  -- 방장 여부 확인 (작성자 ID이거나 이미 leader 역할인 경우)
  select exists(select 1 from public.group_participants where group_id = p_group_id and user_id = p_user_id and role = 'leader') into v_is_leader;
  if v_group.creator_id = p_user_id or v_is_leader then
    return pg_catalog.json_build_object('success', false, 'code', 'CREATOR_CANNOT_JOIN');
  end if;

  if v_group.status = '모집마감' or v_group."membersCount" >= v_group."maxMembers" then
    return pg_catalog.json_build_object('success', false, 'code', 'GROUP_CLOSED');
  end if;

  select exists(select 1 from public.group_participants where group_id = p_group_id and user_id = p_user_id and role = 'member') into v_exists;
  if v_exists then return pg_catalog.json_build_object('success', false, 'code', 'ALREADY_JOINED'); end if;

  insert into public.group_participants (group_id, user_id, user_email, user_name, role, group_title)
  values (p_group_id, p_user_id, null, null, 'member', v_group.title);

  update public.groups set "membersCount" = (select count(*) from public.group_participants where group_id = p_group_id) where id = p_group_id;

  return pg_catalog.json_build_object('success', true);
end;
$$;

revoke all on function public.join_group_atomic_v2(
  text,
  uuid
) from public;

revoke all on function public.join_group_atomic_v2(
  text,
  uuid
) from anon;

revoke all on function public.join_group_atomic_v2(
  text,
  uuid
) from authenticated;

grant execute on function public.join_group_atomic_v2(
  text,
  uuid
) to service_role;

commit;
