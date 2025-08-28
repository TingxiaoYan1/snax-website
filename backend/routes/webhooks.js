import express from "express";
import { squareWebhook } from "../controllers/paymentControllers.js";



const router = express.Router();
// IMPORTANT: router expects raw body already given by app.use above.
router.post("/", squareWebhook);

router.get("/_health", (req, res) => res.status(200).send("OK"));



export default router;