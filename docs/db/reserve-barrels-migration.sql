-- Reserve barrels require local Pour barrel rows that are not assigned to a tap line yet.
-- Run against production Postgres before enabling reserve creation if the schema was created
-- before this feature. This does not write to Poster.

alter table if exists public.barrels
  alter column line_id drop not null;

alter table if exists public.barrels
  alter column opened_at drop not null;

-- Optional sanity check:
-- select status, count(*) from public.barrels group by status order by status;
