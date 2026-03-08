-- Notifications table for in-app notification delivery
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  type text not null,  -- 'approval_submitted', 'approval_approved', 'approval_rejected'
  title text not null,
  message text,
  article_id uuid references articles(id) on delete cascade,
  read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user on notifications(user_id, read, created_at desc);
