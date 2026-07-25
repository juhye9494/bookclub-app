BEGIN;

CREATE TABLE IF NOT EXISTS public.group_open_chat_links (
  group_id text PRIMARY KEY
    REFERENCES public.groups(id)
    ON DELETE CASCADE,
  open_chat_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_open_chat_links ENABLE ROW LEVEL SECURITY;

INSERT INTO public.group_open_chat_links (
  group_id,
  open_chat_url
)
SELECT
  id,
  BTRIM(open_chat_url)
FROM public.groups
WHERE open_chat_url IS NOT NULL
  AND BTRIM(open_chat_url) <> ''
ON CONFLICT (group_id)
DO UPDATE SET
  open_chat_url = EXCLUDED.open_chat_url,
  updated_at = now();

UPDATE public.groups
SET open_chat_url = NULL
WHERE open_chat_url IS NOT NULL;

COMMIT;
