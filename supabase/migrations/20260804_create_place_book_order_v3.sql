create or replace function public.place_book_order_v3(
  p_book_order_id uuid,
  p_subscription_order_id uuid,
  p_user_id uuid,
  p_book_ids text[],
  p_shipping_name text,
  p_shipping_phone text,
  p_shipping_address text,
  p_shipping_name_enc text,
  p_shipping_phone_enc text,
  p_shipping_address_enc text,
  p_pii_key_version smallint
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_result jsonb;
  v_row_count int;
  v_pattern text;
begin
  if p_shipping_name_enc is null or trim(p_shipping_name_enc) = '' or length(p_shipping_name_enc) > 8192 then
    raise exception 'Invalid encrypted shipping data';
  end if;

  if p_shipping_phone_enc is null or trim(p_shipping_phone_enc) = '' or length(p_shipping_phone_enc) > 8192 then
    raise exception 'Invalid encrypted shipping data';
  end if;

  if p_shipping_address_enc is null or trim(p_shipping_address_enc) = '' or length(p_shipping_address_enc) > 8192 then
    raise exception 'Invalid encrypted shipping data';
  end if;

  if p_pii_key_version is null or p_pii_key_version <= 0 then
    raise exception 'Invalid encrypted shipping data';
  end if;

  v_pattern := '^enc:v' || p_pii_key_version::text || ':[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$';

  if p_shipping_name_enc !~ v_pattern then
    raise exception 'Invalid encrypted shipping data';
  end if;

  if p_shipping_phone_enc !~ v_pattern then
    raise exception 'Invalid encrypted shipping data';
  end if;

  if p_shipping_address_enc !~ v_pattern then
    raise exception 'Invalid encrypted shipping data';
  end if;

  v_result := public.place_book_order_v2(
    p_book_order_id,
    p_subscription_order_id,
    p_user_id,
    p_book_ids,
    p_shipping_name,
    p_shipping_phone,
    p_shipping_address
  );

  update public.book_orders
  set
    shipping_name_enc = p_shipping_name_enc,
    shipping_phone_enc = p_shipping_phone_enc,
    shipping_address_enc = p_shipping_address_enc,
    pii_key_version = p_pii_key_version
  where id = p_book_order_id
    and subscription_order_id = p_subscription_order_id
    and user_id = p_user_id;

  get diagnostics v_row_count = ROW_COUNT;

  if v_row_count <> 1 then
    raise exception 'Failed to secure book order shipping data';
  end if;

  return v_result;
end;
$$;

revoke all on function public.place_book_order_v3(
  uuid, uuid, uuid, text[], text, text, text, text, text, text, smallint
) from public;

revoke all on function public.place_book_order_v3(
  uuid, uuid, uuid, text[], text, text, text, text, text, text, smallint
) from anon;

revoke all on function public.place_book_order_v3(
  uuid, uuid, uuid, text[], text, text, text, text, text, text, smallint
) from authenticated;

grant execute on function public.place_book_order_v3(
  uuid, uuid, uuid, text[], text, text, text, text, text, text, smallint
) to service_role;
