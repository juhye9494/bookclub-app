create or replace function public.place_book_order_v5(
  p_book_order_id uuid,
  p_subscription_order_id uuid,
  p_user_id uuid,
  p_book_ids text[],
  p_shipping_name_enc text,
  p_shipping_phone_enc text,
  p_shipping_address_enc text,
  p_pii_key_version smallint,
  p_delivery_note_enc text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_current_total integer;
  v_new_order_id uuid;
  v_book_id text;
  v_trimmed_book_id text;
  v_existing_book record;
  v_total_requested integer := 0;
  v_valid_book_count integer := 0;
  v_order record;
  v_cycle record;
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

  if p_delivery_note_enc is not null and p_delivery_note_enc !~ v_pattern then
    raise exception 'Invalid encrypted delivery note';
  end if;

  if p_book_order_id is null then
    raise exception 'p_book_order_id가 제공되지 않았습니다.';
  end if;
  
  if p_user_id is null then
    raise exception 'p_user_id가 제공되지 않았습니다.';
  end if;

  if p_book_ids is null or array_length(p_book_ids, 1) is null or array_length(p_book_ids, 1) = 0 then
    raise exception '선택한 도서가 없습니다.';
  end if;

  v_total_requested := array_length(p_book_ids, 1);

  for v_book_id in select unnest(p_book_ids)
  loop
    if v_book_id is null then
      raise exception '유효하지 않은 도서 아이디(NULL)가 포함되어 있습니다.';
    end if;
    
    v_trimmed_book_id := trim(v_book_id);
    if length(v_trimmed_book_id) = 0 then
      raise exception '유효하지 않은 도서 아이디(빈 문자열)가 포함되어 있습니다.';
    end if;
  end loop;

  if (select count(distinct trim(b)) from unnest(p_book_ids) b) != v_total_requested then
    raise exception '요청 중 중복된 도서가 있습니다.';
  end if;

  select
    user_id,
    cycle_id
  into v_order
  from public.orders 
  where id = p_subscription_order_id and payment_status = 'DONE'
  for update;

  if not found then
    raise exception '유효한 구독 결제 내역(DONE)을 찾을 수 없거나 해당 주문이 존재하지 않습니다.';
  end if;

  if v_order.user_id != p_user_id then
    raise exception '본인의 구독 주문이 아닙니다.';
  end if;

  select
    id,
    status,
    book_order_end_date,
    max_book_count
  into v_cycle
  from public.cycles where id = v_order.cycle_id;
  
  if not found then
    raise exception '연결된 기수(Cycle) 정보를 찾을 수 없습니다.';
  end if;

  if v_cycle.status = 'closed' then
    raise exception '해당 기수는 도서 주문이 마감되었습니다 (status=closed).';
  end if;

  if now() > v_cycle.book_order_end_date then
    raise exception '도서 주문 기간이 지났습니다.';
  end if;

  select count(*)
  into v_valid_book_count
  from public.books
  where id = any(select trim(b) from unnest(p_book_ids) b)
    and cycle_id = v_cycle.id
    and is_public = true
    and is_orderable = true
    and is_deleted = false;

  if v_valid_book_count != v_total_requested then
    raise exception '주문할 수 없거나 존재하지 않는 도서가 포함되어 있습니다.';
  end if;

  select coalesce(sum(boi.quantity), 0) into v_current_total
  from public.book_orders bo
  join public.book_order_items boi on bo.id = boi.book_order_id
  where bo.subscription_order_id = p_subscription_order_id
    and bo.order_status != '주문취소';

  if v_current_total + v_total_requested > v_cycle.max_book_count then
    raise exception '최대 %권까지만 주문 가능합니다.', v_cycle.max_book_count;
  end if;

  for v_book_id in select unnest(p_book_ids)
  loop
    v_trimmed_book_id := trim(v_book_id);
    select bo.id into v_existing_book
    from public.book_orders bo
    join public.book_order_items boi on bo.id = boi.book_order_id
    where bo.subscription_order_id = p_subscription_order_id
      and bo.order_status != '주문취소'
      and boi.book_id = v_trimmed_book_id;

    if found then
      raise exception '이미 신청한 도서가 포함되어 있습니다: %', v_trimmed_book_id;
    end if;
  end loop;

  insert into public.book_orders (
    id,
    subscription_order_id,
    user_id,
    cycle_id,
    order_status,
    shipping_name,
    shipping_phone,
    shipping_address,
    shipping_name_enc,
    shipping_phone_enc,
    shipping_address_enc,
    pii_key_version,
    delivery_note_enc
  )
  values (
    p_book_order_id,
    p_subscription_order_id,
    p_user_id,
    v_cycle.id,
    '주문접수',
    null,
    null,
    null,
    p_shipping_name_enc,
    p_shipping_phone_enc,
    p_shipping_address_enc,
    p_pii_key_version,
    p_delivery_note_enc
  )
  returning id into v_new_order_id;

  insert into public.book_order_items (book_order_id, book_id, book_title_snapshot, quantity)
  select v_new_order_id, id, title, 1
  from public.books
  where id = any(select trim(b) from unnest(p_book_ids) b)
    and cycle_id = v_cycle.id
    and is_public = true
    and is_orderable = true
    and is_deleted = false;

  return jsonb_build_object('success', true, 'book_order_id', v_new_order_id);
end;
$$;

revoke all on function public.place_book_order_v5(
  uuid, uuid, uuid, text[], text, text, text, smallint, text
) from public;

revoke all on function public.place_book_order_v5(
  uuid, uuid, uuid, text[], text, text, text, smallint, text
) from anon;

revoke all on function public.place_book_order_v5(
  uuid, uuid, uuid, text[], text, text, text, smallint, text
) from authenticated;

grant execute on function public.place_book_order_v5(
  uuid, uuid, uuid, text[], text, text, text, smallint, text
) to service_role;
