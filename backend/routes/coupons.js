import express from "express";
import {
  giveCoupon,                     // existing (percentage, user-scoped)
  getMyCoupons,
  getMyCouponById,
  adminDeleteCoupon,
  adminCreateGlobalCoupon,        // existing (percentage, global)
  adminListCoupons,
  claimMyCoupon,

  // NEW:
  giveFreeGiftCouponToUser,       // user-scoped free_gift
  adminCreateGlobalFreeGiftCoupon // global free_gift
} from "../controllers/couponControllers.js";
import { isAuthenticatedUser, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

// Admin endpoints
router.post("/admin/coupons", isAuthenticatedUser, authorizeRoles("admin"), giveCoupon);
router.post("/admin/coupons/global", isAuthenticatedUser, authorizeRoles("admin"), adminCreateGlobalCoupon);

// NEW: admin endpoints for FREE-GIFT coupons (separate place)
router.post("/admin/coupons/freegift/user", isAuthenticatedUser, authorizeRoles("admin"), giveFreeGiftCouponToUser);
router.post("/admin/coupons/freegift/global", isAuthenticatedUser, authorizeRoles("admin"), adminCreateGlobalFreeGiftCoupon);

router.delete("/admin/coupons/:couponId", isAuthenticatedUser, authorizeRoles("admin"), adminDeleteCoupon);
router.get("/admin/coupons", isAuthenticatedUser, authorizeRoles("admin"), adminListCoupons);

// User self-service
router.get("/me/coupons", isAuthenticatedUser, getMyCoupons);
router.get("/me/coupons/:couponId", isAuthenticatedUser, getMyCouponById);
router.post("/me/coupons/claim", isAuthenticatedUser, claimMyCoupon);

export default router;
