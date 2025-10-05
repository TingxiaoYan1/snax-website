import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, index: true },

    // NEW: coupon kind
    type: {
      type: String,
      enum: ["percentage", "free_gift"],
      default: "percentage",
      index: true,
    },

    /* ----- percentage type fields ----- */
    percentage: {
      type: Number,
      min: 1,
      max: 100,
      required: function () {
        return this.type === "percentage";
      },
    },
    maxDeduction: { type: Number, min: 0 }, // optional cap for percentage type

    /* ----- free_gift type fields ----- */
    giftProduct: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: function () {
        return this.type === "free_gift";
      },
      index: true,
    },
    giftQty: {
      type: Number,
      min: 1,
      required: function () {
        return this.type === "free_gift";
      },
    },
    // Order subtotal (before tax/shipping/discounts) must be >= threshold to use
    threshold: {
      type: Number,
      min: 0,
      required: function () {
        return this.type === "free_gift";
      },
    },

    /* ----- scope and lifecycle ----- */
    scope: { type: String, enum: ["user", "global"], default: "user", index: true },
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
    startAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
    used: { type: Boolean, default: false, index: true }, // only relevant to user-scoped

    // global limits
    maxRedemptions: { type: Number },
    perUserLimit: { type: Number, default: 1 },

    note: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Fast lookups
CouponSchema.index({ assignedTo: 1, used: 1, expiresAt: 1, createdAt: -1 });
// Uniqueness across code/scope/assignedTo (global has assignedTo=null)
CouponSchema.index({ code: 1, scope: 1, assignedTo: 1 }, { unique: true });

export default models.Coupon || model("Coupon", CouponSchema);
