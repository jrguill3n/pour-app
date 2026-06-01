import { syncPosterCatalog } from "@/lib/pos/sync/poster";

const posAccountId = process.argv.find((arg) => arg.startsWith("--pos-account-id="))?.split("=")[1];

syncPosterCatalog({ posAccountId })
  .then((result) => {
    console.log("Poster manual sync complete:", result);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
