-- Migration: Remove book_order_start_date restriction from place_book_order RPC
-- DO NOT RUN YET. Run only after review.

CREATE OR REPLACE FUNCTION public.place_book_order(
  p_subscription_order_id UUID,
  p_book_ids TEXT[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_current_total INTEGER;
  v_new_order_id UUID;
  v_book_id TEXT;
  v_trimmed_book_id TEXT;
  v_existing_book RECORD;
  v_total_requested INTEGER := 0;
  v_valid_book_count INTEGER := 0;
  v_order RECORD;
  v_cycle RECORD;
BEGIN
  -- Basic Validation
  IF array_length(p_book_ids, 1) IS NULL OR array_length(p_book_ids, 1) = 0 THEN
    RAISE EXCEPTION '선택한 도서가 없습니다.';
  END IF;

  v_total_requested := array_length(p_book_ids, 1);

  -- Check for null or empty book_ids
  FOR v_book_id IN SELECT unnest(p_book_ids)
  LOOP
    IF v_book_id IS NULL THEN
      RAISE EXCEPTION '유효하지 않은 도서 아이디(NULL)가 포함되어 있습니다.';
    END IF;
    
    v_trimmed_book_id := trim(v_book_id);
    IF length(v_trimmed_book_id) = 0 THEN
      RAISE EXCEPTION '유효하지 않은 도서 아이디(빈 문자열)가 포함되어 있습니다.';
    END IF;
  END LOOP;

  IF (SELECT count(DISTINCT trim(b)) FROM unnest(p_book_ids) b) != v_total_requested THEN
    RAISE EXCEPTION '요청 중 중복된 도서가 있습니다.';
  END IF;

  -- 1. Lock the subscription order to prevent concurrent updates and fetch associated user/cycle
  SELECT * INTO v_order FROM public.orders 
  WHERE id = p_subscription_order_id AND payment_status = 'DONE'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '유효한 구독 결제 내역(DONE)을 찾을 수 없거나 해당 주문이 존재하지 않습니다.';
  END IF;

  -- 2. Fetch Cycle data and check bounds
  SELECT * INTO v_cycle FROM public.cycles WHERE id = v_order.cycle_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '연결된 기수(Cycle) 정보를 찾을 수 없습니다.';
  END IF;

  IF v_cycle.status = 'closed' THEN
    RAISE EXCEPTION '해당 기수는 도서 주문이 마감되었습니다 (status=closed).';
  END IF;

  -- Remove start date check, keep end date check
  IF NOW() > v_cycle.book_order_end_date THEN
    RAISE EXCEPTION '도서 주문 기간이 지났습니다.';
  END IF;

  -- 3. Validate requested books
  SELECT COUNT(*)
  INTO v_valid_book_count
  FROM public.books
  WHERE id = ANY(SELECT trim(b) FROM unnest(p_book_ids) b)
    AND cycle_id = v_cycle.id
    AND is_public = true
    AND is_orderable = true
    AND is_deleted = false;

  IF v_valid_book_count != v_total_requested THEN
    RAISE EXCEPTION '주문할 수 없거나 존재하지 않는 도서가 포함되어 있습니다.';
  END IF;

  -- 4. Calculate current active ordered books and enforce max_book_count
  SELECT COALESCE(SUM(boi.quantity), 0) INTO v_current_total
  FROM public.book_orders bo
  JOIN public.book_order_items boi ON bo.id = boi.book_order_id
  WHERE bo.subscription_order_id = p_subscription_order_id
    AND bo.order_status != '주문취소';

  IF v_current_total + v_total_requested > v_cycle.max_book_count THEN
    RAISE EXCEPTION '최대 %권까지만 주문 가능합니다.', v_cycle.max_book_count;
  END IF;

  -- 5. Prevent duplicate books across active orders
  FOR v_book_id IN SELECT unnest(p_book_ids)
  LOOP
    v_trimmed_book_id := trim(v_book_id);
    SELECT bo.id INTO v_existing_book
    FROM public.book_orders bo
    JOIN public.book_order_items boi ON bo.id = boi.book_order_id
    WHERE bo.subscription_order_id = p_subscription_order_id
      AND bo.order_status != '주문취소'
      AND boi.book_id = v_trimmed_book_id;

    IF FOUND THEN
      RAISE EXCEPTION '이미 신청한 도서가 포함되어 있습니다: %', v_trimmed_book_id;
    END IF;
  END LOOP;

  -- 6. Create book_order and items
  INSERT INTO public.book_orders (subscription_order_id, user_id, cycle_id, order_status)
  VALUES (p_subscription_order_id, v_order.user_id, v_cycle.id, '주문접수')
  RETURNING id INTO v_new_order_id;

  INSERT INTO public.book_order_items (book_order_id, book_id, book_title_snapshot, quantity)
  SELECT v_new_order_id, id, title, 1
  FROM public.books
  WHERE id = ANY(SELECT trim(b) FROM unnest(p_book_ids) b)
    AND cycle_id = v_cycle.id
    AND is_public = true
    AND is_orderable = true
    AND is_deleted = false;

  RETURN jsonb_build_object('success', true, 'book_order_id', v_new_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.place_book_order(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_book_order(uuid, text[]) TO service_role;
