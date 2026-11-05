-- 독립 실행 가능: 최초 설치 또는 ZIP 원본 스키마에 대한 보완.
-- 기존 회원/주문/결제/프로필 데이터는 변경하지 않습니다.
-- 기존 마케팅 이력을 소급 생성하거나 삭제하지 않습니다.
BEGIN;

CREATE TABLE IF NOT EXISTS public.marketing_consents (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'unanswered' CHECK (status IN ('unanswered','agreed','rejected','withdrawn')),
  privacy_marketing_consent boolean NOT NULL DEFAULT false,
  email_marketing_consent boolean NOT NULL DEFAULT false,
  sms_marketing_consent boolean NOT NULL DEFAULT false,
  consent_version text NOT NULL DEFAULT 'v1.0',
  consent_source text NOT NULL DEFAULT 'signup' CHECK (consent_source IN ('signup','popup','consent_page','mypage','system')),
  consented_at timestamptz,
  last_confirmed_at timestamptz,
  next_confirm_due timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.marketing_consent_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('unanswered','agreed','rejected','withdrawn')),
  privacy_marketing_consent boolean NOT NULL DEFAULT false,
  email_marketing_consent boolean NOT NULL DEFAULT false,
  sms_marketing_consent boolean NOT NULL DEFAULT false,
  action_type text NOT NULL CHECK (action_type IN ('agree','update','reject','withdraw','periodic_notice')),
  consent_version text NOT NULL DEFAULT 'v1.0',
  consent_source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- IF NOT EXISTS만으로 다른 스키마를 정상으로 간주하지 않습니다.
DO $$
DECLARE expected record;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('marketing_consents','user_id','uuid'),
    ('marketing_consents','status','text'),
    ('marketing_consents','privacy_marketing_consent','boolean'),
    ('marketing_consents','email_marketing_consent','boolean'),
    ('marketing_consents','sms_marketing_consent','boolean'),
    ('marketing_consents','consent_version','text'),
    ('marketing_consents','consent_source','text'),
    ('marketing_consents','consented_at','timestamp with time zone'),
    ('marketing_consents','last_confirmed_at','timestamp with time zone'),
    ('marketing_consents','next_confirm_due','timestamp with time zone'),
    ('marketing_consents','created_at','timestamp with time zone'),
    ('marketing_consents','updated_at','timestamp with time zone'),
    ('marketing_consent_history','id','uuid'),
    ('marketing_consent_history','user_id','uuid'),
    ('marketing_consent_history','status','text'),
    ('marketing_consent_history','privacy_marketing_consent','boolean'),
    ('marketing_consent_history','email_marketing_consent','boolean'),
    ('marketing_consent_history','sms_marketing_consent','boolean'),
    ('marketing_consent_history','action_type','text'),
    ('marketing_consent_history','consent_version','text'),
    ('marketing_consent_history','consent_source','text'),
    ('marketing_consent_history','created_at','timestamp with time zone')
  ) AS cols(table_name,column_name,data_type)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=expected.table_name
        AND c.column_name=expected.column_name AND c.data_type=expected.data_type
    ) THEN
      RAISE EXCEPTION 'Marketing schema mismatch: %.%. Stop without resetting the database.', expected.table_name, expected.column_name;
    END IF;
  END LOOP;
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint c
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attname='user_id'
    WHERE c.conrelid='public.marketing_consents'::regclass AND c.contype='p'
      AND c.conkey=ARRAY[a.attnum]::smallint[]
  ) THEN RAISE EXCEPTION 'marketing_consents.user_id must be the primary key'; END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketing_consents_confirm_due
  ON public.marketing_consents(next_confirm_due) WHERE status='agreed';
CREATE INDEX IF NOT EXISTS idx_marketing_consent_history_user_created
  ON public.marketing_consent_history(user_id,created_at DESC,id DESC);

-- 클라이언트는 본인 기록 조회만 허용합니다. 저장은 인증된 서버 API만 수행합니다.
-- 기존 관리자 이메일 허용 목록은 서버의 getUser + isAdmin 판정을 그대로 사용합니다.
ALTER TABLE public.marketing_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_consent_history ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname,tablename,policyname FROM pg_catalog.pg_policies
    WHERE schemaname='public' AND tablename IN ('marketing_consents','marketing_consent_history')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I',p.policyname,p.schemaname,p.tablename);
  END LOOP;
END $$;
REVOKE ALL ON TABLE public.marketing_consents, public.marketing_consent_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.marketing_consents, public.marketing_consent_history TO authenticated;
GRANT ALL ON TABLE public.marketing_consents, public.marketing_consent_history TO service_role;
CREATE POLICY marketing_consent_own_read ON public.marketing_consents
  FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);
CREATE POLICY marketing_consent_history_own_read ON public.marketing_consent_history
  FOR SELECT TO authenticated USING ((SELECT auth.uid())=user_id);

-- 기존 별도 이력 트리거가 있으면 이중 기록을 만들지 않고 먼저 중단합니다.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
    WHERE tgrelid='public.marketing_consents'::regclass AND NOT tgisinternal
      AND tgname NOT IN ('marketing_consent_prepare','marketing_consent_audit')
  ) THEN RAISE EXCEPTION 'Unexpected marketing consent trigger: inspect it before applying this migration'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prepare_marketing_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  same_choices boolean := false;
  had_channel boolean := false;
BEGIN
  IF TG_OP='UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change the consent owner';
  END IF;
  IF NEW.status IS NULL OR NEW.status NOT IN ('unanswered','agreed','rejected','withdrawn')
    OR NEW.consent_source IS NULL OR NEW.consent_source NOT IN ('signup','popup','consent_page','mypage','system')
    OR NEW.consent_version IS NULL OR length(NEW.consent_version)=0
    OR NEW.privacy_marketing_consent IS NULL OR NEW.email_marketing_consent IS NULL OR NEW.sms_marketing_consent IS NULL
  THEN RAISE EXCEPTION 'Invalid marketing consent'; END IF;
  IF (NEW.email_marketing_consent OR NEW.sms_marketing_consent) AND NOT NEW.privacy_marketing_consent THEN
    RAISE EXCEPTION 'Marketing privacy consent is required for either channel';
  END IF;
  IF NEW.status IN ('unanswered','rejected','withdrawn') AND
    (NEW.privacy_marketing_consent OR NEW.email_marketing_consent OR NEW.sms_marketing_consent)
  THEN RAISE EXCEPTION 'Non-consenting status cannot have active consent flags'; END IF;
  IF NEW.status='agreed' AND NOT NEW.privacy_marketing_consent THEN
    RAISE EXCEPTION 'Agreed status requires marketing privacy consent';
  END IF;
  IF TG_OP='UPDATE' THEN
    -- 모든 항목 OFF는 기존 동의가 있으면 철회로 처리합니다.
    IF NEW.status='rejected' AND OLD.status IN ('agreed','withdrawn') THEN NEW.status:='withdrawn'; END IF;
    IF NEW.status='unanswered' AND OLD.status<>'unanswered' THEN
      RAISE EXCEPTION 'An explicit decision cannot be reset to unanswered';
    END IF;
    NEW.created_at:=OLD.created_at;
    same_choices := ROW(NEW.status,NEW.privacy_marketing_consent,NEW.email_marketing_consent,NEW.sms_marketing_consent,NEW.consent_version)
      IS NOT DISTINCT FROM ROW(OLD.status,OLD.privacy_marketing_consent,OLD.email_marketing_consent,OLD.sms_marketing_consent,OLD.consent_version);
    IF same_choices THEN
      NEW.consent_source:=OLD.consent_source;
      NEW.consented_at:=OLD.consented_at;
      NEW.next_confirm_due:=OLD.next_confirm_due;
      NEW.last_confirmed_at:=OLD.last_confirmed_at;
      NEW.updated_at:=OLD.updated_at;
      RETURN NEW;
    END IF;
    had_channel:=OLD.status='agreed' AND OLD.privacy_marketing_consent AND (OLD.email_marketing_consent OR OLD.sms_marketing_consent);
  ELSE
    NEW.created_at:=now();
  END IF;
  NEW.updated_at:=now();
  IF NEW.status='agreed' THEN
    IF TG_OP='UPDATE' AND OLD.status='agreed' THEN NEW.consented_at:=OLD.consented_at;
    ELSE NEW.consented_at:=now(); END IF;
    IF NEW.email_marketing_consent OR NEW.sms_marketing_consent THEN
      IF TG_OP='UPDATE' AND had_channel THEN
        -- 채널 변경 때마다 정기 안내 기한을 뒤로 미루지 않습니다.
        NEW.next_confirm_due:=COALESCE(OLD.next_confirm_due,OLD.consented_at + interval '2 years',now());
        NEW.last_confirmed_at:=OLD.last_confirmed_at;
      ELSE
        NEW.next_confirm_due:=now() + interval '2 years';
        NEW.last_confirmed_at:=NULL;
      END IF;
    ELSE
      NEW.next_confirm_due:=NULL;
      NEW.last_confirmed_at:=NULL;
    END IF;
  ELSE
    NEW.consented_at:=NULL;
    NEW.next_confirm_due:=NULL;
    NEW.last_confirmed_at:=NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.audit_marketing_consent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE action text;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.status,NEW.privacy_marketing_consent,NEW.email_marketing_consent,NEW.sms_marketing_consent,NEW.consent_version)
      IS NOT DISTINCT FROM ROW(OLD.status,OLD.privacy_marketing_consent,OLD.email_marketing_consent,OLD.sms_marketing_consent,OLD.consent_version)
    THEN RETURN NEW; END IF;
  ELSIF NEW.status='unanswered' THEN
    -- 미응답을 동의·거부의 증거로 기록하지 않습니다.
    RETURN NEW;
  END IF;
  IF NEW.status='withdrawn' THEN action:='withdraw';
  ELSIF NEW.status='rejected' THEN action:='reject';
  ELSIF TG_OP='INSERT' THEN action:='agree';
  ELSIF OLD.status<>'agreed' THEN action:='agree';
  ELSE action:='update'; END IF;
  INSERT INTO public.marketing_consent_history (
    user_id,status,privacy_marketing_consent,email_marketing_consent,sms_marketing_consent,
    action_type,consent_version,consent_source,created_at
  ) VALUES (
    NEW.user_id,NEW.status,NEW.privacy_marketing_consent,NEW.email_marketing_consent,NEW.sms_marketing_consent,
    action,NEW.consent_version,NEW.consent_source,NEW.updated_at
  );
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.prepare_marketing_consent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_marketing_consent() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS marketing_consent_prepare ON public.marketing_consents;
CREATE TRIGGER marketing_consent_prepare BEFORE INSERT OR UPDATE ON public.marketing_consents
  FOR EACH ROW EXECUTE FUNCTION public.prepare_marketing_consent();
DROP TRIGGER IF EXISTS marketing_consent_audit ON public.marketing_consents;
CREATE TRIGGER marketing_consent_audit AFTER INSERT OR UPDATE ON public.marketing_consents
  FOR EACH ROW EXECUTE FUNCTION public.audit_marketing_consent();

-- 이 파일은 보관기간을 확정하거나 2년 주기 안내를 발송하는 작업이 아닙니다.
-- 안내를 실제 발송하기 전에는 last_confirmed_at을 갱신하지 않습니다.
NOTIFY pgrst, 'reload schema';
COMMIT;
