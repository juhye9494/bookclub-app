do $$
begin
  if exists (
    select 1
    from public.book_orders
    where shipping_name_enc is null
       or shipping_phone_enc is null
       or shipping_address_enc is null
       or pii_key_version is null
  ) then
    raise exception 'Unprotected book orders remain';
  end if;

  alter table public.book_orders
    alter column shipping_name_enc set not null,
    alter column shipping_phone_enc set not null,
    alter column shipping_address_enc set not null,
    alter column pii_key_version set not null;
end;
$$;
