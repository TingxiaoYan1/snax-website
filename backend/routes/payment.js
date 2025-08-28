import express from "express";
const router = express.Router();

import {isAuthenticatedUser} from "../middlewares/auth.js";
import { squareCheckoutSession, squarePing } from "../controllers/paymentControllers.js";

/*router.get("/payment/_probe", (req, res) => {
  res.status(200).json({
    ok: true,
    method: req.method,
    path: req.originalUrl,
    hasCookieToken: !!(req.cookies && (req.cookies.token || req.cookies.jwt)),
    cookies: req.cookies,                    // TEMP: remove after debug
    authHeader: req.headers.authorization || null,
    contentType: req.headers["content-type"] || null,
    bodyKeys: Object.keys(req.body || {}),
    userSeen: !!req.user,
  });
});

// 🔍 NEW: check middleware only
router.get("/payment/_whoami", isAuthenticatedUser, (req, res) => {
  res.json({ ok: true, user: req.user || null });
});

// Optional: a Square ping you can call directly from your app
//router.get("/payment/_square_ping", isAuthenticatedUser, squarePing);*/

// normal route (keep your middleware here if you want)
router.post("/payment/square_checkout",  isAuthenticatedUser, squareCheckoutSession);

export default router;