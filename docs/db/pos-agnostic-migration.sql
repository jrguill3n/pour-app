-- TODO: Apply this draft in the production migration system once one exists.
-- This repo does not currently include database migrations or a Supabase setup.
-- The statements below document the schema changes needed for POS-agnostic data.
-- Review table names and legacy column names before applying: current app code now
-- expects normalized account/product/location/barrel fields, while older schemas may
-- still use Poster-specific names such as poster_account_id or poster_spot_id.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS pos_provider text NOT NULL DEFAULT 'poster',
  ADD COLUMN IF NOT EXISTS pos_account_id text;

UPDATE public.accounts
SET pos_account_id = poster_account_id
WHERE pos_account_id IS NULL
  AND poster_account_id IS NOT NULL;

ALTER TABLE public.accounts
  ALTER COLUMN pos_account_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_pos_provider_pos_account_id_key
  ON public.accounts (pos_provider, pos_account_id);

-- TODO: If downstream tables still reference account_id instead of merchant_id,
-- rename or backfill those columns in the real migration before applying the
-- indexes below.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS merchant_id uuid,
  ADD COLUMN IF NOT EXISTS pos_provider text NOT NULL DEFAULT 'poster',
  ADD COLUMN IF NOT EXISTS external_product_id text;

UPDATE public.products
SET merchant_id = account_id
WHERE merchant_id IS NULL
  AND account_id IS NOT NULL;

UPDATE public.products
SET external_product_id = poster_product_id
WHERE external_product_id IS NULL
  AND poster_product_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS products_merchant_pos_external_product_key
  ON public.products (merchant_id, pos_provider, external_product_id);

-- TODO: If the deployed schema still has public.spots, migrate it to
-- public.locations or adapt this section to the real table name.
ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS merchant_id uuid,
  ADD COLUMN IF NOT EXISTS pos_provider text NOT NULL DEFAULT 'poster',
  ADD COLUMN IF NOT EXISTS external_location_id text;

UPDATE public.locations
SET merchant_id = account_id
WHERE merchant_id IS NULL
  AND account_id IS NOT NULL;

UPDATE public.locations
SET external_location_id = poster_spot_id
WHERE external_location_id IS NULL
  AND poster_spot_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS locations_merchant_pos_external_location_key
  ON public.locations (merchant_id, pos_provider, external_location_id);

ALTER TABLE public.barrels
  ADD COLUMN IF NOT EXISTS merchant_id uuid,
  ADD COLUMN IF NOT EXISTS pos_provider text NOT NULL DEFAULT 'poster',
  ADD COLUMN IF NOT EXISTS location_id uuid,
  ADD COLUMN IF NOT EXISTS external_product_ids text[];

UPDATE public.barrels
SET merchant_id = account_id
WHERE merchant_id IS NULL
  AND account_id IS NOT NULL;

UPDATE public.barrels
SET location_id = spot_id
WHERE location_id IS NULL
  AND spot_id IS NOT NULL;

UPDATE public.barrels
SET external_product_ids = product_ids
WHERE external_product_ids IS NULL
  AND product_ids IS NOT NULL;
