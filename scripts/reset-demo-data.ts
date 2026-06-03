import { dirname } from "node:path";
import { mkdirSync } from "node:fs";
import Database from "better-sqlite3";

const sqliteUrl = process.env.SQLITE_DATABASE_URL ?? "file:./data/dev.db";
const sqlitePath = sqliteUrl.startsWith("file:") ? sqliteUrl.slice("file:".length) : sqliteUrl;
const demoMerchantId = "mock-merchant";
const demoProvider = "mock";
const demoEmail = "demo@pour.local";

mkdirSync(dirname(sqlitePath), { recursive: true });

const db = new Database(sqlitePath);

const deleted = db.transaction(() => {
  const counts = {
    pollingLogs: db
      .prepare("delete from polling_logs where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    normalizedSales: db
      .prepare("delete from normalized_sales where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    barrels: db
      .prepare("delete from barrels where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    lines: db
      .prepare("delete from lines where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    employees: db
      .prepare("delete from employees where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    productCategories: db
      .prepare("delete from pos_product_categories where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    products: db
      .prepare("delete from products where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    locations: db
      .prepare("delete from locations where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    accounts: db
      .prepare("delete from accounts where merchant_id = ? or pos_provider = ?")
      .run(demoMerchantId, demoProvider).changes,
    users: db.prepare("delete from users where email = ?").run(demoEmail).changes,
  };

  return counts;
})();

console.log("Reset local demo data only.", {
  database: sqlitePath,
  demoMerchantId,
  demoProvider,
  deleted,
});
