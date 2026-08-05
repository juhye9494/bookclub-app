do $$
begin
  lock table public.group_participants
    in share row exclusive mode;

  update public.group_participants
  set
    user_name = null,
    user_email = null
  where user_name is not null
     or user_email is not null;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_participants_user_name_must_be_null'
      and conrelid = 'public.group_participants'::regclass
  ) then
    alter table public.group_participants
      add constraint group_participants_user_name_must_be_null
      check (user_name is null);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'group_participants_user_email_must_be_null'
      and conrelid = 'public.group_participants'::regclass
  ) then
    alter table public.group_participants
      add constraint group_participants_user_email_must_be_null
      check (user_email is null);
  end if;
end;
$$;

revoke execute on function public.create_group_secure(
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  integer,
  text[],
  text[],
  text,
  text,
  text
) from service_role;

revoke execute on function public.join_group_atomic(
  text,
  uuid,
  text,
  text
) from service_role;
