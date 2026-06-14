# Insurgente Tap Pilot Checklist

Pour treats Poster as read-only. All barrel state, mappings, sync logs, and revenue calculations are stored only in Pour.

## Before Service

- Confirm production is deployed from the intended commit.
- Confirm Postgres is active, not SQLite.
- Confirm Poster account `624548` is connected.
- Run Sync Now.
- Confirm products, locations, employees, and transactions sync successfully.
- Configure eligible draft categories for mapping:
  - `DRAFT NACIONAL`
  - `DRAFT IMPORTADO`
- Insurgente eligible categories are `DRAFT NACIONAL` and `DRAFT IMPORTADO`.
- Confirm only draft candidates appear in Create Keg and barrel mapping selectors.

## Opening Barrels

- Create or confirm 15 local lines.
- Open real barrels only under the connected Poster merchant.
- Map sellable Poster variants, not parent products.
- Confirm each mapped product has `cup_ml`:
  - `PINTA`: 355ml
  - `JARRA`: 1000ml
  - `SAMPLER`: 150ml
- Confirm `Costo barril`, `Volumen inicial`, and `Abierto por` are persisted values.

## During Service

- Use Sync Now from the Ops tab after test sales.
- Confirm active barrel consumption changes only from matched Poster transactions.
- Confirm discounted/free valid sales count volume.
- Confirm refunded/voided sales do not count.
- Confirm revenue card shows:
  - Gross sales
  - Discounts
  - Net sales
  - Cost recovery
  - Units sold

## Closing Barrels

- Enter `merma_ml` as the liquid remaining in the keg.
- Confirm final yield before closing.
- Pour validates:
  - merma is non-negative
  - consumed plus merma does not exceed initial volume
  - gross minus discounts equals net revenue
  - closed-by is present
- After closing, confirm the line is available for a new barrel.

## After Service

- Review Barrel History.
- Investigate any `Revisar datos` warning.
- Confirm closed barrel history shows opened/closed dates, liters consumed, gross, discounts, net, yield, and merma.
- Do not use demo seed/reset commands on production data.
