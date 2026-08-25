import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Variables Supabase introuvables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BUCKET = "stick-photos";
const FOLDER = "sticks";

const { data: sticks, error: sticksError } = await supabase
  .from("sticks")
  .select("photo_path")
  .not("photo_path", "is", null);

if (sticksError) {
  throw sticksError;
}

const usedPaths = new Set(
  sticks
    .map((stick) => stick.photo_path)
    .filter(Boolean)
);

const { data: objects, error: storageError } = await supabase.storage
  .from(BUCKET)
  .list(FOLDER, {
    limit: 1000,
    sortBy: {
      column: "created_at",
      order: "desc",
    },
  });

if (storageError) {
  throw storageError;
}

const storagePaths = objects
  .filter((object) => object.name)
  .map((object) => `${FOLDER}/${object.name}`);

const orphanPaths = storagePaths.filter(
  (path) => !usedPaths.has(path)
);

console.log(`Photos dans Storage : ${storagePaths.length}`);
console.log(`Photos référencées par les sticks : ${usedPaths.size}`);
console.log(`Photos orphelines : ${orphanPaths.length}`);

if (orphanPaths.length === 0) {
  console.log("\nAucune photo orpheline.");
  process.exit(0);
}

console.log("\n=== PHOTOS ORPHELINES ===");

for (const path of orphanPaths) {
  console.log(path);
}
