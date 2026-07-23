-- MIGRATION: Idempotent & Safe Data Migration of selected_books to book_orders
DO $$
DECLARE
  v_order RECORD;
  v_new_book_order_id UUID;
  v_book JSONB;
  v_order_status TEXT;
  v_has_error BOOLEAN;
  v_book_count INTEGER;
  v_unique_book_count INTEGER;
  v_max_book_count INTEGER;
BEGIN
  FOR v_order IN 
    SELECT o.*, c.max_book_count 
    FROM public.orders o
    JOIN public.cycles c ON o.cycle_id = c.id
    WHERE o.payment_status = 'DONE' 
      AND o.selected_books IS NOT NULL 
  LOOP
    v_has_error := false;
    v_max_book_count := v_order.max_book_count;

    -- 1. Validation Checks
    -- Check if it's a valid JSON array
    IF jsonb_typeof(v_order.selected_books) != 'array' THEN
      RAISE NOTICE 'SKIPPED Order %: selected_books is not a JSON array', v_order.id;
      CONTINUE;
    END IF;
    
    v_book_count := jsonb_array_length(v_order.selected_books);
    
    -- Check length 1~max_book_count
    IF v_book_count = 0 OR v_book_count > v_max_book_count THEN
      RAISE NOTICE 'SKIPPED Order %: Invalid book count (%) vs max (%)', v_order.id, v_book_count, v_max_book_count;
      CONTINUE;
    END IF;

    -- Check required keys (id, title) and check duplicates
    v_unique_book_count := (
      SELECT count(DISTINCT b->>'id') 
      FROM jsonb_array_elements(v_order.selected_books) b
      WHERE b->>'id' IS NOT NULL AND b->>'title' IS NOT NULL
    );

    IF v_unique_book_count != v_book_count THEN
      RAISE NOTICE 'SKIPPED Order %: Missing id/title or duplicate book found', v_order.id;
      CONTINUE;
    END IF;

    IF v_order.cycle_id IS NULL OR v_order.user_id IS NULL THEN
      RAISE NOTICE 'SKIPPED Order %: Missing cycle_id or user_id', v_order.id;
      CONTINUE;
    END IF;

    -- 2. Execution
    -- Only proceed if legacy_source_order_id is not already processed
    IF NOT EXISTS (SELECT 1 FROM public.book_orders WHERE legacy_source_order_id = v_order.id) THEN
      
      v_order_status := CASE v_order.order_status
        WHEN '배송준비중' THEN '배송준비중'
        WHEN '배송중' THEN '배송중'
        WHEN '배송완료' THEN '배송완료'
        WHEN '주문취소' THEN '주문취소'
        ELSE '주문접수'
      END;

      BEGIN
        INSERT INTO public.book_orders (subscription_order_id, user_id, cycle_id, order_status, legacy_source_order_id, created_at, updated_at)
        VALUES (v_order.id, v_order.user_id, v_order.cycle_id, v_order_status, v_order.id, v_order.created_at, v_order.created_at)
        RETURNING id INTO v_new_book_order_id;
        
        FOR v_book IN SELECT * FROM jsonb_array_elements(v_order.selected_books)
        LOOP
          INSERT INTO public.book_order_items (book_order_id, book_id, book_title_snapshot, quantity, created_at)
          VALUES (
            v_new_book_order_id, 
            v_book->>'id',
            v_book->>'title',
            1,
            v_order.created_at
          );
        END LOOP;
        
        RAISE NOTICE 'SUCCESS Order %: Migrated % books', v_order.id, v_book_count;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'SKIPPED Order %: DB Error during insertion - %', v_order.id, SQLERRM;
      END;
    ELSE
      RAISE NOTICE 'SKIPPED Order %: Already migrated', v_order.id;
    END IF;
  END LOOP;
END;
$$;
