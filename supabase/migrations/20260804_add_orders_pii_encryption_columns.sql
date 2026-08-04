-- public.orders 테이블 PII 암호화 지원 컬럼 추가
-- *_enc: AES-256-GCM 암호문 저장
-- *_hmac: 관리자 검색 및 정확 일치 확인을 위한 해시 저장
-- pii_key_version: 암호화 키 버전 관리
alter table public.orders
  add column if not exists user_name_enc text,
  add column if not exists user_email_enc text,
  add column if not exists user_phone_enc text,
  add column if not exists user_address_enc text,
  add column if not exists user_name_hmac text,
  add column if not exists user_email_hmac text,
  add column if not exists pii_key_version smallint;
