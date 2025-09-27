import mongoose from "mongoose";
const { Schema, model, models } = mongoose;

const CouponRedemptionSchema = new Schema(
  {
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" }, // optional bookkeeping
    redeemedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Enforce at most one redemption per user per global coupon
CouponRedemptionSchema.index({ couponId: 1, userId: 1 }, { unique: true });

export default models.CouponRedemption || model("CouponRedemption", CouponRedemptionSchema);
