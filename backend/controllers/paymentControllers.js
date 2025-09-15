import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import { calculateOrderCost } from "../utils/orderCost.js";
import Cart from "../models/cart.js";
import Order from "../models/order.js";
import ErrorHandler from "../utils/errorHandler.js";
import Product from "../models/product.js";

// backend/controllers/paymentControllers.js
import { Client } from "square/legacy";
import crypto from "crypto";

function getSquareClient() {
  const token = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("[SQUARE] Missing SQUARE_ACCESS_TOKEN");
  }

  // Use bearerAuthCredentials for the legacy client, it’s safest.
  return new Client({
    bearerAuthCredentials: { accessToken: token },
    environment: "sandbox", // change to 'production' when you go live
  });
}

export const squarePing = async (req, res ) => {
  try {
    const client = getSquareClient();
    const { result } = await client.locationsApi.listLocations();
    res.json({ ok: true, locations: result.locations?.map(l => l.id) });
  } catch (e) {
    console.log("[SQUARE PING ERROR]", e?.statusCode, e?.result || e?.message);
    res
      .status(e?.statusCode || 500)
      .json({ from: "squarePing", status: e?.statusCode, result: e?.result, message: e?.message });
  }
};

export const squareCheckoutSession = catchAsyncErrors(async (req, res,next) => {
  try {
    console.log("[Square] ENV:", process.env.SQUARE_ENV);
    console.log("[Square] Token prefix:", process.env.SQUARE_ACCESS_TOKEN?.slice(0, 8));
    console.log("[Square] Location:", process.env.SQUARE_LOCATION_ID);
    const client = getSquareClient();
    const checkoutApi = client.checkoutApi;

    const cart = await Cart.findOne({ user: req.user._id })
      .populate({ path: "items.product", select: "name price stock images" });
    
    if (!cart) {
      console.warn("Square checkout: cart not found for user", req.user?._id);
    } else {
      console.log("Square checkout: raw cart items", cart.items?.map(i => ({
        product: String(i.product?._id || i.product),
        name: i.product?.name,
        price: i.product?.price,
        qty: i.quantity,
        stock: i.product?.stock
      })));
    }
      
    if (!cart || cart.items.length === 0) {
      return next(new ErrorHandler("Your cart is empty", 400));
    }


    const orderItems = cart.items.map(ci => ({
      name: ci.product.name,
      quantity: String(ci.quantity),
      price: ci.product.price,
      image: ci.product.images?.[0]?.url,
      productId: ci.product._id,
    }));

    const { itemsPrice, shippingPrice, taxPrice } = calculateOrderCost(
      orderItems.map(({ price, quantity }) => ({ price, quantity }))
    );

    const lineItems = orderItems.map(i => ({
      name: i.name,
      note: JSON.stringify({ productId: i.productId, image: i.image }),
      quantity: i.quantity,
      basePriceMoney: { amount: Math.round(Number(i.price) * 100), currency: "USD" },
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

    const order = {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems,
      referenceId: req.user._id.toString(),
      metadata: {
        shippingInfo: JSON.stringify({
          address: req.body?.shippingInfo?.address,
          city: req.body?.shippingInfo?.city,
          phoneNo: req.body?.shippingInfo?.phoneNo,
          zipCode: req.body?.shippingInfo?.zipCode,
          country: req.body?.shippingInfo?.country
        })
      }
    };

    const { result } = await checkoutApi.createPaymentLink({
      idempotencyKey: crypto.randomUUID(),
      order,
      checkoutOptions: {
        //redirectUrl: `${process.env.FRONTEND_URL}/me/orders?order_success=true`,
        redirectUrl: `${process.env.FRONTEND_URL}/square/return`,
        merchantSupportEmail: "support@snaxplanet.com",
      },
    });

    res.json({ url: result.paymentLink.url });
  } catch (e) {
    const status = e?.statusCode || e?.status || 500;
    const detail =
      e?.result?.errors?.[0]?.detail ||
      e?.message ||
      "Square checkout failed";

    console.error("Square checkout error:", {
      status,
      message: e?.message,
      detail,
      result: e?.result,
    });

    return res.status(status).json({ message: detail, code: e?.result?.errors?.[0]?.code });
  }
});





// Convert Square order line items → your app's orderItems (skip shipping/tax rows)
function toCartItemsFromSquareOrder(order) {
  const lineItems = order?.lineItems || [];
  return lineItems
    .filter(li => {
      const n = (li?.name || "").toLowerCase();
      return !n.includes("shipping") && !n.includes("tax");
    })
    .map(li => ({
      product: undefined, // wire this up later via metadata if you need it
      name: li.name,
      price: (li?.basePriceMoney?.amount ?? 0) / 100,
      quantity: Number(li?.quantity ?? 1),
      image: undefined,
    }));
}

export const squareWebhook = catchAsyncErrors(async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;

  let event;
  try {
    event = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
  } catch {
    return res.status(400).json({ received: true });
  }

  const header = req.get("x-square-signature") || req.get("X-Square-Signature") || "";
  const providedSig = header.split(",")[0].trim();
  const notificationUrl = `${process.env.PUBLIC_BASE_URL}/api/v1/webhooks/square`;

  // Your account uses SHA-1 (per your logs)
  const expectedSig = crypto
    .createHmac("sha1", process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)
    .update(notificationUrl + (typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody)))
    .digest("base64");
  
  console.log("[WH] URL used:", notificationUrl);
  console.log("[WH] provided:", providedSig);
  console.log("[WH] expected:", expectedSig);


  if (providedSig !== expectedSig) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  if (event?.type !== "payment.updated") return res.status(200).json({ received: true });

  const payment = event?.data?.object?.payment;
  if (!payment || payment.status !== "COMPLETED") {
    return res.status(200).json({ received: true });
  }

  // These were missing before
  const client = getSquareClient();
  const squareOrderId = payment?.order_id;
  console.log("[WH] payment.order_id:", squareOrderId);
 
  let sqOrder = null;
  if (squareOrderId) {
    try {
      const { result } = await client.ordersApi.retrieveOrder(squareOrderId);
      sqOrder = result?.order || null;
      /*console.log("[WH] retrieveOrder:", {
        id: sqOrder?.id,
        loc: sqOrder?.locationId,
        ref: sqOrder?.referenceId,
        lineItems: sqOrder?.lineItems?.length || 0,
        total: sqOrder?.totalMoney?.amount,
      });*/
    } catch (e) {
      console.error("[WH] retrieveOrder error:", e?.statusCode, e?.message, e?.result);
    }
  }

    let shippingInfo = {};
    if (sqOrder?.metadata?.shippingInfo) {
        shippingInfo = JSON.parse(sqOrder.metadata.shippingInfo);
        console.log(shippingInfo);
    }

    let itemsPrice = 0, shippingAmount = 0, taxAmount = 0, orderItems = [];

    if (sqOrder) {
        for (const li of sqOrder.lineItems || []) {
            const name = (li?.name || "").toLowerCase();
            const cents  = Number(li?.basePriceMoney?.amount ?? 0);
            const price  = cents / 100;
            const qty = Number(li?.quantity ?? 1);


            if (name.includes("shipping")) {
                shippingAmount += price;
            } else if (name.includes("tax")) {
                taxAmount += price;
            } else {
                itemsPrice += price * qty;
                let meta = {};
                try {
                    meta = li?.note ? JSON.parse(li.note) : {};
                } catch (err) {
                    meta = {};
                }
                orderItems.push({
                    product: meta.productId  /* if you saved productId into note */ || undefined,
                    name: li?.name,
                    price,
                    quantity: qty,
                    image: meta.image,
                });
            }
        }
    }

    const totalCents  = Number(sqOrder?.totalMoney?.amount ?? payment?.total_money?.amount ?? 0);
    const totalAmount = totalCents / 100;
    const user = sqOrder?.referenceId || null;

    itemsPrice = Number(itemsPrice.toFixed(2));

    const paymentInfo = {
        id: payment?.id,
        status: "Paid",
    };

     // ✅ De-dupe ASAP
    const existing = await Order.findOne({ "paymentInfo.id": paymentInfo.id });
    if (existing) {
        console.log("[WH] duplicate webhook; order already exists for", paymentInfo.id);
    return res.status(200).json({ success: true });
    }

    const orderData = {
    shippingInfo,          // fill if you later add fulfillments
    orderItems,
    itemsPrice,
    taxAmount,
    shippingAmount,
    totalAmount,
    paymentInfo,
    paymentMethod: "Card",
    user,
    };

    console.log("[WH] creating Order with:", orderData);
    const order = await Order.create(orderData);
    for (const it of order.orderItems || []) {
      if (it.product) {
        await Product.updateOne({ _id: it.product }, { $inc: { stock: -it.quantity } });
      }
    }
    if (user) {
      await Cart.updateOne({ user }, { $set: { items: [] } });
    }
    return res.status(200).json({ success: true });
});