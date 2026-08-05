create table if not exists public.insight_comments (
  id uuid primary key default gen_random_uuid(),

  post_id text not null,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  content text not null,

  created_at timestamptz not null
    default now(),

  constraint insight_comments_post_id_valid
    check (
      char_length(btrim(post_id)) between 1 and 200
      and post_id !~ '[[:cntrl:]]'
    ),

  constraint insight_comments_content_valid
    check (
      char_length(btrim(content)) between 1 and 500
    )
);

create index if not exists insight_comments_post_created_idx
  on public.insight_comments (
    post_id,
    created_at asc,
    id asc
  );

create index if not exists insight_comments_user_idx
  on public.insight_comments (user_id);

alter table public.insight_comments
  enable row level security;

revoke all on table public.insight_comments
  from public;

revoke all on table public.insight_comments
  from anon;

revoke all on table public.insight_comments
  from authenticated;

grant select, insert, delete
  on table public.insight_comments
  to service_role;
