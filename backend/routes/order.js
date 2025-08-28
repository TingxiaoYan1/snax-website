import express from "express";
const router = express.Router();

import {isAuthenticatedUser, authorizeRoles} from "../middlewares/auth.js";
import { 
    newOrder, 
    getOrderDetails, 
    myOrders,
    allOrders,
    updateOrder,
    deleteOrder,
    getSales, } from "../controllers/orderControllers.js";

router.route("/orders/new").post(isAuthenticatedUser, newOrder);
router.route("/orders/:id").get(isAuthenticatedUser, getOrderDetails);
router.route("/me/orders").get(isAuthenticatedUser, myOrders);

router
    .route("/admin/get_sales")
    .get(isAuthenticatedUser, authorizeRoles("admin") ,getSales);
router
    .route("/admin/orders")
    .get(isAuthenticatedUser, authorizeRoles("admin") ,allOrders);
router
    .route("/admin/orders/:id")
    .put(isAuthenticatedUser, authorizeRoles("admin") ,updateOrder)
    .delete(isAuthenticatedUser, authorizeRoles("admin") ,deleteOrder);


export default router;