// backend/models/order.js
import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    image: { type: String, required: true },
    // Keep as String for compatibility with existing data
    price: { type: String, required: true },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    // NEW: mark gift lines explicitly (added by free_gift coupons)
    isGift: { type: Boolean, default: false },
  },
  { _id: false }
);

const couponSnapshotSchema = new mongoose.Schema(
  {
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon" },
    scope: { type: String, enum: ["user", "global"] },
    code: String,

    // NEW: identify coupon kind; optional for backward compatibility
    type: { type: String, enum: ["percentage", "free_gift"] },

    // ----- percentage coupon fields (existing) -----
    percentage: Number,       // e.g., 15 (%)
    maxDeduction: Number,     // e.g., 10 (USD cap)
    discountApplied: Number,  // actual $ deducted on this order

    // ----- free_gift coupon fields (new) -----
    threshold: Number,        // required gate: subtotal before tax/shipping
    gift: {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      qty: Number,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    shippingInfo: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      phoneNo: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    orderItems: [orderItemSchema],

    paymentMethod: {
      type: String,
      required: [true, "Please select payment method"],
      enum: {
        values: ["COD", "Card"],
        message: "Please select: COD or Card",
      },
    },
    paymentInfo: {
      id: String,
      status: String,
    },

    itemsPrice: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    shippingAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },

    orderStatus: {
      type: String,
      enum: {
        values: ["Processing", "Shipped", "Delivered", "Refunding", "Refunded"],
        message: "Please select correct order status",
      },
      default: "Processing",
    },
    deliveredAt: Date,

    // Snapshot of the coupon applied on this order (if any)
    coupon: couponSnapshotSchema,
  },
  { timestamps: true }
);

export default mongoose.model("Order", orderSchema);
