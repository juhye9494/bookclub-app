create or replace function public.reorder_books_atomic(
  p_cycle_id text,
  p_ordered_book_ids text[]
) returns void
security definer
set search_path = ''
language plpgsql
as $$
declare
  v_db_count int;
  v_req_count int;
  v_db_ids text[];
begin
  -- 1. 기수 존재 여부 확인
  if not exists (select 1 from public.cycles where id = p_cycle_id) then
    raise exception 'Cycle does not exist';
  end if;
  
  -- 2. 빈 배열 처리
  if array_length(p_ordered_book_ids, 1) is null then
    p_ordered_book_ids := '{}'::text[];
  end if;

  -- 3. 요청 배열 중복 검사
  select count(distinct id) into v_req_count from unnest(p_ordered_book_ids) as id;
  if v_req_count != coalesce(array_length(p_ordered_book_ids, 1), 0) then
    raise exception 'Duplicate book IDs in request';
  end if;

  -- 4. DB에서 해당 기수의 전체 도서 수 및 ID 목록 조회 (is_deleted = false 만)
  select count(*), array_agg(id) into v_db_count, v_db_ids
  from public.books
  where cycle_id = p_cycle_id and is_deleted = false;

  v_db_count := coalesce(v_db_count, 0);
  if v_db_ids is null then
    v_db_ids := '{}'::text[];
  end if;

  -- 5. 요청 도서 수와 DB 도서 수 일치 검사
  if v_db_count != coalesce(array_length(p_ordered_book_ids, 1), 0) then
    raise exception 'Count mismatch between request and database';
  end if;

  -- 6. 요청된 모든 도서가 해당 기수의 도서인지 확인
  if not p_ordered_book_ids <@ v_db_ids or not v_db_ids <@ p_ordered_book_ids then
    raise exception 'Book IDs do not match the database exactly';
  end if;

  -- 7. 일괄 업데이트 (order_idx는 0부터 시작)
  with new_orders as (
    select id, (ordinality - 1) as new_idx
    from unnest(p_ordered_book_ids) with ordinality as u(id, ordinality)
  )
  update public.books b
  set order_idx = n.new_idx
  from new_orders n
  where b.id = n.id;
  
end;
$$;

revoke all on function public.reorder_books_atomic(text, text[]) from public, anon, authenticated;
grant execute on function public.reorder_books_atomic(text, text[]) to service_role;
