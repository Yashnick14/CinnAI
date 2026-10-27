import { writeFileSync } from "node:fs";
const projectId = process.argv[2];
if (
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    projectId ?? "",
  )
) {
  console.error("Usage: npm run eas:link -- <actual Expo project UUID>");
  process.exit(1);
}
writeFileSync(
  new URL("../eas-project.json", import.meta.url),
  JSON.stringify({ projectId }, null, 2) + "\n",
);
console.log("EAS project ID saved. Run npx expo config to verify.");
