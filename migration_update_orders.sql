-- 1. 중복 데이터 조회 및 정리 가이드
-- 먼저 아래 쿼리로 중복 데이터를 확인하세요.
-- SELECT payment_order_id, COUNT(*) FROM public.orders GROUP BY payment_order_id HAVING COUNT(*) > 1;
-- SELECT payment_key, COUNT(*) FROM public.orders WHERE payment_key IS NOT NULL GROUP BY payment_key HAVING COUNT(*) > 1;
-- (중복된 데이터가 있다면 삭제하거나 임의의 값으로 수정해야 UNIQUE 제약 조건 추가가 가능합니다.)

-- 2. 새로운 컬럼 추가 (결제 상태, 테스트 여부, payment_key 등)
-- payment_key 컬럼이 없다면 추가합니다. (이미 있다면 건너뛰세요)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_key text;

-- payment_status 컬럼 추가 (PENDING, DONE, FAILED, CANCELED 등)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'PENDING';

-- is_test 컬럼 추가 (Preview 환경 등 테스트 결제 구분용)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;

-- 3. UNIQUE 제약 조건 추가
-- payment_order_id: NOT NULL 및 UNIQUE 설정
ALTER TABLE public.orders ALTER COLUMN payment_order_id SET NOT NULL;
ALTER TABLE public.orders ADD CONSTRAINT unique_payment_order_id UNIQUE (payment_order_id);

-- payment_key: 값이 있는 경우에만 UNIQUE 하도록 부분 인덱스(Partial Index) 생성
CREATE UNIQUE INDEX IF NOT EXISTS unique_payment_key ON public.orders (payment_key) WHERE payment_key IS NOT NULL;
