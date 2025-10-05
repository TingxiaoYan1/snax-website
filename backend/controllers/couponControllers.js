import mongoose from "mongoose";
import Coupon from "../models/coupon.js";
import CouponRedemption from "../models/couponRedemption.js";
import User from "../models/user.js";
import Product from "../models/product.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";

/** =========================
 * ADMIN: create user percentage coupon (existing)
 * POST /api/v1/admin/coupons
 * body: { userId, code, percentage, daysValid, note?, maxDeduction? }
 * ========================= */
export const giveCoupon = catchAsyncErrors(async (req, res, next) => {
  let { userId, code, percentage, daysValid, note, maxDeduction } = req.body;

  if (!userId || !code || percentage == null || daysValid == null) {
    return next(new ErrorHandler("userId, code, percentage, daysValid are required", 400));
  }
  if (maxDeduction != null && !(Number(maxDeduction) >= 0)) {
    return next(new ErrorHandler("maxDeduction must be >= 0", 400));
  }

  code = String(code).toUpperCase().trim();
  percentage = Number(percentage);
  daysValid = parseInt(daysValid, 10);

  if (!(percentage >= 1 && percentage <= 100)) {
    return next(new ErrorHandler("percentage must be between 1 and 100", 400));
  }
  if (!Number.isInteger(daysValid) || daysValid <= 0) {
    return next(new ErrorHandler("daysValid must be a positive integer", 400));
  }

  const user = await User.findById(userId).select("_id");
  if (!user) return next(new ErrorHandler("User not found", 404));

  const now = Date.now();
  const expiresAt = new Date(now + daysValid * 24 * 60 * 60 * 1000);

  const existing = await Coupon.findOne({
    scope: "user",
    code,
    assignedTo: user._id,
    used: false,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (existing) {
    return next(new ErrorHandler("Active coupon with this code already exists for user", 409));
  }

  const coupon = await Coupon.create({
    type: "percentage",
    scope: "user",
    code,
    percentage,
    assignedTo: user._id,
    expiresAt,
    maxDeduction: maxDeduction != null ? Number(maxDeduction) : undefined,
    note,
    createdBy: req.user?._id,
  });

  res.status(201).json({ success: true, coupon });
});

/** =========================
 * ADMIN: give user FREE-GIFT coupon (separate place)
 * POST /api/v1/admin/coupons/freegift/user
 * body: { userId, code, daysValid, giftProductId, giftQty, threshold, note? }
 * ========================= */
export const giveFreeGiftCouponToUser = catchAsyncErrors(async (req, res, next) => {
  let { userId, code, daysValid, giftProductId, giftQty, threshold, note } = req.body || {};

  if (!userId || !code || daysValid == null || !giftProductId || !giftQty || threshold == null) {
    return next(new ErrorHandler("userId, code, daysValid, giftProductId, giftQty, threshold are required", 400));
  }
  code = String(code).toUpperCase().trim();
  daysValid = parseInt(daysValid, 10);
  giftQty = parseInt(giftQty, 10);
  threshold = Number(threshold);

  if (!mongoose.isValidObjectId(userId)) return next(new ErrorHandler("Invalid userId", 400));
  if (!mongoose.isValidObjectId(giftProductId)) return next(new ErrorHandler("Invalid giftProductId", 400));
  if (!Number.isInteger(daysValid) || daysValid <= 0) return next(new ErrorHandler("daysValid must be a positive integer", 400));
  if (!Number.isInteger(giftQty) || giftQty <= 0) return next(new ErrorHandler("giftQty must be a positive integer", 400));
  if (!(threshold >= 0)) return next(new ErrorHandler("threshold must be >= 0", 400));

  const [user, product] = await Promise.all([
    User.findById(userId).select("_id"),
    Product.findById(giftProductId).select("_id"),
  ]);
  if (!user) return next(new ErrorHandler("User not found", 404));
  if (!product) return next(new ErrorHandler("Gift product not found", 404));

  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

  const dup = await Coupon.findOne({
    scope: "user",
    type: "free_gift",
    code,
    assignedTo: user._id,
    used: false,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (dup) return next(new ErrorHandler("Active free-gift coupon with this code already exists for user", 409));

  const coupon = await Coupon.create({
    type: "free_gift",
    scope: "user",
    code,
    assignedTo: user._id,
    expiresAt,
    giftProduct: product._id,
    giftQty,
    threshold,
    note,
    createdBy: req.user?._id,
  });

  res.status(201).json({ success: true, coupon });
});

/** =========================
 * ADMIN: create GLOBAL percentage coupon (existing)
 * POST /api/v1/admin/coupons/global
 * body: { code, percentage, daysValid, note?, maxRedemptions?, perUserLimit?, startAt?, maxDeduction? }
 * ========================= */
export const adminCreateGlobalCoupon = catchAsyncErrors(async (req, res, next) => {
  let { code, percentage, daysValid, note, maxRedemptions, perUserLimit = 1, startAt, maxDeduction } = req.body;

  if (!code || percentage == null || daysValid == null) {
    return next(new ErrorHandler("code, percentage, daysValid are required", 400));
  }
  if (maxDeduction != null && !(Number(maxDeduction) >= 0)) {
    return next(new ErrorHandler("maxDeduction must be >= 0", 400));
  }

  code = String(code).toUpperCase().trim();
  percentage = Number(percentage);
  daysValid = parseInt(daysValid, 10);

  if (!(percentage >= 1 && percentage <= 100)) {
    return next(new ErrorHandler("percentage 1–100", 400));
  }
  if (!Number.isInteger(daysValid) || daysValid <= 0) {
    return next(new ErrorHandler("daysValid must be a positive int", 400));
  }

  const exists = await Coupon.findOne({ scope: "global", code }).lean();
  if (exists) return next(new ErrorHandler("Global coupon with this code already exists", 409));

  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

  const coupon = await Coupon.create({
    type: "percentage",
    scope: "global",
    code,
    percentage,
    expiresAt,
    startAt: startAt ? new Date(startAt) : undefined,
    maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
    perUserLimit: perUserLimit ? Number(perUserLimit) : 1,
    maxDeduction: maxDeduction != null ? Number(maxDeduction) : undefined,
    note,
    createdBy: req.user?._id,
  });

  res.status(201).json({ success: true, coupon });
});

/** =========================
 * ADMIN: create GLOBAL FREE-GIFT coupon (separate place)
 * POST /api/v1/admin/coupons/freegift/global
 * body: { code, daysValid, giftProductId, giftQty, threshold, note?, maxRedemptions?, perUserLimit?, startAt? }
 * ========================= */
export const adminCreateGlobalFreeGiftCoupon = catchAsyncErrors(async (req, res, next) => {
  let { code, daysValid, giftProductId, giftQty, threshold, note, maxRedemptions, perUserLimit = 1, startAt } =
    req.body || {};

  if (!code || daysValid == null || !giftProductId || !giftQty || threshold == null) {
    return next(new ErrorHandler("code, daysValid, giftProductId, giftQty, threshold are required", 400));
  }
  code = String(code).toUpperCase().trim();
  daysValid = parseInt(daysValid, 10);
  giftQty = parseInt(giftQty, 10);
  threshold = Number(threshold);

  if (!mongoose.isValidObjectId(giftProductId)) return next(new ErrorHandler("Invalid giftProductId", 400));
  if (!Number.isInteger(daysValid) || daysValid <= 0) return next(new ErrorHandler("daysValid must be a positive integer", 400));
  if (!Number.isInteger(giftQty) || giftQty <= 0) return next(new ErrorHandler("giftQty must be a positive integer", 400));
  if (!(threshold >= 0)) return next(new ErrorHandler("threshold must be >= 0", 400));

  const prod = await Product.findById(giftProductId).select("_id");
  if (!prod) return next(new ErrorHandler("Gift product not found", 404));

  const exists = await Coupon.findOne({ scope: "global", code }).lean();
  if (exists) return next(new ErrorHandler("Global coupon with this code already exists", 409));

  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000);

  const coupon = await Coupon.create({
    type: "free_gift",
    scope: "global",
    code,
    expiresAt,
    startAt: startAt ? new Date(startAt) : undefined,
    maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
    perUserLimit: perUserLimit ? Number(perUserLimit) : 1,
    giftProduct: prod._id,
    giftQty,
    threshold,
    note,
    createdBy: req.user?._id,
  });

  res.status(201).json({ success: true, coupon });
});

/** =========================
 * USER: list my coupons (existing)
 * GET /api/v1/me/coupons?onlyValid=true&page=1&pageSize=20
 * ========================= */
export const getMyCoupons = catchAsyncErrors(async (req, res) => {
  const onlyValid = String(req.query.onlyValid) === "true";
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));

  const filter = { assignedTo: req.user._id };
  if (onlyValid) Object.assign(filter, { used: false, expiresAt: { $gt: new Date() } });

  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Coupon.countDocuments(filter),
  ]);

  res.json({ success: true, page, pageSize, total, coupons: items });
});

/** =========================
 * USER: get single coupon (existing)
 * GET /api/v1/me/coupons/:couponId
 * ========================= */
export const getMyCouponById = catchAsyncErrors(async (req, res, next) => {
  const coupon = await Coupon.findOne({
    _id: req.params.couponId,
    assignedTo: req.user._id,
  }).lean();

  if (!coupon) return next(new ErrorHandler("Coupon not found", 404));
  res.json({ success: true, coupon });
});

/** =========================
 * ADMIN: delete any coupon by id (existing)
 * DELETE /api/v1/admin/coupons/:couponId
 * ========================= */
export const adminDeleteCoupon = catchAsyncErrors(async (req, res, next) => {
  const deleted = await Coupon.findByIdAndDelete(req.params.couponId);
  if (!deleted) return next(new ErrorHandler("Coupon not found", 404));
  res.json({ success: true, message: "Coupon removed (admin)" });
});

/** =========================
 * Helper: find usable coupon by id (user-scoped) (existing)
 * ========================= */
export const findValidCouponForUserById = async (userId, couponId) => {
  if (!couponId) return null;
  return await Coupon.findOne({
    _id: couponId,
    assignedTo: userId,
    used: false,
    expiresAt: { $gt: new Date() },
  }).lean();
};

/** =========================
 * Helper: mark a user coupon used (existing)
 * ========================= */
export const markCouponUsed = async (couponId) => {
  if (!couponId) return;
  await Coupon.findOneAndUpdate({ _id: couponId, used: false }, { $set: { used: true } });
};

/** =========================
 * Helper: find a usable coupon by code for a given user (existing)
 * Supports both percentage and free_gift (type checked later at checkout)
 * ========================= */
export const findValidCouponForUser = async (userId, rawCode) => {
  const code = String(rawCode || "").toUpperCase().trim();
  if (!code) return null;

  const now = new Date();

  // 1) user-scoped first
  let coupon = await Coupon.findOne({
    scope: "user",
    assignedTo: userId,
    code,
    used: false,
    expiresAt: { $gt: now },
    $or: [{ startAt: null }, { startAt: { $lte: now } }],
  }).lean();
  if (coupon) return { coupon, kind: "user" };

  // 2) global
  coupon = await Coupon.findOne({
    scope: "global",
    code,
    expiresAt: { $gt: now },
    $or: [{ startAt: null }, { startAt: { $lte: now } }],
  }).lean();
  if (!coupon) return null;

  // enforce caps
  const [total, userCount] = await Promise.all([
    coupon.maxRedemptions ? CouponRedemption.countDocuments({ couponId: coupon._id }) : Promise.resolve(0),
    CouponRedemption.countDocuments({ couponId: coupon._id, userId }),
  ]);

  if (coupon.perUserLimit && userCount >= coupon.perUserLimit) return null;
  if (coupon.maxRedemptions && total >= coupon.maxRedemptions) return null;

  return { coupon, kind: "global" };
};

/** =========================
 * Helper: after successful payment, finalize redemption (existing)
 * ========================= */
export const finalizeCouponRedemption = async ({ coupon, userId, orderId }) => {
  if (!coupon) return;

  if (coupon.scope === "user") {
    await Coupon.findOneAndUpdate({ _id: coupon._id, used: false }, { $set: { used: true } });
    return;
  }
  await CouponRedemption.create({ couponId: coupon._id, userId, orderId });
};

/** =========================
 * ADMIN: list coupons (existing)
 * GET /api/v1/admin/coupons?scope=global|user&assignedTo=<userId>&code=ABC&page=1&pageSize=20
 * ========================= */
export const adminListCoupons = catchAsyncErrors(async (req, res) => {
  const { scope, assignedTo, code } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));

  const filter = {};
  if (scope) filter.scope = scope;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (code) filter.code = String(code).toUpperCase().trim();

  const [items, total] = await Promise.all([
    Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Coupon.countDocuments(filter),
  ]);

  res.json({ success: true, page, pageSize, total, coupons: items });
});

/** =========================
 * USER: claim a code from GLOBAL to personal (existing)
 * POST /api/v1/me/coupons/claim { code }
 * ========================= */
export const claimMyCoupon = catchAsyncErrors(async (req, res, next) => {
  let { code } = req.body || {};
  code = String(code || "").toUpperCase().trim();
  if (!code) return next(new ErrorHandler("code is required", 400));

  const userId = req.user._id;
  const now = new Date();

  const existing = await Coupon.findOne({
    scope: "user",
    assignedTo: userId,
    code,
    used: false,
    expiresAt: { $gt: now },
  }).lean();
  if (existing) {
    return res.status(200).json({ success: true, coupon: existing, alreadyHad: true });
  }

  const found = await findValidCouponForUser(userId, code);
  if (!found || found.coupon.scope !== "global") {
    return next(new ErrorHandler("Invalid or expired code", 400));
  }
  const global = found.coupon;

  const [total, userCount] = await Promise.all([
    global.maxRedemptions ? CouponRedemption.countDocuments({ couponId: global._id }) : Promise.resolve(0),
    CouponRedemption.countDocuments({ couponId: global._id, userId }),
  ]);
  if (global.perUserLimit && userCount >= global.perUserLimit) {
    return next(new ErrorHandler("You have already used this code", 409));
  }
  if (global.maxRedemptions && total >= global.maxRedemptions) {
    return next(new ErrorHandler("This promotion has ended", 409));
  }

  // Personal copy: copy all relevant fields (type + payload)
  const base = {
    scope: "user",
    code,
    assignedTo: userId,
    expiresAt: new Date(global.expiresAt),
    note: `claimed from global ${global._id}`,
    createdBy: req.user?._id,
  };

  const payload =
    global.type === "free_gift"
      ? { type: "free_gift", giftProduct: global.giftProduct, giftQty: global.giftQty, threshold: global.threshold }
      : {
          type: "percentage",
          percentage: global.percentage,
          maxDeduction: global.maxDeduction,
        };

  try {
    const coupon = await Coupon.create({ ...base, ...payload });
    return res.status(201).json({ success: true, coupon });
  } catch (e) {
    if (e?.code === 11000) {
      const dup = await Coupon.findOne({ scope: "user", assignedTo: userId, code }).lean();
      if (dup) return res.status(200).json({ success: true, coupon: dup, alreadyHad: true });
    }
    throw e;
  }
});

/** =========================
 * USER: validate a code (existing)
 * GET /api/v1/me/coupons/validate?code=FALL15
 * ========================= */
export const validateMyCouponCode = catchAsyncErrors(async (req, res) => {
  const code = String(req.query.code || "").toUpperCase().trim();
  if (!code) return res.json({ valid: false });

  const found = await findValidCouponForUser(req.user._id, code);
  if (!found) return res.json({ valid: false });

  const { coupon } = found;
  res.json({
    valid: true,
    coupon: {
      _id: coupon._id,
      code: coupon.code,
      type: coupon.type,
      scope: coupon.scope,
      expiresAt: coupon.expiresAt,
      percentage: coupon.type === "percentage" ? coupon.percentage : undefined,
      maxDeduction: coupon.type === "percentage" ? coupon.maxDeduction ?? undefined : undefined,
      giftProduct: coupon.type === "free_gift" ? coupon.giftProduct : undefined,
      giftQty: coupon.type === "free_gift" ? coupon.giftQty : undefined,
      threshold: coupon.type === "free_gift" ? coupon.threshold : undefined,
    },
  });
});
