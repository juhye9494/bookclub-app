-- orders 개인정보를 암호문만 저장할 수 있도록 기존 평문 컬럼의
-- NOT NULL 제약을 해제한다. 기존 데이터는 변경하지 않는다.
alter table public.orders
  alter column user_name drop not null,
  alter column user_email drop not null,
  alter column user_phone drop not null,
  alter column user_address drop not null;
