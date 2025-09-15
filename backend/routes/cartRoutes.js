import express from "express";
import {
  getMyCart,
  upsertCartItem,
  removeCartItem,
  clearCart,
  mergeCart,
  setCartBulk,
} from "../controllers/cartController.js";
import { isAuthenticatedUser } from "../middlewares/auth.js";

const router = express.Router();
router.use(isAuthenticatedUser); // all require login

router.get("/me/cart", getMyCart);
router.post("/me/cart", upsertCartItem);
router.patch("/me/cart", setCartBulk);
router.delete("/me/cart/:productId", removeCartItem);
router.delete("/me/cart", clearCart);
router.post("/me/cart/merge", mergeCart);

export default router;
