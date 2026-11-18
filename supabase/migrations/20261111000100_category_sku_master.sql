-- ShePlates Category-Wise SKU Master Migration
-- Creates product_categories, product_sku_groups, and product_skus
-- Fully idempotent with ON CONFLICT DO UPDATE

-- 1. Create tables
CREATE TABLE IF NOT EXISTS public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.product_sku_groups (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.product_categories(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint uq_sku_group_per_category unique(category_id, name)
);

CREATE TABLE IF NOT EXISTS public.product_skus (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_sku_groups(id) on delete cascade,
  pack_size text not null,
  unit_type text not null,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint uq_sku_per_group unique(group_id, pack_size)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sku_groups_category ON public.product_sku_groups(category_id, active);
CREATE INDEX IF NOT EXISTS idx_skus_group ON public.product_skus(group_id, active, display_order);

-- Link to vendor_menu_items
ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS sku_group_id uuid references public.product_sku_groups(id) on delete set null;
ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS sku_id uuid references public.product_skus(id) on delete set null;
ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS sku_group_name text;
ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS pack_size text;
ALTER TABLE public.vendor_menu_items ADD COLUMN IF NOT EXISTS unit_type text;

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sku_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_skus ENABLE ROW LEVEL SECURITY;

-- Read policies for all authenticated and anon users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'product_categories_read_all') THEN
    CREATE POLICY product_categories_read_all ON public.product_categories FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_sku_groups' AND policyname = 'product_sku_groups_read_all') THEN
    CREATE POLICY product_sku_groups_read_all ON public.product_sku_groups FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_skus' AND policyname = 'product_skus_read_all') THEN
    CREATE POLICY product_skus_read_all ON public.product_skus FOR SELECT USING (true);
  END IF;
END $$;

-- 2. Seed data
-- Seed Categories (11 categories)
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Milk & dairy', 1, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Home food', 2, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Caterer', 3, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Meat & fish', 4, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Vegetables', 5, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Groceries', 6, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Eggs', 7, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Bakery', 8, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Snacks', 9, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Rice & staples', 10, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;
INSERT INTO public.product_categories (name, display_order, active)
VALUES ('Other', 11, true)
ON CONFLICT (name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active;

-- Seed Product SKU Groups and SKUs
DO $$
DECLARE
  v_cat_id uuid;
  v_grp_id uuid;
BEGIN
  -- Category: Milk & dairy
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Milk & dairy';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Milk', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1.5 L', 'L', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 L', 'L', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 L', 'L', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Flavoured milk', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '180 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Curd', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Greek yogurt', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '400 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Buttermilk', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Lassi', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '180 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Paneer', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Butter', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Ghee', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cheese slices', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cheese block', 11, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cream', 12, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Milk powder', 13, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Home food
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Home food';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Idli', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '8 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Dosa', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Chapati', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '8 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Parotta', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Poori', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '8 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Pongal', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '300 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Upma', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '300 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Variety rice', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '300 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Meals', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Half portion', 'portion', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Full portion', 'portion', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Family pack (2 persons)', 'persons', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Family pack (4 persons)', 'persons', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Biryani', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '350 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '650 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1.5 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Curry / gravy', 11, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '30 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Chutney', 12, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '30 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Sambar', 13, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Combo meal', 14, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Single serving', 'portion', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2-person combo', 'persons', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3-person combo', 'persons', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4-person combo', 'persons', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Family combo (5 persons)', 'persons', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Caterer
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Caterer';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Breakfast package', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 person', 'persons', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 persons', 'persons', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 persons', 'persons', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 persons', 'persons', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 persons', 'persons', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 persons', 'persons', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 persons', 'persons', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 persons', 'persons', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Lunch package', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 person', 'persons', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 persons', 'persons', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 persons', 'persons', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 persons', 'persons', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 persons', 'persons', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 persons', 'persons', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 persons', 'persons', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 persons', 'persons', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Dinner package', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 person', 'persons', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 persons', 'persons', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 persons', 'persons', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 persons', 'persons', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 persons', 'persons', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 persons', 'persons', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 persons', 'persons', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 persons', 'persons', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Biryani bulk', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 kg', 'kg', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Rice bulk', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Snacks platter', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Sweets bulk', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Beverage dispenser', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 L', 'L', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 L', 'L', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 L', 'L', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 L', 'L', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 L', 'L', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Event package', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 persons', 'persons', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 persons', 'persons', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 persons', 'persons', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 persons', 'persons', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 persons', 'persons', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 persons', 'persons', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 persons', 'persons', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 persons', 'persons', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Meat & fish
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Meat & fish';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Chicken', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1.5 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Chicken boneless', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Mutton', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Fish (whole / cleaned)', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1.5 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Fish slices', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Prawns', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Crab', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Squid', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Duck', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1.5 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Egg (meat counter)', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '30 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Vegetables
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Vegetables';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Tomato', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Onion', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Potato', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Carrot', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Beans', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Brinjal', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cabbage', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cauliflower', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cucumber', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Leafy greens', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 bunch', 'bunch', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 bunches', 'bunch', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 bunches', 'bunch', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 bunches', 'bunch', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Coriander / mint', 11, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 bunch', 'bunch', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 bunches', 'bunch', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 bunches', 'bunch', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 bunches', 'bunch', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Green chilli', 12, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Lemon', 13, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Coconut', 14, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Mushroom', 15, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Garlic', 16, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Ginger', 17, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Groceries
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Groceries';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cooking oil', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 L', 'L', 11, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 L', 'L', 12, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 L', 'L', 13, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 L', 'L', 14, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Groundnut oil', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 L', 'L', 11, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 L', 'L', 12, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Coconut oil', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 L', 'L', 11, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 L', 'L', 12, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Toor dal', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Urad dal', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Moong dal', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Chana dal', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Rajma / chickpeas', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Sugar', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Salt', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Jaggery', 11, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Chilli powder', 12, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Turmeric powder', 13, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Coriander powder', 14, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Garam masala', 15, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Whole spices', 16, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Wheat flour / atta', 17, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Maida', 18, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Besan', 19, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Pickle', 20, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Honey', 21, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Sauce', 22, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Vinegar', 23, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Dry fruits', 24, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Nuts / seeds', 25, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Tea powder', 26, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Coffee powder', 27, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Instant mixes', 28, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Biscuits', 29, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pack', 'pack/set/loaf', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 packs', 'pack/set/loaf', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 packs', 'pack/set/loaf', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 packs', 'pack/set/loaf', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 packs', 'pack/set/loaf', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Noodles / pasta', 30, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '70 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '150 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Eggs
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Eggs';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Regular eggs', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 pcs', 'pcs', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '18 pcs', 'pcs', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '30 pcs', 'pcs', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Country eggs', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 pcs', 'pcs', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Quail eggs', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '30 pcs', 'pcs', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Egg tray', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '15 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '18 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '30 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Bakery
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Bakery';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Bread loaf', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 loaf', 'pack/set/loaf', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 loaves', 'pack/set/loaf', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 loaves', 'pack/set/loaf', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 loaves', 'pack/set/loaf', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cakes', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1.5 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2.5 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cupcakes', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '24 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Muffins', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Buns', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '8 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cookies', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Rusk', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Pastries', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '8 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Puffs', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Brownies', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '9 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Donuts', 11, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Snacks
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Snacks';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Mixture', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Murukku', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Chips', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Popcorn', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Samosa', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 pcs', 'pcs', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Bajji / pakoda', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Cutlet', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Vadai', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Traditional sweets', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Snack combo', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Small pack', 'pack/set/loaf', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Medium pack', 'pack/set/loaf', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Large pack', 'pack/set/loaf', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Family pack', 'pack/set/loaf', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Rice & staples
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Rice & staples';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Raw rice', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Boiled rice', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '25 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Idli rice', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Basmati rice', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Millets', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Ragi flour', 6, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Wheat', 7, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Rava / sooji', 8, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Poha / aval', 9, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Vermicelli', 10, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  -- Category: Other
  SELECT id INTO v_cat_id FROM public.product_categories WHERE name = 'Other';
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Liquid product', 1, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 ml', 'ml', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 ml', 'ml', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 ml', 'ml', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 ml', 'ml', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 ml', 'ml', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 ml', 'ml', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 ml', 'ml', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 ml', 'ml', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 ml', 'ml', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 L', 'L', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 L', 'L', 11, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 L', 'L', 12, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Powder / granular product', 2, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 g', 'g', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 g', 'g', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '50 g', 'g', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '75 g', 'g', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '100 g', 'g', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '200 g', 'g', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '250 g', 'g', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '500 g', 'g', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '750 g', 'g', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 kg', 'kg', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 kg', 'kg', 11, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 kg', 'kg', 12, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Piece-based product', 3, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pc', 'pcs', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 pcs', 'pcs', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 pcs', 'pcs', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '4 pcs', 'pcs', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 pcs', 'pcs', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '6 pcs', 'pcs', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 pcs', 'pcs', 7, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '12 pcs', 'pcs', 8, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 pcs', 'pcs', 9, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '30 pcs', 'pcs', 10, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Packaged product', 4, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '1 pack', 'pack/set/loaf', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '2 packs', 'pack/set/loaf', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '3 packs', 'pack/set/loaf', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '5 packs', 'pack/set/loaf', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '10 packs', 'pack/set/loaf', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, '20 packs', 'pack/set/loaf', 6, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_sku_groups (category_id, name, display_order, active)
  VALUES (v_cat_id, 'Set-based product', 5, true)
  ON CONFLICT (category_id, name) DO UPDATE SET display_order = EXCLUDED.display_order, active = EXCLUDED.active
  RETURNING id INTO v_grp_id;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Set of 1', 'pack/set/loaf', 1, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Set of 2', 'pack/set/loaf', 2, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Set of 3', 'pack/set/loaf', 3, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Set of 4', 'pack/set/loaf', 4, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
  INSERT INTO public.product_skus (group_id, pack_size, unit_type, display_order, active)
  VALUES (v_grp_id, 'Set of 5', 'pack/set/loaf', 5, true)
  ON CONFLICT (group_id, pack_size) DO UPDATE SET unit_type = EXCLUDED.unit_type, display_order = EXCLUDED.display_order, active = EXCLUDED.active;
END $$;
