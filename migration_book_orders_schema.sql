BEGIN;

-- 1. Check for existing objects (Abort if they exist)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_orders') THEN
    RAISE EXCEPTION 'public.book_orders 테이블이 이미 존재합니다. 스크립트 실행을 중단합니다.';
  END IF;
  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'book_order_items') THEN
    RAISE EXCEPTION 'public.book_order_items 테이블이 이미 존재합니다. 스크립트 실행을 중단합니다.';
  END IF;

  IF EXISTS (SELECT FROM pg_proc JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public' AND pg_proc.proname = 'place_book_order') THEN
    RAISE EXCEPTION 'public.place_book_order 함수가 이미 존재합니다. 스크립트 실행을 중단합니다.';
  END IF;
END $$;

-- 2. Modify cycles table for multi-cycle support
DO $$ 
BEGIN
  -- Add columns if they do not exist
  BEGIN ALTER TABLE public.cycles ADD COLUMN name TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN subscription_start_date TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN subscription_end_date TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN book_order_start_date TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN book_order_end_date TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN shipping_start_date TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN operation_end_date TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN max_book_count INTEGER DEFAULT 4; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.cycles ADD COLUMN status TEXT DEFAULT 'active'; EXCEPTION WHEN duplicate_column THEN END;
END $$;

-- Update existing cycle-2026-h1 with required data using label for name
UPDATE public.cycles SET
  name = COALESCE(NULLIF(TRIM(label), ''), '독클럽 시즌1'),
  subscription_start_date = '2026-07-22 00:00:00+09',
  subscription_end_date = '2026-08-31 23:59:59+09',
  book_order_start_date = '2026-07-22 00:00:00+09',
  book_order_end_date = '2026-11-30 23:59:59+09',
  shipping_start_date = '2026-09-01 00:00:00+09',
  operation_end_date = '2026-11-30 23:59:59+09',
  max_book_count = 4,
  status = 'active'
WHERE id = 'cycle-2026-h1';

-- Pre-verify that no existing row has NULL in these new columns
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT count(*) INTO v_null_count FROM public.cycles WHERE
    name IS NULL OR
    subscription_start_date IS NULL OR
    subscription_end_date IS NULL OR
    book_order_start_date IS NULL OR
    book_order_end_date IS NULL OR
    shipping_start_date IS NULL OR
    operation_end_date IS NULL OR
    max_book_count IS NULL OR
    status IS NULL;
    
  IF v_null_count > 0 THEN
    RAISE EXCEPTION 'cycles 테이블에 필수값이 누락된 행이 %개 있습니다. NULL 값을 정리한 후 다시 시도하세요.', v_null_count;
  END IF;
END $$;

-- Enforce constraints
ALTER TABLE public.cycles ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN subscription_start_date SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN subscription_end_date SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN book_order_start_date SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN book_order_end_date SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN shipping_start_date SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN operation_end_date SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN max_book_count SET NOT NULL;
ALTER TABLE public.cycles ALTER COLUMN status SET NOT NULL;

-- Add CHECK constraints
DO $$
BEGIN
  ALTER TABLE public.cycles ADD CONSTRAINT chk_cycles_status CHECK (status IN ('upcoming', 'active', 'closed'));
EXCEPTION WHEN duplicate_object THEN END;
$$;

DO $$
BEGIN
  ALTER TABLE public.cycles ADD CONSTRAINT chk_cycles_max_book CHECK (max_book_count > 0);
EXCEPTION WHEN duplicate_object THEN END;
$$;

DO $$
BEGIN
  ALTER TABLE public.cycles ADD CONSTRAINT chk_cycles_subscription_period CHECK (subscription_start_date < subscription_end_date);
EXCEPTION WHEN duplicate_object THEN END;
$$;

DO $$
BEGIN
  ALTER TABLE public.cycles ADD CONSTRAINT chk_cycles_book_order_period CHECK (book_order_start_date < book_order_end_date);
EXCEPTION WHEN duplicate_object THEN END;
$$;

DO $$
BEGIN
  ALTER TABLE public.cycles ADD CONSTRAINT chk_cycles_shipping_period CHECK (shipping_start_date <= operation_end_date);
EXCEPTION WHEN duplicate_object THEN END;
$$;

DO $$
BEGIN
  ALTER TABLE public.cycles ADD CONSTRAINT chk_cycles_operation_period CHECK (book_order_end_date <= operation_end_date);
EXCEPTION WHEN duplicate_object THEN END;
$$;

-- 3. orders table enhancements (fk and unique index)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_cycle_id'
  ) THEN
    ALTER TABLE public.orders 
    ADD CONSTRAINT fk_orders_cycle_id FOREIGN KEY (cycle_id) REFERENCES public.cycles(id) ON DELETE RESTRICT;
  END IF;
END $$;

DROP INDEX IF EXISTS uq_orders_user_cycle_done;
CREATE UNIQUE INDEX uq_orders_user_cycle_done ON public.orders(user_id, cycle_id)
WHERE payment_status = 'DONE' AND cycle_id IS NOT NULL;

-- 4. Create book_orders and book_order_items tables
CREATE TABLE public.book_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  cycle_id TEXT NOT NULL REFERENCES public.cycles(id) ON DELETE RESTRICT,
  order_status TEXT NOT NULL DEFAULT '주문접수' CHECK (order_status IN ('주문접수', '배송준비중', '배송중', '배송완료', '주문취소')),
  legacy_source_order_id UUID UNIQUE REFERENCES public.orders(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.book_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  book_order_id UUID NOT NULL REFERENCES public.book_orders(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL REFERENCES public.books(id) ON DELETE RESTRICT,
  book_title_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(book_order_id, book_id)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_book_orders_sub_order ON public.book_orders(subscription_order_id);
CREATE INDEX IF NOT EXISTS idx_book_orders_user_cycle ON public.book_orders(user_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_book_orders_status ON public.book_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_book_order_items_order_id ON public.book_order_items(book_order_id);
CREATE INDEX IF NOT EXISTS idx_book_order_items_book_id ON public.book_order_items(book_id);

-- 5. Add book availability columns if not exists and cycle_id enforcement
DO $$ 
BEGIN
  BEGIN ALTER TABLE public.books ADD COLUMN is_public BOOLEAN DEFAULT true NOT NULL; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.books ADD COLUMN is_orderable BOOLEAN DEFAULT true NOT NULL; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.books ADD COLUMN is_deleted BOOLEAN DEFAULT false NOT NULL; EXCEPTION WHEN duplicate_column THEN END;
END $$;

ALTER TABLE public.books ALTER COLUMN is_public SET DEFAULT true;
ALTER TABLE public.books ALTER COLUMN is_orderable SET DEFAULT true;
ALTER TABLE public.books ALTER COLUMN is_deleted SET DEFAULT false;

UPDATE public.books SET is_public = true WHERE is_public IS NULL;
UPDATE public.books SET is_orderable = true WHERE is_orderable IS NULL;
UPDATE public.books SET is_deleted = false WHERE is_deleted IS NULL;

ALTER TABLE public.books ALTER COLUMN is_public SET NOT NULL;
ALTER TABLE public.books ALTER COLUMN is_orderable SET NOT NULL;
ALTER TABLE public.books ALTER COLUMN is_deleted SET NOT NULL;

-- Enforce cycle_id NOT NULL for books
ALTER TABLE public.books ALTER COLUMN cycle_id SET NOT NULL;

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_book_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_book_orders_updated_at ON public.book_orders;
CREATE TRIGGER trigger_book_orders_updated_at
BEFORE UPDATE ON public.book_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_book_orders_updated_at();

-- 7. RLS & Security
ALTER TABLE public.book_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own book orders" ON public.book_orders;
CREATE POLICY "Users can view their own book orders"
ON public.book_orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own book order items" ON public.book_order_items;
CREATE POLICY "Users can view their own book order items"
ON public.book_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.book_orders bo WHERE bo.id = book_order_items.book_order_id AND bo.user_id = auth.uid())
);

-- 8. Atomic RPC (PostgreSQL Function)
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

  IF NOW() < v_cycle.book_order_start_date OR NOW() > v_cycle.book_order_end_date THEN
    RAISE EXCEPTION '도서 주문 기간이 아닙니다.';
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

  -- 5. Check duplicates across all active orders
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
      RAISE EXCEPTION '이미 주문하신 도서가 포함되어 있습니다.';
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

-- Restrict execution to Service Role only
REVOKE ALL ON FUNCTION public.place_book_order(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.place_book_order(UUID, TEXT[]) FROM anon;
REVOKE ALL ON FUNCTION public.place_book_order(UUID, TEXT[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.place_book_order(UUID, TEXT[]) TO service_role;

COMMIT;
