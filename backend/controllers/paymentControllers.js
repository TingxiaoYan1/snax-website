import mongoose from "mongoose";
import crypto from "crypto";
import { Client } from "square/legacy";

import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";

import { calculateOrderCost } from "../utils/orderCost.js";
import Cart from "../models/cart.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import Coupon from "../models/coupon.js";

// Use helpers from your coupon controller (already in your repo)
import {
  findValidCouponForUser,
  finalizeCouponRedemption,
} from "./couponControllers.js";


/* ------------------------------ Square client ----------------------------- */

function getSquareClient() {
  const token = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  return new Client({
    bearerAuthCredentials: { accessToken: token },
    environment: process.env.SQUARE_ENV === "production" ? "production" : "sandbox",
  });
}

/* --------------------------------- Ping ---------------------------------- */

export const squarePing = catchAsyncErrors(async (req, res) => {
  try {
    const client = getSquareClient();
    const { result } = await client.locationsApi.listLocations();
    res.json({
      ok: true,
      env: process.env.SQUARE_ENV || "sandbox",
      locations: result.locations?.map((l) => ({ id: l.id, name: l.name })),
    });
  } catch (e) {
    res
      .status(e?.statusCode || 500)
      .json({ message: e?.result?.errors?.[0]?.detail || e?.message || "Square ping failed" });
  }
});

/* ------------------------ Create Payment Link (Card) ---------------------- */
/** POST /api/v1/<payments|square>/checkout
 * body: { shippingInfo: {address,city,phoneNo,zipCode,country}, couponId? | couponCode? }
 */
export const squareCheckoutSession = catchAsyncErrors(async (req, res, next) => {
  try {
    const client = getSquareClient();
    const checkoutApi = client.checkoutApi;

    const locationId = (process.env.SQUARE_LOCATION_ID || "").trim();
    if (!locationId) return next(new ErrorHandler("SQUARE_LOCATION_ID not configured", 500));

    // one or none — but never both
    const { couponId, couponCode } = req.body || {};
    if (couponId && couponCode) return next(new ErrorHandler("Only one coupon may be applied", 400));

    // 1) Load server cart
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      select: "name price stock images",
    });
    if (!cart || cart.items.length === 0) return next(new ErrorHandler("Your cart is empty", 400));

    // 2) Build raw cart items
    const orderItemsRaw = cart.items.map((ci) => ({
      name: ci.product?.name || "Item",
      quantity: Number(ci.quantity) || 1,
      price: Number(ci.product?.price) || 0,
      image: ci.product?.images?.[0]?.url,
      productId: ci.product?._id,
    }));

    // 3) Resolve coupon (user or global)
    let applied = null; // { coupon, kind: "user" | "global" }
    if (couponId) {
      const c = await Coupon.findOne({
        _id: couponId,
        scope: "user",
        assignedTo: req.user._id,
        used: false,
        expiresAt: { $gt: new Date() },
      }).lean();
      if (!c) return next(new ErrorHandler("Invalid or expired coupon", 400));
      applied = { coupon: c, kind: "user" };
    } else if (couponCode) {
      const found = await findValidCouponForUser(req.user._id, couponCode);
      if (!found) return next(new ErrorHandler("Invalid or expired coupon", 400));
      applied = found; // either { coupon, kind: "global" } or null
    }

    // 4) Apply discount first (tax after discount)
    const preSubtotal = orderItemsRaw.reduce((s, i) => s + i.price * i.quantity, 0);
    const pct = applied ? Number(applied.coupon.percentage) : 0;
    const cap =
      applied?.coupon?.maxDeduction != null ? Number(applied.coupon.maxDeduction) : Infinity;
    const nominal = applied ? (preSubtotal * pct) / 100 : 0;
    const discountAmount = applied ? Math.min(nominal, cap) : 0;

    const factor = preSubtotal > 0 ? 1 - discountAmount / preSubtotal : 1;
    const discountedItems = orderItemsRaw.map((i) => {
      const p = Number((i.price * factor).toFixed(2));
      const safe = Math.max(0, Number.isFinite(p) ? p : 0);
      return { ...i, price: safe };
    });

    // 5) Compute totals (items, shipping, tax) from discounted items
    const { itemsPrice, shippingPrice, taxPrice } = calculateOrderCost(
      discountedItems.map(({ price, quantity }) => ({ price, quantity }))
    );

    // 6) Build Square line items (strict types)
    const lineItems = discountedItems.map((i) => ({
      name: i.name,
      note: JSON.stringify({ productId: i.productId, image: i.image }),
      quantity: String(Math.max(1, Math.floor(i.quantity))), // MUST be string digits
      basePriceMoney: { amount: Math.round(i.price * 100), currency: "USD" }, // MUST be integer cents
    }));

    if (Number(shippingPrice) > 0) {
      lineItems.push({
        name: "shipping",
        quantity: "1",
        basePriceMoney: { amount: Math.round(Number(shippingPrice) * 100), currency: "USD" },
      });
    }
    if (Number(taxPrice) > 0) {
      lineItems.push({
        name: "tax",
        quantity: "1",
        basePriceMoney: { amount: Math.round(Number(taxPrice) * 100), currency: "USD" },
      });
    }

    if (!lineItems.length) return next(new ErrorHandler("Cart is empty or invalid", 400));
    for (const li of lineItems) {
      if (typeof li.quantity !== "string" || !/^\d+$/.test(li.quantity)) {
        return next(new ErrorHandler("Invalid line item quantity", 400));
      }
      if (!Number.isInteger(li?.basePriceMoney?.amount)) {
        return next(new ErrorHandler("Invalid line item amount", 400));
      }
    }

    // 7) Metadata (strings only; prune empties)
    const shippingInfo = {
      address: req.body?.shippingInfo?.address || "",
      city: req.body?.shippingInfo?.city || "",
      phoneNo: req.body?.shippingInfo?.phoneNo || "",
      zipCode: req.body?.shippingInfo?.zipCode || "",
      country: req.body?.shippingInfo?.country || "",
    };

    const meta = {
      shippingInfo: JSON.stringify(shippingInfo),
      couponId: applied?.coupon?._id?.toString(),
      couponCode: applied?.coupon?.code,
      couponScope: applied?.coupon?.scope,
      couponPct: applied ? String(applied.coupon.percentage) : undefined,
      couponMaxDeduction:
        applied?.coupon?.maxDeduction != null ? String(applied.coupon.maxDeduction) : undefined,
      preDiscountItemsPrice: String(preSubtotal.toFixed(2)),
      discountAmount: applied ? String(discountAmount.toFixed(2)) : undefined,
    };
    Object.keys(meta).forEach((k) => {
      if (meta[k] === undefined || meta[k] === null || meta[k] === "") delete meta[k];
    });

    // 8) Create Payment Link with inline order
    const { result } = await checkoutApi.createPaymentLink({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId,
        lineItems,
        referenceId: req.user._id.toString(),
        metadata: meta,
      },
      checkoutOptions: {
        redirectUrl: `${process.env.FRONTEND_URL}/square/return`,
        merchantSupportEmail: "support@snaxplanet.com",
      },
    });

    return res.json({ url: result?.paymentLink?.url });
  } catch (e) {
    const status = e?.statusCode || e?.status || 500;
    const errs = e?.result?.errors || [];
    console.error("[Square] createPaymentLink failed", {
      status,
      errors: errs.map((x) => ({
        code: x.code,
        field: x.field || x.detail,
        category: x.category,
      })),
    });
    return res
      .status(status)
      .json({ message: errs?.[0]?.detail || errs?.[0]?.code || e?.message || "Square checkout failed" });
  }
});

/* --------------------------- Square Webhook (raw) ------------------------- */
/** POST /api/v1/webhooks/square  (mounted with express.raw)
 * Verifies signature, creates Order from DB prices, stores coupon snapshot, finalizes redemption.
 */
export const squareWebhook = async (req, res) => {
  try {
    // 1) Raw body & signature headers
    const rawBuf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    const rawBody = rawBuf.toString("utf8");

    const sig256 =
      req.get("x-square-hmacsha256-signature") || req.get("X-Square-Hmacsha256-Signature");
    const sigLegacy = req.get("x-square-signature") || req.get("X-Square-Signature");

    const notificationUrl = `${process.env.PUBLIC_BASE_URL}/api/v1/webhooks/square`;
    const secret = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || "";

    // 2) Verify HMAC-SHA256 (preferred), fallback to legacy SHA1 if header present
    let ok = false;
    if (sig256 && secret) {
      const expected = crypto.createHmac("sha256", secret).update(notificationUrl + rawBody).digest("base64");
      ok = expected === sig256;
    } else if (sigLegacy && secret) {
      const expected = crypto.createHmac("sha1", secret).update(notificationUrl + rawBody).digest("base64");
      ok = expected === sigLegacy;
    }
    if (!ok) {
      console.warn("[WH] Signature mismatch");
      return res.status(401).json({ received: true });
    }

    // 3) Parse event
    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return res.status(400).json({ received: true });
    }
    if (event?.type !== "payment.updated") return res.status(200).json({ received: true });

    const payment = event?.data?.object?.payment;
    if (!payment || payment.status !== "COMPLETED") return res.status(200).json({ received: true });

    // 4) Idempotency guard
    const paymentId = payment.id;
    const exists = await Order.findOne({ "paymentInfo.id": paymentId }).select("_id").lean();
    if (exists) return res.status(200).json({ received: true });

    // 5) Retrieve Square order (for metadata & product note)
    const client = getSquareClient();
    const sqOrderId = payment?.order_id;
    let sqOrder = null;
    if (sqOrderId) {
      try {
        const { result } = await client.ordersApi.retrieveOrder(sqOrderId);
        sqOrder = result?.order || null;
      } catch (e) {
        console.error("[WH] retrieveOrder error:", e?.statusCode, e?.message);
      }
    }
    if (!sqOrder) {
      console.error("[WH] Missing Square order for payment", paymentId);
      return res.status(200).json({ received: true });
    }

    // 6) Metadata: coupon + shipping
    const meta = sqOrder.metadata || {};
    let shippingInfo = {};
    try {
      if (meta.shippingInfo) shippingInfo = JSON.parse(meta.shippingInfo);
    } catch {
      shippingInfo = {};
    }

    const couponMeta = {
      couponId: meta.couponId || null,
      scope: meta.couponScope || undefined,
      code: meta.couponCode || undefined,
      percentage: meta.couponPct != null ? Number(meta.couponPct) : undefined,
      maxDeduction: meta.couponMaxDeduction != null ? Number(meta.couponMaxDeduction) : undefined,
    };

    // 7) Collect product refs from line items (skip shipping/tax rows)
    const rawLines = [];
    for (const li of sqOrder.lineItems || []) {
      const name = li?.name || "";
      const lname = name.toLowerCase();
      if (lname.includes("shipping") || lname.includes("tax")) continue;

      let note = {};
      try {
        note = li?.note ? JSON.parse(li.note) : {};
      } catch {
        note = {};
      }

      rawLines.push({
        productId: note.productId && mongoose.isValidObjectId(note.productId) ? note.productId : null,
        qty: Number(li?.quantity ?? 1),
        fallbackName: name || "Item",
        fallbackImage: note.image,
      });
    }

    // 8) Build orderItems from DB prices (snapshot at webhook time)
    const ids = [...new Set(rawLines.map((r) => r.productId).filter(Boolean))];
    const products = ids.length
      ? await Product.find({ _id: { $in: ids } }).select("name price images").lean()
      : [];
    const pmap = new Map(products.map((p) => [String(p._id), p]));

    const orderItems = rawLines.map((r) => {
      const p = r.productId ? pmap.get(String(r.productId)) : null;
      const unitPrice = p ? Number(p.price) : 0;
      return {
        product: r.productId || undefined,
        name: p?.name || r.fallbackName || "Item",
        price: unitPrice, // snapshot from DB
        quantity: Math.max(1, Math.floor(r.qty || 1)),
        image: p?.images?.[0]?.url || r.fallbackImage,
      };
    });

    // 9) Compute totals with tax-after-discount
    const preSubtotal = orderItems.reduce((s, it) => s + it.price * it.quantity, 0);

    // Backfill coupon details if missing
    if (!couponMeta.percentage && couponMeta.couponId && mongoose.isValidObjectId(couponMeta.couponId)) {
      const cdoc = await Coupon.findById(couponMeta.couponId).lean().catch(() => null);
      if (cdoc) {
        couponMeta.scope = couponMeta.scope || cdoc.scope;
        couponMeta.code = couponMeta.code || cdoc.code;
        couponMeta.percentage = cdoc.percentage;
        couponMeta.maxDeduction =
          cdoc.maxDeduction != null ? Number(cdoc.maxDeduction) : undefined;
      }
    }

    const pct = couponMeta.percentage ? Number(couponMeta.percentage) : 0;
    const cap =
      couponMeta.maxDeduction != null ? Number(couponMeta.maxDeduction) : Infinity;
    const nominalDiscount = pct > 0 ? (preSubtotal * pct) / 100 : 0;
    const discountApplied = Number(Math.min(nominalDiscount, cap).toFixed(2));
    const discountedSubtotal = Math.max(0, Number((preSubtotal - discountApplied).toFixed(2)));

    // Shipping: free if discountedSubtotal > 200; else $5
    const shippingAmount = discountedSubtotal > 200 ? 0 : 5;
    const taxAmount = Number((0.15 * discountedSubtotal).toFixed(2));
    const itemsPrice = discountedSubtotal;
    const totalAmount = Number((itemsPrice + shippingAmount + taxAmount).toFixed(2));

    // Compare to Square total (warn only)
    const squareTotal = Number(
      (Number(sqOrder?.totalMoney?.amount ?? payment?.total_money?.amount ?? 0) / 100).toFixed(2)
    );
    const drift = Math.abs(squareTotal - totalAmount);
    if (drift > 0.05) {
      console.warn("[WH] Total mismatch (DB vs Square):", {
        dbTotal: totalAmount,
        squareTotal,
        preSubtotal,
        discountApplied,
      });
    }

    // 10) Identify user from referenceId
    const ref = sqOrder?.referenceId || "";
    const userId = mongoose.isValidObjectId(ref) ? ref : null;
    if (!userId) {
      console.error("[WH] Missing/invalid referenceId on Square order", { ref });
      return res.status(200).json({ received: true });
    }

    // 11) Create Order (idempotent already checked)
    const order = await Order.create({
      user: userId,
      orderItems,
      shippingInfo,
      itemsPrice: Number(itemsPrice.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      shippingAmount: Number(shippingAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      coupon:
        pct > 0
          ? {
              couponId: couponMeta.couponId || undefined,
              scope: couponMeta.scope,
              code: couponMeta.code,
              percentage: Number(pct),
              maxDeduction:
                couponMeta.maxDeduction != null ? Number(couponMeta.maxDeduction) : undefined,
              discountApplied, // actual $ off on THIS order
            }
          : undefined,
      paymentMethod: "Card",
      paymentInfo: { id: paymentId, status: "Paid" },
    });

    // 12) Adjust stock + clear cart
    for (const it of order.orderItems || []) {
      if (it.product && mongoose.isValidObjectId(it.product)) {
        try {
          await Product.updateOne({ _id: it.product }, { $inc: { stock: -it.quantity } });
        } catch (e) {
          console.error("[WH] stock update failed:", it.product, e?.message);
        }
      }
    }
    await Cart.updateOne({ user: userId }, { $set: { items: [] } }).catch(() => {});

    // 13) Finalize coupon redemption
    const redeemId = couponMeta.couponId;
    if (redeemId && mongoose.isValidObjectId(redeemId)) {
      try {
        const couponDoc = await Coupon.findById(redeemId).lean();
        if (couponDoc) {
          await finalizeCouponRedemption({ coupon: couponDoc, userId, orderId: order._id });
        }
      } catch (e) {
        if (e?.code === 11000) {
          console.warn("[WH] duplicate coupon redemption", redeemId, userId);
        } else {
          console.error("[WH] redemption error:", e?.message);
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[WH] unexpected error:", err?.message, err?.stack);
    // Acknowledge so Square doesn’t spam retries while you investigate
    return res.status(200).json({ received: true });
  }
};
