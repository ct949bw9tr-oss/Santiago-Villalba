create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  author_id uuid not null references users(id),
  subject_id uuid not null references users(id),
  direction text not null check (direction in ('customer_to_provider','provider_to_customer')),
  rating_overall smallint not null check (rating_overall between 1 and 5),
  rating_quality smallint check (rating_quality between 1 and 5),
  rating_punctuality smallint check (rating_punctuality between 1 and 5),
  rating_communication smallint check (rating_communication between 1 and 5),
  rating_professionalism smallint check (rating_professionalism between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (booking_id, author_id, direction)
);
create index idx_reviews_subject on reviews(subject_id);

create table favorites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references users(id) on delete cascade,
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (customer_id, provider_id)
);

create table recent_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  query text not null,
  category_id uuid references categories(id),
  created_at timestamptz not null default now()
);
create index idx_recent_searches_user on recent_searches(user_id, created_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  sender_id uuid references users(id), -- null = system message
  type text not null default 'text' check (type in ('text','image','system')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_messages_booking on messages(booking_id, created_at);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in (
    'new_request','request_accepted','request_declined','message_received','booking_reminder',
    'provider_arriving','task_completed','payment_processed','payout_sent','review_request','dispute_update'
  )),
  title text not null,
  body text not null,
  booking_id uuid references bookings(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, created_at desc);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  reported_user_id uuid references users(id),
  booking_id uuid references bookings(id),
  reason text not null check (reason in (
    'harassment','fraud','unsafe_behavior','inappropriate_service','payment_issue','no_show','other'
  )),
  description text not null,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  raised_by uuid not null references users(id),
  reason text not null,
  status text not null default 'open' check (status in ('open','investigating','resolved_refund','resolved_no_refund','closed')),
  resolution_notes text,
  resolved_by uuid references admin_users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index idx_disputes_booking on disputes(booking_id);
