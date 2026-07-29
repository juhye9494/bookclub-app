BEGIN;
-- 1. Create complimentary_member_access table
CREATE TABLE public.complimentary_member_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cycle_id TEXT NOT NULL REFERENCES public.cycles(id) ON DELETE RESTRICT,
  grant_reason VARCHAR(255),
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoke_reason VARCHAR(255),
  revoked_by UUID REFERENCES auth.users(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_comp_member_access_revoke CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL) OR
    (revoked_at IS NOT NULL AND revoked_by IS NOT NULL)
  )
);

-- 2. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_complimentary_member_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

REVOKE ALL ON FUNCTION public.set_complimentary_member_access_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trigger_complimentary_member_access_updated_at
BEFORE UPDATE ON public.complimentary_member_access
FOR EACH ROW
EXECUTE FUNCTION public.set_complimentary_member_access_updated_at();

-- 3. Indexes
CREATE UNIQUE INDEX idx_complimentary_member_access_active
ON public.complimentary_member_access (user_id, cycle_id)
WHERE revoked_at IS NULL;

-- 4. RLS Policy & Permissions
ALTER TABLE public.complimentary_member_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.complimentary_member_access FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.complimentary_member_access TO service_role;
COMMIT;