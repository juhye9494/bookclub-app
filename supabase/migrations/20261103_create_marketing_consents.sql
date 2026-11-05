-- ==========================================================
-- 마케팅 수신 동의 및 이력 관리 테이블 생성 (보완 반영)
-- ==========================================================

-- 1. 마케팅 동의 상태 테이블
CREATE TABLE IF NOT EXISTS public.marketing_consents (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unanswered' CHECK (status IN ('unanswered', 'agreed', 'rejected', 'withdrawn')),
    privacy_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    email_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    sms_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    consent_version TEXT NOT NULL DEFAULT 'v1.0',
    consent_source TEXT NOT NULL DEFAULT 'signup' CHECK (consent_source IN ('signup', 'popup', 'consent_page', 'mypage', 'system')),
    consented_at TIMESTAMPTZ,
    last_confirmed_at TIMESTAMPTZ, -- 정보통신망법 제50조 제8항에 따른 최근 2년 주기 수신동의 확인 안내 발송일
    next_confirm_due TIMESTAMPTZ,  -- 다음 2년 주기 정기 확인 안내 예정일 (consented_at 또는 last_confirmed_at + 2년)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 마케팅 동의 변경/철회 이력 테이블
-- 보관 목적: 전자상거래법 제6조(표시·광고 및 분쟁처리) 및 개인정보보호법상 동의 사실 입증 책임 대비
-- 보관 원칙: 회원 ID(UUID) 외 직접적 개인식별정보(이름, 연락처 등)를 저장하지 않으며, 회원 탈퇴 시 더미 계정으로 분리 익명화 처리 후 3년 보관 뒤 파기
CREATE TABLE IF NOT EXISTS public.marketing_consent_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 회원 탈퇴 시 익명화/분리 보관 가능하도록 SET NULL 지원
    status TEXT NOT NULL CHECK (status IN ('unanswered', 'agreed', 'rejected', 'withdrawn')),
    privacy_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    email_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    sms_marketing_consent BOOLEAN NOT NULL DEFAULT false,
    action_type TEXT NOT NULL CHECK (action_type IN ('agree', 'update', 'reject', 'withdraw', 'periodic_notice')),
    consent_version TEXT NOT NULL DEFAULT 'v1.0',
    consent_source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_marketing_consents_status ON public.marketing_consents(status);
CREATE INDEX IF NOT EXISTS idx_marketing_consents_channels ON public.marketing_consents(privacy_marketing_consent, email_marketing_consent, sms_marketing_consent);
CREATE INDEX IF NOT EXISTS idx_marketing_consents_confirm_due ON public.marketing_consents(next_confirm_due) WHERE status = 'agreed';
CREATE INDEX IF NOT EXISTS idx_marketing_consent_history_user_id ON public.marketing_consent_history(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_consent_history_created_at ON public.marketing_consent_history(created_at DESC);

-- RLS 활성화
ALTER TABLE public.marketing_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_consent_history ENABLE ROW LEVEL SECURITY;

-- 1) marketing_consents RLS
DROP POLICY IF EXISTS "Users can view own marketing consent" ON public.marketing_consents;
CREATE POLICY "Users can view own marketing consent"
ON public.marketing_consents FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own marketing consent" ON public.marketing_consents;
CREATE POLICY "Users can update own marketing consent"
ON public.marketing_consents FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing consent" ON public.marketing_consents;
CREATE POLICY "Users can insert own marketing consent"
ON public.marketing_consents FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2) marketing_consent_history RLS
DROP POLICY IF EXISTS "Users can view own marketing consent history" ON public.marketing_consent_history;
CREATE POLICY "Users can view own marketing consent history"
ON public.marketing_consent_history FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own marketing consent history" ON public.marketing_consent_history;
CREATE POLICY "Users can insert own marketing consent history"
ON public.marketing_consent_history FOR INSERT
WITH CHECK (auth.uid() = user_id);
