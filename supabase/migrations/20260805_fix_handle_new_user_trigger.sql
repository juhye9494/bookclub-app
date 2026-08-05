-- profiles.email 컬럼 제거 후에도 기존 Auth 신규 가입 트리거가
-- 삭제된 email 컬럼에 INSERT를 시도하여 /auth/v1/signup이
-- SQLSTATE 42703 오류로 실패하던 문제를 수정한다.
--
-- 전화번호와 주소는 서버 API에서 암호화하여 저장하므로
-- Auth 트리거에서는 평문 phone/address를 저장하지 않는다.
--
-- has_paid는 사용자 metadata 값을 신뢰하지 않고 false로 생성한다.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (
    id,
    name,
    has_paid
  )
  values (
    new.id,
    nullif(
      btrim(coalesce(new.raw_user_meta_data ->> 'name', '')),
      ''
    ),
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;
