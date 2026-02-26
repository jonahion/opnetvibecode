-- Run this in your Supabase SQL Editor to create the required tables.

-- Market questions: stores the question text for each market ID
create table if not exists market_questions (
    market_id bigint primary key,
    question text not null,
    created_at timestamptz default now()
);

-- Analytics cache: single-row cache with 4h TTL
create table if not exists analytics_cache (
    id int primary key default 1 check (id = 1),
    updated_at timestamptz default now(),
    markets jsonb not null default '[]'::jsonb
);

-- Insert the initial cache row
insert into analytics_cache (id, markets) values (1, '[]'::jsonb)
on conflict (id) do nothing;

-- Enable Row Level Security
alter table market_questions enable row level security;
alter table analytics_cache enable row level security;

-- Allow anyone to read market questions (public data)
create policy "Anyone can read market questions"
    on market_questions for select
    using (true);

-- Allow anyone to insert market questions (no auth needed for dApp)
create policy "Anyone can insert market questions"
    on market_questions for insert
    with check (true);

-- Allow upsert (update existing question)
create policy "Anyone can update market questions"
    on market_questions for update
    using (true);

-- Allow anyone to read analytics cache
create policy "Anyone can read analytics cache"
    on analytics_cache for select
    using (true);

-- Allow anyone to update analytics cache
create policy "Anyone can update analytics cache"
    on analytics_cache for update
    using (true);
