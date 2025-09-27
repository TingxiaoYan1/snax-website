import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    percentage: { type: Number, required: true, min: 1, max: 100 },
    maxDeduction: { type: Number, min: 0 }, // optional; no cap if undefined

    // NEW: either tied to a single user ("user") or usable by everyone ("global")
    scope: { type: String, enum: ["user", "global"], default: "user", index: true },

    // For scope === "user"
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      validate: {
        validator: function (v) {
          return this.scope === "user" ? !!v : true;
        },
        message: "assignedTo is required when scope is 'user'",
      },
    },

    // Validity window & status
    startAt: { type: Date },                 // optional start time (for global campaigns)
    expiresAt: { type: Date, required: true, index: true },

    // Only meaningful for user-scoped coupons
    used: { type: Boolean, default: false, index: true },

    // Limits for global coupons
    maxRedemptions: { type: Number },        // total cap across everyone (optional)
    perUserLimit: { type: Number, default: 1 }, // default: once per user

    note: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Fast lookups
CouponSchema.index({ assignedTo: 1, used: 1, expiresAt: 1, createdAt: -1 });
// One doc per (code,scope,assignedTo) — allows same code assigned to different users + one global
CouponSchema.index({ code: 1, scope: 1, assignedTo: 1 }, { unique: true });

export default models.Coupon || model("Coupon", CouponSchema);
