-- Automatic product images: a library of AI-drawn pictures, one per kind of product, and a note of where each product's picture came from.
--
-- Additive and safe to re-run. Nothing here changes an existing product or picture.
-- ai_product_images has row level security on and NO policies, so only the server (service role) can read or write it.
-- It also acts as the spending guard: the app counts today's rows to enforce AI_IMAGE_DAILY_LIMIT and AI_IMAGE_VENDOR_DAILY_LIMIT.

create table if not exists public.ai_product_images (
  concept_key text primary key,
  url text not null,
  prompt text not null default '',
  model text not null default '',
  created_by_vendor uuid references public.vendors(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ai_product_images_created_idx on public.ai_product_images(created_at desc);
create index if not exists ai_product_images_vendor_idx on public.ai_product_images(created_by_vendor, created_at desc);
alter table public.ai_product_images enable row level security;

-- Where a product's picture came from: 'vendor' (uploaded), 'ai' (drawn automatically), 'illustration' (category tile). Null = unknown.
alter table public.vendor_menu_items add column if not exists image_source text check (image_source in ('vendor', 'ai', 'illustration'));
