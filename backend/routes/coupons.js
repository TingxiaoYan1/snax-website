import express from "express";
import {
  giveCoupon,
  getMyCoupons,
  getMyCouponById,
  adminDeleteCoupon,
  adminCreateGlobalCoupon,
  adminListCoupons,
  claimMyCoupon,
} from "../controllers/couponControllers.js";
import { isAuthenticatedUser, authorizeRoles } from "../middlewares/auth.js";

const router = express.Router();

// Admin endpoints
router.post("/admin/coupons", isAuthenticatedUser, authorizeRoles("admin"), giveCoupon);
router.delete("/admin/coupons/:couponId", isAuthenticatedUser, authorizeRoles("admin"), adminDeleteCoupon);
router.post("/admin/coupons/global", isAuthenticatedUser, authorizeRoles("admin"), adminCreateGlobalCoupon);
router.get("/admin/coupons", isAuthenticatedUser, authorizeRoles("admin"), adminListCoupons);

// User self-service
router.get("/me/coupons", isAuthenticatedUser, getMyCoupons);
router.get("/me/coupons/:couponId", isAuthenticatedUser, getMyCouponById);
router.post("/me/coupons/claim", isAuthenticatedUser, claimMyCoupon);

export default router;