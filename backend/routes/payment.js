import express from "express";
import { isAuthenticatedUser } from "../middlewares/auth.js";
import {
  squareCheckoutSession,
  squareWebhook,
} from "../controllers/paymentControllers.js";

const router = express.Router();

router.post("/square/checkout", isAuthenticatedUser, squareCheckoutSession);

export default router;
