do $$
begin
  lock table public.profiles
    in share row exclusive mode;

  update public.profiles
  set email = null
  where email is not null;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_email_must_be_null'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_email_must_be_null
      check (email is null);
  end if;
end;
$$;
