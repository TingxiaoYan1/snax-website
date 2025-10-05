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
 * body: { shippingInfo: {...}, couponId? | couponCode? }
 */
export const squareCheckoutSession = catchAsyncErrors(async (req, res, next) => {
  try {
    const client = getSquareClient();
    const checkoutApi = client.checkoutApi;
    const locationId = (process.env.SQUARE_LOCATION_ID || "").trim();
    if (!locationId) return next(new ErrorHandler("SQUARE_LOCATION_ID not configured", 500));

    const { couponId, couponCode } = req.body || {};
    if (couponId && couponCode) return next(new ErrorHandler("Only one coupon may be applied", 400));

    // 1) Server cart
    const cart = await Cart.findOne({ user: req.user._id }).populate({
      path: "items.product",
      select: "name price stock images",
    });
    if (!cart || cart.items.length === 0) return next(new ErrorHandler("Your cart is empty", 400));

    // 2) Raw items
    const orderItemsRaw = cart.items.map((ci) => ({
      name: ci.product?.name || "Item",
      quantity: Number(ci.quantity) || 1,
      price: Number(ci.product?.price) || 0,
      image: ci.product?.images?.[0]?.url,
      productId: ci.product?._id,
    }));
    const preSubtotal = orderItemsRaw.reduce((s, i) => s + i.price * i.quantity, 0);

    // 3) Resolve coupon (user or global)
    let applied = null;
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
      applied = found;
    }

    // 4) Apply coupon effects
    let discountedItems = orderItemsRaw;
    let discountAmount = 0;

    if (applied?.coupon?.type === "percentage") {
      const pct = Number(applied.coupon.percentage);
      const cap =
        applied?.coupon?.maxDeduction != null ? Number(applied.coupon.maxDeduction) : Infinity;
      const nominal = (preSubtotal * pct) / 100;
      discountAmount = Math.min(nominal, cap);
      const factor = preSubtotal > 0 ? 1 - discountAmount / preSubtotal : 1;
      discountedItems = orderItemsRaw.map((i) => {
        const p = Number((i.price * factor).toFixed(2));
        return { ...i, price: Math.max(0, Number.isFinite(p) ? p : 0) };
      });
    } else if (applied?.coupon?.type === "free_gift") {
      // Must meet threshold; no price manipulation in Square
      const threshold = Number(applied.coupon.threshold) || 0;
      if (preSubtotal < threshold) {
        return next(new ErrorHandler(`Subtotal must be at least $${threshold.toFixed(2)} to use this coupon`, 400));
      }
    }

    // 5) Totals from discountedItems (if free_gift, same as original)
    const { itemsPrice, shippingPrice, taxPrice } = calculateOrderCost(
      discountedItems.map(({ price, quantity }) => ({ price, quantity }))
    );

    // 6) Square line items
    const lineItems = discountedItems.map((i) => ({
      name: i.name,
      note: JSON.stringify({ productId: i.productId, image: i.image }),
      quantity: String(Math.max(1, Math.floor(i.quantity))),
      basePriceMoney: { amount: Math.round(i.price * 100), currency: "USD" },
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

    // 7) Metadata (strings only)
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
      couponType: applied?.coupon?.type, // NEW
      // percentage payload
      couponPct: applied?.coupon?.type === "percentage" ? String(applied.coupon.percentage) : undefined,
      couponMaxDeduction:
        applied?.coupon?.type === "percentage" && applied?.coupon?.maxDeduction != null
          ? String(applied.coupon.maxDeduction)
          : undefined,
      // free_gift payload
      giftProductId:
        applied?.coupon?.type === "free_gift" ? String(applied.coupon.giftProduct) : undefined,
      giftQty: applied?.coupon?.type === "free_gift" ? String(applied.coupon.giftQty) : undefined,
      threshold: applied?.coupon?.type === "free_gift" ? String(applied.coupon.threshold) : undefined,

      preDiscountItemsPrice: String(preSubtotal.toFixed(2)),
      discountAmount:
        applied?.coupon?.type === "percentage" ? String(discountAmount.toFixed(2)) : undefined,
    };
    Object.keys(meta).forEach((k) => {
      if (meta[k] === undefined || meta[k] === null || meta[k] === "") delete meta[k];
    });

    // 8) Create Payment Link
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
      errors: errs.map((x) => ({ code: x.code, field: x.field || x.detail, category: x.category })),
    });
    return res
      .status(status)
      .json({ message: errs?.[0]?.detail || errs?.[0]?.code || e?.message || "Square checkout failed" });
  }
});

/* --------------------------- Square Webhook (raw) ------------------------- */
// backend/controllers/paymentControllers.js
// REPLACE the whole squareWebhook function with this robust version

export const squareWebhook = async (req, res) => {
  try {
    /* ------------------------ 0) Parse raw / string / JSON body ------------------------ */
    let rawBodyStr = "";
    if (Buffer.isBuffer(req.body)) rawBodyStr = req.body.toString("utf8");
    else if (typeof req.body === "string") rawBodyStr = req.body;
    else rawBodyStr = JSON.stringify(req.body || {});

    let event = {};
    try { event = JSON.parse(rawBodyStr || "{}"); } catch { event = {}; }

    const type = event?.type || "";
    const dataObj = event?.data?.object || {};
    // TEMP DEBUG (remove after confirming)
    console.log("[WH] content-type:", req.headers["content-type"]);
    console.log("[WH] typeof body:", typeof req.body, "Buffer?", Buffer.isBuffer(req.body), "len:", Buffer.isBuffer(req.body) ? req.body.length : (rawBodyStr || "").length);
    console.log("[WH] event type:", type);

    /* ------------------- 1) Get payment/order objects & resolve orderId ------------------ */
    const payment = dataObj.payment || null;
    const orderFromEvent = dataObj.order || null;
    const checkoutObj = dataObj.checkout || dataObj.paymentLink || null;

    let orderId =
      payment?.orderId ||               // camelCase (SDK)
      payment?.order_id ||              // snake_case (webhooks JSON)
      orderFromEvent?.id ||
      checkoutObj?.orderId ||
      checkoutObj?.order?.id ||
      null;

    if (!payment && !orderFromEvent && !orderId) {
      console.warn("[WH] No payment and no order in payload; type:", type);
      return res.status(200).json({ received: true });
    }

    /* ------------------------ 2) Retrieve Square Order if needed ------------------------ */
    const client = getSquareClient();
    let sqOrder = orderFromEvent || null;
    if (!sqOrder) {
      try {
        const { result } = await client.ordersApi.retrieveOrder(orderId);
        sqOrder = result?.order || null;
      } catch (e) {
        console.error("[WH] retrieveOrder error:", e?.statusCode, e?.message);
      }
      if (!sqOrder) {
        console.error("[WH] Missing Square order for", orderId);
        return res.status(200).json({ received: true });
      }
    }

    /* -------------------------- 3) Read metadata we attached ---------------------------- */
    const meta = sqOrder.metadata || {};
    let shippingInfo = {};
    try { if (meta.shippingInfo) shippingInfo = JSON.parse(meta.shippingInfo); } catch {}

    const couponMeta = {
      couponId: meta.couponId || null,
      scope: meta.couponScope || undefined,
      code: meta.couponCode || undefined,
      type: meta.couponType || undefined, // "percentage" | "free_gift"
      percentage: meta.couponPct != null ? Number(meta.couponPct) : undefined,
      maxDeduction: meta.couponMaxDeduction != null ? Number(meta.couponMaxDeduction) : undefined,
      giftProductId: meta.giftProductId || undefined,
      giftQty: meta.giftQty != null ? Number(meta.giftQty) : undefined,
      threshold: meta.threshold != null ? Number(meta.threshold) : undefined,
    };

    /* ---------------- 4) Build product lines from Square order lineItems ----------------- */
    const sqItems = Array.isArray(sqOrder.lineItems) ? sqOrder.lineItems : [];
    const productLines = sqItems.filter((li) => {
      const nm = (li?.name || "").toLowerCase();
      return nm !== "shipping" && nm !== "tax";
    });

    // Extract productId/image from our line-item note JSON
    const rawLines = [];
    for (const li of productLines) {
      const qty = Math.max(1, parseInt(li?.quantity || "1", 10));
      let name = li?.name || "Item";
      let note = {};
      try { if (li?.note) note = JSON.parse(li.note); } catch {}
      rawLines.push({
        productId: note.productId && mongoose.isValidObjectId(note.productId) ? note.productId : null,
        qty,
        fallbackName: name || "Item",
        fallbackImage: note.image,
      });
    }

    // Fetch canonical DB product info (name/price/image) for those ids
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
        price: unitPrice.toFixed(2), // <-- your schema stores String
        quantity: Math.max(1, Math.floor(r.qty || 1)),
        image: p?.images?.[0]?.url || r.fallbackImage,
        isGift: false,
      };
    });

    /* ---------------------- 5) Totals, discounts, free gift logic ----------------------- */
    const preSubtotal = orderItems.reduce((s, it) => s + Number(it.price) * it.quantity, 0);

    // If only couponId is present, backfill payload from DB
    if (!couponMeta.type && couponMeta.couponId && mongoose.isValidObjectId(couponMeta.couponId)) {
      const cdoc = await Coupon.findById(couponMeta.couponId).lean().catch(() => null);
      if (cdoc) {
        couponMeta.scope = couponMeta.scope || cdoc.scope;
        couponMeta.code = couponMeta.code || cdoc.code;
        couponMeta.type = couponMeta.type || cdoc.type;
        if (cdoc.type === "percentage") {
          couponMeta.percentage = cdoc.percentage;
          couponMeta.maxDeduction = cdoc.maxDeduction != null ? Number(cdoc.maxDeduction) : undefined;
        } else if (cdoc.type === "free_gift") {
          couponMeta.giftProductId = couponMeta.giftProductId || String(cdoc.giftProduct);
          couponMeta.giftQty = couponMeta.giftQty != null ? couponMeta.giftQty : Number(cdoc.giftQty || 1);
          couponMeta.threshold = couponMeta.threshold != null ? couponMeta.threshold : Number(cdoc.threshold || 0);
        }
      }
    }

    // Percentage discount (free_gift does not change price)
    const pct = couponMeta.type === "percentage" ? Number(couponMeta.percentage || 0) : 0;
    const cap = couponMeta.type === "percentage" && couponMeta.maxDeduction != null
      ? Number(couponMeta.maxDeduction)
      : Infinity;

    const nominalDiscount = pct > 0 ? (preSubtotal * pct) / 100 : 0;
    const discountApplied = Number(Math.min(nominalDiscount, cap).toFixed(2));
    const discountedSubtotal = Math.max(0, Number((preSubtotal - discountApplied).toFixed(2)));

    // Shipping/Tax (same rules as elsewhere)
    const shippingAmount = discountedSubtotal > 200 ? 0 : 5;
    const taxAmount = Number((0.15 * discountedSubtotal).toFixed(2));
    const itemsPrice = discountedSubtotal;
    const totalAmount = Number((itemsPrice + shippingAmount + taxAmount).toFixed(2));

    // FREE-GIFT: append a $0 line if threshold met (threshold uses PRE-discount subtotal, before tax/shipping)
    let appendedGift = null;
    if (couponMeta.type === "free_gift") {
      const ok =
        preSubtotal >= (Number(couponMeta.threshold) || 0) &&
        couponMeta.giftProductId &&
        mongoose.isValidObjectId(couponMeta.giftProductId) &&
        Number(couponMeta.giftQty || 0) > 0;

      if (ok) {
        const gp = await Product.findById(couponMeta.giftProductId).select("name images").lean().catch(() => null);
        if (gp) {
          appendedGift = {
            product: gp._id,
            name: gp.name || "Gift",
            price: "0.00",
            quantity: Math.max(1, Math.floor(Number(couponMeta.giftQty))),
            image: gp?.images?.[0]?.url,
            isGift: true,
          };
          orderItems.push(appendedGift);
        }
      }
    }

    // Coupon snapshot for DB order
    const couponSnapshot =
      couponMeta.type === "percentage" && pct > 0
        ? {
            couponId: couponMeta.couponId || undefined,
            scope: couponMeta.scope,
            code: couponMeta.code,
            type: "percentage",
            percentage: Number(pct),
            maxDeduction: couponMeta.maxDeduction != null ? Number(couponMeta.maxDeduction) : undefined,
            discountApplied,
          }
        : couponMeta.type === "free_gift"
        ? {
            couponId: couponMeta.couponId || undefined,
            scope: couponMeta.scope,
            code: couponMeta.code,
            type: "free_gift",
            threshold: Number(couponMeta.threshold) || 0,
            gift: appendedGift
              ? { productId: appendedGift.product, qty: appendedGift.quantity }
              : couponMeta.giftProductId
              ? { productId: couponMeta.giftProductId, qty: Number(couponMeta.giftQty || 1) }
              : undefined,
          }
        : undefined;

    /* ------------------------------ 6) Identify the user ------------------------------- */
    const ref = sqOrder?.referenceId || "";
    const userId = mongoose.isValidObjectId(ref) ? ref : null;
    if (!userId) {
      console.error("[WH] Missing/invalid referenceId on Square order", { ref, type });
      return res.status(200).json({ received: true });
    }

    /* --------------------------- 7) Idempotency for payments ---------------------------- */
    if (payment?.id) {
      const dup = await Order.findOne({ "paymentInfo.id": payment.id, paymentMethod: "Card" }).select("_id").lean();
      if (dup) return res.status(200).json({ received: true });
    }

    /* -------------------------------- 8) Create DB order -------------------------------- */
    const order = await Order.create({
      user: userId,
      orderItems,
      shippingInfo: {
        address: shippingInfo.address || "",
        city: shippingInfo.city || "",
        phoneNo: shippingInfo.phoneNo || "",
        zipCode: shippingInfo.zipCode || "",
        country: shippingInfo.country || "",
      },
      itemsPrice: Number(itemsPrice.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      shippingAmount: Number(shippingAmount.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      coupon: couponSnapshot,
      paymentMethod: "Card",
      paymentInfo: {
        id: payment?.id || orderId || null,
        status: "PAID",
      },
    });

    /* ------------------- 9) Stock decrement & clear cart (fire-and-forget) ------------------- */
    for (const it of order.orderItems || []) {
      if (it.product && mongoose.isValidObjectId(it.product)) {
        try { await Product.updateOne({ _id: it.product }, { $inc: { stock: -it.quantity } }); } catch {}
      }
    }
    await Cart.updateOne({ user: userId }, { $set: { items: [] } }).catch(() => {});

    /* ----------------------- 10) Mark coupon redeemed/used if present ---------------------- */
    if (couponMeta.couponId && mongoose.isValidObjectId(couponMeta.couponId)) {
      try {
        const couponDoc = await Coupon.findById(couponMeta.couponId).lean();
        if (couponDoc) {
          await finalizeCouponRedemption({ coupon: couponDoc, userId, orderId: order._id });
        }
      } catch (e) {
        if (e?.code === 11000) console.warn("[WH] duplicate coupon redemption", couponMeta.couponId, userId);
        else console.error("[WH] redemption error:", e?.message);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("[WH] unexpected error:", err?.message, err?.stack);
    return res.status(200).json({ received: true });
  }
};
