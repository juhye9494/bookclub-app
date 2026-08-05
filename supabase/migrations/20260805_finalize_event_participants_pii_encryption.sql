do $$
declare
  v_total integer;
  v_protected integer;
begin
  lock table public.event_participants
    in share row exclusive mode;

  select
    count(*),
    count(*) filter (
      where nullif(btrim(user_name_enc), '') is not null
        and nullif(btrim(user_email_enc), '') is not null
        and pii_key_version is not null
        and pii_key_version > 0
    )
  into v_total, v_protected
  from public.event_participants;

  if v_total <> v_protected then
    raise exception 'Unprotected event participants remain';
  end if;

  update public.event_participants
  set
    user_name = null,
    user_email = null
  where user_name is not null
     or user_email is not null;

  alter table public.event_participants
    alter column user_name_enc set not null,
    alter column user_email_enc set not null,
    alter column pii_key_version set not null;
end;
$$;
