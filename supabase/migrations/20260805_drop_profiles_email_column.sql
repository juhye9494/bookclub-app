do $$
begin
  lock table public.profiles
    in access exclusive mode;

  alter table public.profiles
    drop constraint if exists profiles_email_must_be_null;

  alter table public.profiles
    drop column if exists email;
end;
$$;
