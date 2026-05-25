import { neon } from '@neondatabase/serverless'
import { PosterAPI } from './poster-api'

const sql = neon(process.env.DATABASE_URL!)

export async function syncProducts(accountId: string, accessToken: string) {
  const api = new PosterAPI(accessToken)
  const products = await api.getProducts()

  for (const product of products) {
    await sql`
      INSERT INTO public.products (account_id, poster_product_id, name, description, price_cents)
      VALUES (${accountId}, ${product.id}, ${product.title}, ${product.description || null}, ${Math.round((product.price || 0) * 100)})
      ON CONFLICT (account_id, poster_product_id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        price_cents = EXCLUDED.price_cents,
        updated_at = CURRENT_TIMESTAMP
    `
  }

  await sql`
    UPDATE public.polling_logs
    SET last_polled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ${accountId} AND data_type = 'products'
  `
}

export async function syncEmployees(accountId: string, accessToken: string) {
  const api = new PosterAPI(accessToken)
  const employees = await api.getEmployees()

  for (const employee of employees) {
    await sql`
      INSERT INTO public.employees (account_id, poster_employee_id, name)
      VALUES (${accountId}, ${employee.id}, ${employee.name})
      ON CONFLICT (account_id, poster_employee_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
    `
  }

  await sql`
    UPDATE public.polling_logs
    SET last_polled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ${accountId} AND data_type = 'employees'
  `
}

export async function syncSpots(accountId: string, accessToken: string) {
  const api = new PosterAPI(accessToken)
  const spots = await api.getSpots()

  for (const spot of spots) {
    await sql`
      INSERT INTO public.spots (account_id, poster_spot_id, name)
      VALUES (${accountId}, ${spot.id}, ${spot.name})
      ON CONFLICT (account_id, poster_spot_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = CURRENT_TIMESTAMP
    `
  }

  await sql`
    UPDATE public.polling_logs
    SET last_polled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ${accountId} AND data_type = 'spots'
  `
}

export async function syncTransactions(accountId: string, accessToken: string, fromDate: Date) {
  const api = new PosterAPI(accessToken)
  const transactions = await api.getTransactions(fromDate)

  // Process transactions to update barrel revenue
  for (const txn of transactions) {
    // Find matching barrel by line_id or group_name
    const barrels = await sql`
      SELECT id FROM public.barrels
      WHERE account_id = ${accountId} AND status = 'open'
      LIMIT 1
    `

    if (barrels.length > 0) {
      const barrelsArray = Array.isArray(barrels) ? barrels : [barrels]
      const barrel = barrelsArray[0]
      const amountCents = Math.round((txn.sum || 0) * 100)

      await sql`
        UPDATE public.barrels
        SET 
          revenue_bruto_cents = revenue_bruto_cents + ${amountCents},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${barrel.id}
      `
    }
  }

  await sql`
    UPDATE public.polling_logs
    SET last_polled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE account_id = ${accountId} AND data_type = 'transactions'
  `
}

export async function initializePollingLogs(accountId: string) {
  const dataTypes = ['products', 'employees', 'spots', 'transactions']

  for (const dataType of dataTypes) {
    await sql`
      INSERT INTO public.polling_logs (account_id, data_type, last_polled_at)
      VALUES (${accountId}, ${dataType}, NULL)
      ON CONFLICT (account_id, data_type) DO NOTHING
    `
  }
}
