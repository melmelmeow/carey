-- Run ONCE in Supabase: SQL Editor > New query > Run  (run setup.sql first if you haven't)

create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  about text not null default '',
  about_secondary text not null default '',
  skills text[] not null default '{}'
);
insert into public.site_settings (id, about, about_secondary, skills) values (
  1,
  'Hey! I''m Carey Dayrit — a passionate PHP programmer and WordPress developer who loves turning ideas into real, working websites. I thrive on solving problems and crafting clean, functional web experiences.',
  'Whether it''s a custom WordPress theme, a plugin from scratch, or a full PHP application — I''m ready to build it with you. Let''s grow together!',
  array['PHP','WordPress','MySQL','HTML / CSS','JavaScript','Deno / Node.js','Git & GitHub','REST APIs','Figma']
) on conflict (id) do nothing;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null, description text not null,
  stack text[] not null default '{}', year text, url text,
  created_at timestamptz not null default now()
);
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  title text not null, issuer text not null, year text, url text,
  created_at timestamptz not null default now()
);
create table if not exists public.cats (
  id uuid primary key default gen_random_uuid(),
  name text not null, caption text, path text not null, src text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security: everyone can READ, only a logged-in admin can WRITE
do $$ declare t text; begin
  foreach t in array array['site_settings','projects','certificates','cats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "public read" on public.%I', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists "admin write" on public.%I', t);
    execute format('create policy "admin write" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Let the admin delete spam from the guest log
drop policy if exists "admin delete guestbook" on public.guestbook;
create policy "admin delete guestbook" on public.guestbook for delete to authenticated using (true);

-- Public photo bucket for the cat gallery
insert into storage.buckets (id, name, public) values ('cats', 'cats', true) on conflict (id) do nothing;
drop policy if exists "public read cats" on storage.objects;
create policy "public read cats" on storage.objects for select to anon, authenticated using (bucket_id = 'cats');
drop policy if exists "admin upload cats" on storage.objects;
create policy "admin upload cats" on storage.objects for insert to authenticated with check (bucket_id = 'cats');
drop policy if exists "admin delete cats" on storage.objects;
create policy "admin delete cats" on storage.objects for delete to authenticated using (bucket_id = 'cats');
