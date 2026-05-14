-- 1. 주문(Orders) 테이블 생성
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  user_email text not null,
  user_name text not null,
  user_phone text not null,
  user_address text not null,
  selected_books jsonb not null, -- 선택한 4권의 도서 정보
  total_amount integer not null,
  order_status text default '배송준비중', -- '배송준비중', '배송중', '배송완료'
  payment_order_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 보안 정책(RLS) 설정
alter table public.orders enable row level security;

-- 고객은 자신의 주문 내역만 볼 수 있음
create policy "Users can view their own orders" 
on public.orders for select 
using (auth.uid() = user_id);

-- 누구나(인증된 사용자) 자신의 주문을 생성할 수 있음
create policy "Users can insert their own orders" 
on public.orders for insert 
with check (auth.uid() = user_id);

-- 관리자 정책
create policy "Admin has full access" 
on public.orders for all 
using (auth.jwt() ->> 'email' = 'juhye94@hankyung.com');
