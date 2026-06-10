import { runManualPosSync } from "@/lib/pos/sync/manual";

const posAccountId = process.argv.find((arg) => arg.startsWith("--pos-account-id="))?.split("=")[1];
const from = process.argv.find((arg) => arg.startsWith("--from="))?.split("=")[1];
const to = process.argv.find((arg) => arg.startsWith("--to="))?.split("=")[1];

runManualPosSync({ provider: "poster", posAccountId, from, to })
  .then((result) => {
    console.log("Poster manual sync complete:", result);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
