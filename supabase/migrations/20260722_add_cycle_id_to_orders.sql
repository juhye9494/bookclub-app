ALTER TABLE orders ADD COLUMN IF NOT EXISTS cycle_id TEXT;

-- 기존 실제 결제 완료된 주문을 현재 활성 기수와 연결하는 일회성 보정 쿼리
-- (현재 status='active' 인 최신 기수의 id를 찾아 기존 주문에 일괄 업데이트)
UPDATE orders 
SET cycle_id = (
  SELECT id 
  FROM cycles 
  WHERE status = 'active' 
  ORDER BY start_date DESC 
  LIMIT 1
) 
WHERE cycle_id IS NULL AND payment_status = 'DONE';
