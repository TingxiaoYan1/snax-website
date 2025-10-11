import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import ErrorHandler from "../utils/errorHandler.js";
import Cart from "../models/cart.js";
import { calculateOrderCost } from "../utils/orderCost.js";
import Coupon from "../models/coupon.js";
import { findValidCouponForUser } from "./couponControllers.js";

// Create new Order => /api/v1/orders/new
export const newOrder = catchAsyncErrors(async (req, res, next) => {
  const { shippingInfo, paymentMethod, paymentInfo, couponId, couponCode } = req.body;

  // 1) Load server-side cart
  const cart = await Cart.findOne({ user: req.user._id })
    .populate({ path: "items.product", select: "name price stock images" });

  if (!cart || cart.items.length === 0) {
    return next(new ErrorHandler("Your cart is empty", 400));
  }

  // 2) Normalize items from cart + clamp by stock
  const orderItems = cart.items
    .filter((ci) => (ci.product?.stock ?? 0) > 0)
    .map((ci) => ({
      product: ci.product._id,
      name: ci.product.name,
      price: Number(ci.product.price),
      image: ci.product.images?.[0]?.url,
      quantity: Math.min(ci.quantity, ci.product.stock ?? 0),
      variant: ci.variant,
    }));

  if (orderItems.length === 0) {
    return next(new ErrorHandler("All items are out of stock", 400));
  }

  // 3) Resolve at most ONE coupon
  if (couponId && couponCode) {
    return next(new ErrorHandler("Only one coupon may be applied", 400));
  }

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
    applied = found; // { coupon, kind }
  }

  // 4) Apply coupon BEFORE calculating tax (tax is computed on discounted items)
  const preSubtotal = orderItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
  const pct = applied ? Number(applied.coupon.percentage) : 0;
  const cap = applied?.coupon?.maxDeduction != null ? Number(applied.coupon.maxDeduction) : Infinity;
  const nominal = (preSubtotal * pct) / 100;
  const desiredDiscount = applied ? Math.min(nominal, cap) : 0;
  const effectivePct = preSubtotal > 0 ? (desiredDiscount * 100) / preSubtotal : 0; // 0..pct
  const factor = 1 - effectivePct / 100;

  const discountedItems = orderItems.map((i) => ({
    price: Number((Number(i.price) * factor).toFixed(2)),
    quantity: Number(i.quantity),
  }));

  // 5) Compute money on the server from DISCOUNTED items (tax after deduction)
  const {
    itemsPrice: itemsPriceStr,
    shippingPrice: shippingAmount,
    taxPrice: taxAmount,
  } = calculateOrderCost(discountedItems);

  const itemsPrice = Number(itemsPriceStr); // utils returns itemsPrice as a fixed string
  const discountAmount = Number(desiredDiscount.toFixed(2));

  // Snapshot coupon terms (optional but useful)
  const couponSnapshot = applied
    ? {
        couponId: applied.coupon._id,
        code: applied.coupon.code,
        percentage: applied.coupon.percentage,
        scope: applied.coupon.scope,
        expiresAt: applied.coupon.expiresAt,
        maxDeduction: applied.coupon.maxDeduction ?? null,
        effectivePct: Number(effectivePct.toFixed(6)),
        preDiscountItemsPrice: Number(preSubtotal.toFixed(2)),
      }
    : null;

  const appliedCouponId = applied ? applied.coupon._id : null;

  const totalAmount = Number((itemsPrice + shippingAmount + taxAmount).toFixed(2));

  // 6) Create order with server-computed amounts (+ coupon snapshot)
  const order = await Order.create({
    user: req.user._id,
    orderItems, // keep original item prices; discount is captured separately in amounts + couponSnapshot
    shippingInfo, // <-- uses the NEW shipping fields sent by frontend
    itemsPrice,        // DISCOUNTED items subtotal
    taxAmount,         // tax computed on discounted items
    shippingAmount,    // computed from discounted items subtotal (same behavior in Square)
    discountAmount,
    totalAmount,
    paymentMethod,
    paymentInfo,
    appliedCouponId,
    couponSnapshot,
    orderStatus: "pending_payment", // NOTE: if your schema enum does not include this, adjust as needed
  });

  // 7) Clear server cart
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });

  res.status(200).json({ order });
});

// Get current user orders => /api/v1/me/orders/
export const myOrders = catchAsyncErrors(async (req, res) => {
  const orders = await Order.find({ user: req.user._id });
  res.status(200).json({ orders });
});

// Get Order details => /api/v1/orders/:id
export const getOrderDetails = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate("user", "name email");
  if (!order) return next(new ErrorHandler("No Order found with this Id", 404));
  res.status(200).json({ order });
});

// Get All Orders - ADMIN => /api/v1/admin/orders
export const allOrders = catchAsyncErrors(async (req, res) => {
  const orders = await Order.find();
  res.status(200).json({ orders });
});

// Update Orders - ADMIN => /api/v1/admin/orders/:id
export const updateOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorHandler("No Order found with this Id", 404));

  // Update products stock
  let productNotFound = false;
  for (const item of order.orderItems) {
    const product = await Product.findById(item?.product?.toString());
    if (!product) {
      productNotFound = true;
      break;
    }
    product.stock = product.stock - item.quantity;
    await product.save({ validateBeforeSave: false });
  }
  if (productNotFound) {
    return next(new ErrorHandler("No Product found with one or more IDs.", 404));
  }

  order.orderStatus = req.body.status;
  order.deliveredAt = Date.now();
  await order.save();
  res.status(200).json({ success: true });
});

// Delete Order => /api/v1/admin/orders/:id
export const deleteOrder = catchAsyncErrors(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) return next(new ErrorHandler("No Order found with this Id", 404));
  await order.deleteOne();
  res.status(200).json({ success: true });
});

// helpers unchanged…
async function getSalesDate(startDate, endDate) {
  const salesData = await Order.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        },
        totalSales: { $sum: "$totalAmount" },
        numOrders: { $sum: 1 },
      },
    },
  ]);

  const salesMap = new Map();
  let totalSales = 0;
  let totalNumOrders = 0;

  salesData.forEach((entry) => {
    const date = entry?._id.date;
    const sales = entry?.totalSales;
    const numOrders = entry?.numOrders;
    salesMap.set(date, { sales, numOrders });
    totalSales += sales;
    totalNumOrders += numOrders;
  });

  const datesBetween = getDatesBetween(startDate, endDate);

  const finalSalesData = datesBetween.map((date) => ({
    date,
    sales: (salesMap.get(date) || { sales: 0 }).sales,
    numOrders: (salesMap.get(date) || { numOrders: 0 }).numOrders,
  }));

  return { salesData: finalSalesData, totalSales, totalNumOrders };
}

function getDatesBetween(startDate, endDate) {
  const dates = [];
  let currentDate = new Date(startDate);
  while (currentDate <= new Date(endDate)) {
    const formattedDate = currentDate.toISOString().split("T")[0];
    dates.push(formattedDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
}

// Get Sales Data => /api/v1/admin/get_sales
export const getSales = catchAsyncErrors(async (req, res) => {
  const startDate = new Date(req.query.startDate);
  const endDate = new Date(req.query.endDate);
  startDate.setUTCHours(0, 0, 0, 0);
  endDate.setUTCHours(23, 59, 59, 999);
  const { salesData, totalSales, totalNumOrders } = await getSalesDate(startDate, endDate);
  res.status(200).json({
    totalSales,
    totalNumOrders,
    sales: salesData,
  });
});
