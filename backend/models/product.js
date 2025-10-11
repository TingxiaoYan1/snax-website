import mongoose from "mongoose";
import { CATEGORY_L1, CATEGORY_L2_BY_L1, isValidCategoryPair } from "../constants/categories.js";

/** Hierarchical categories (L1 / L2 only).
 *  Rules:
 *  - If L1 has no L2 for that product, leave l2 null.
 *  - Legacy single-field 'category' is now optional and mirrors L2 under L1="other".
 */
const categoryLevelsSchema = new mongoose.Schema(
  {
    l1: { type: String, required: [true, "Please enter level-1 category"], enum: CATEGORY_L1 },
    l2: {
      type: String,
      default: null,
      // We can't use a static enum here because allowed values depend on l1.
      validate: {
        validator: function (v) {
          // 'this' is the subdocument; guard when l1 missing
          const l1 = this?.l1;
          return isValidCategoryPair(l1, v);
        },
        message: (props) => `Invalid level-2 category "${props.value}" for level-1 "${props?.path && props?.instance?.l1}".`
      }
    }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter product name"],
      maxLength: [200, "Product name cannot exceed 200 Characters"],
    },
    chinesename: { type: String, maxLength: [200, "Product name cannot exceed 200 Characters"] },
    price: { type: Number, required: [true, "Please enter product price"], maxLength: [5, "Product price cannot exceed 5 digits"] },
    description: { type: String, required: [true, "Please enter product description"] },
    ratings: { type: Number, default: 0 },
    images: [
      {
        public_id: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],

    /** ✅ New primary classification */
    categories: {
      type: categoryLevelsSchema,
      required: true,
    },

    /** ♻️ Legacy: keep old single-field category for backward compatibility (OPTIONAL).
     *  IMPORTANT: This will no longer be required. Existing values will be migrated into:
     *  categories.l1 = "other", categories.l2 = <legacy-category>
     */
    // category: {
    //   type: String,
    //   required: false,
    // },

    seller: { type: String, required: [true, "Please enter product seller"] },
    stock: { type: Number, required: [true, "Please enter product stock"] },
    numOfReviews: { type: Number, default: 0 },
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        rating: { type: Number, required: true },
        comment: { type: String, required: true },
      },
    ],
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    chinesedescription: { type: String },
    expiredate: { type: String, default: "1 Month" },

    tags: {
        numbers: {
            type: Map,
            of: { type: Number, min: 0 },  // enforce non-negative
            default: {},                   // e.g., { sour: 2, spicy: 5 }
        },
        booleans: {
            type: Map,
            of: Boolean,                   // e.g., { gluten_free: true }
            default: {},
        },
    },
  },
  { timestamps: true }
);

/** Helpful indexes */
productSchema.index({ "categories.l1": 1 });
productSchema.index({ "categories.l1": 1, "categories.l2": 1 });

export default mongoose.model("Product", productSchema);
