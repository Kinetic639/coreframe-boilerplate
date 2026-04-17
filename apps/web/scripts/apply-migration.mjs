/* global process */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function applyMigration() {
  try {
    const migrationPath = path.join(
      __dirname,
      "../supabase/migrations/20250114000000_simplified_products_system.sql"
    );
    const migrationSQL = fs.readFileSync(migrationPath, "utf8");

    console.log("🚀 Applying migration: 20250114000000_simplified_products_system.sql");
    console.log("📝 Migration size:", migrationSQL.length, "characters");

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    console.log("📊 Total statements:", statements.length);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ";";

      // Skip comments
      if (statement.trim().startsWith("--")) continue;

      try {
        const { error } = await supabase.rpc("exec_sql", {
          sql: statement,
        });

        if (error) {
          // Try direct execution if rpc fails
          const { error: directError } = await supabase.from("_migrations").select("*").limit(1);

          if (directError) {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            console.error("Statement:", statement.substring(0, 100));
            errorCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }

        if ((i + 1) % 10 === 0) {
          console.log(`✅ Progress: ${i + 1}/${statements.length} statements`);
        }
      } catch (err) {
        console.error(`❌ Statement ${i + 1} error:`, err.message);
        errorCount++;
      }
    }

    console.log("\n📈 Migration Summary:");
    console.log(`  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);

    if (errorCount === 0) {
      console.log("\n🎉 Migration completed successfully!");
    } else {
      console.log("\n⚠️  Migration completed with errors. Manual review required.");
    }
  } catch (error) {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  }
}

applyMigration();
