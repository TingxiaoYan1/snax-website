// backend/seeder/migrate_to_l1_l2.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/product.js";

dotenv.config({ path: "backend/config/config.env" });

async function main() {
  await mongoose.connect(process.env.DB_LOCAL_URI || process.env.DB_URI);

  const candidates = await Product.find({
    $or: [{ categories: { $exists: false } }, { "categories.l1": { $in: [null, ""] } }],
  });

  let updated = 0;
  for (const p of candidates) {
    const legacy = p.category;
    if (!p.categories || !p.categories.l1) {
      p.categories = {
        l1: "other",
        l2: legacy || null,
      };
      // Keep legacy field optional (you can also null it out if you prefer)
      await p.save({ validateBeforeSave: false });
      updated += 1;
    }
  }

  console.log(`Migrated ${updated} products to {l1,l2}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
