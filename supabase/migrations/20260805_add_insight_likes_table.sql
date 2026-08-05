create table if not exists public.insight_likes (
  post_id text not null,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null
    default now(),

  constraint insight_likes_pkey
    primary key (post_id, user_id),

  constraint insight_likes_post_id_valid
    check (
      char_length(btrim(post_id)) between 1 and 200
      and post_id !~ '[[:cntrl:]]'
    )
);

create index if not exists insight_likes_user_idx
  on public.insight_likes (user_id);

alter table public.insight_likes
  enable row level security;

revoke all on table public.insight_likes
  from public;

revoke all on table public.insight_likes
  from anon;

revoke all on table public.insight_likes
  from authenticated;

grant select, insert, delete
  on table public.insight_likes
  to service_role;
