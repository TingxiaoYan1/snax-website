import Cart from "../models/cart.js";
import Product from "../models/product.js";
import ErrorHandler from "../utils/errorHandler.js";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";

// helper: ensure a cart exists for the user
async function ensureCart(userId) {
  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, items: [] } },
    { upsert: true, new: true }
  );
  return cart;
}

// GET /api/v1/me/cart
export const getMyCart = catchAsyncErrors(async (req, res) => {
  const cart = await ensureCart(req.user._id);
  await cart.populate({ path: "items.product", select: "name price stock images" });
  const items = cart.items.map(ci => ({
    product: ci.product?._id,
    name: ci.product?.name,
    price: ci.product?.price,
    stock: ci.product?.stock,
    image: ci.product?.images?.[0]?.url,
    quantity: ci.quantity,
    variant: ci.variant,
  }));
  res.status(200).json({ items, updatedAt: cart.updatedAt });
});

// POST /api/v1/me/cart  { productId, quantity, variant? }
export const upsertCartItem = catchAsyncErrors(async (req, res, next) => {
  const { productId, quantity, variant } = req.body;
  if (!productId || !Number.isInteger(quantity) || quantity < 1) {
    return next(new ErrorHandler("Invalid productId/quantity", 400));
  }

  const product = await Product.findById(productId).select("stock").lean();
  if (!product) return next(new ErrorHandler("Product not found", 404));
  const finalQty = Math.max(1, Math.min(quantity, product.stock ?? 0));
  if ((product.stock ?? 0) <= 0) {
    // if OOS, just remove
    await Cart.updateOne({ user: req.user._id }, { $pull: { items: { product: productId, ...(variant ? { variant } : {}) } } });
    return getMyCart(req, res, next);
  }

  // 1) try update existing line
  const match = { user: req.user._id, "items.product": productId };
  if (variant) match["items.variant"] = variant;

  const updateRes = await Cart.updateOne(
    match,
    { $set: { "items.$.quantity": finalQty } }
  );

  // 2) if no existing line matched, push a new one
  if (updateRes.matchedCount === 0) {
    await Cart.updateOne(
      { user: req.user._id },
      { $push: { items: { product: productId, quantity: finalQty, ...(variant ? { variant } : {}) } } }
    );
  }

  return getMyCart(req, res, next);
});

// PATCH /api/v1/me/cart  { items: [{ product, quantity, variant? }, ...] }  (bulk set)
export const setCartBulk = catchAsyncErrors(async (req, res, next) => {
  const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
  const ids = incoming.map(i => i.product).filter(Boolean);
  const products = await Product.find({ _id: { $in: ids } }).select("stock").lean();
  const stockMap = new Map(products.map(p => [String(p._id), p.stock ?? 0]));

  const clean = [];
  for (const it of incoming) {
    const stock = stockMap.get(String(it.product)) ?? 0;
    const q = Math.max(1, Math.min(it.quantity || 1, stock));
    if (stock > 0) clean.push({ product: it.product, quantity: q, ...(it.variant ? { variant: it.variant } : {}) });
  }

  await ensureCart(req.user._id);
  await Cart.updateOne({ user: req.user._id }, { $set: { items: clean } });
  return getMyCart(req, res, next);
});

// DELETE /api/v1/me/cart/:productId  (?variant=...)
export const removeCartItem = catchAsyncErrors(async (req, res, next) => {
  const { productId } = req.params;
  const { variant } = req.query;
  await Cart.updateOne(
    { user: req.user._id },
    { $pull: { items: { product: productId, ...(variant ? { variant } : {}) } } }
  );
  return getMyCart(req, res, next);
});

// DELETE /api/v1/me/cart
export const clearCart = catchAsyncErrors(async (req, res) => {
  await ensureCart(req.user._id);
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  res.status(200).json({ items: [] });
});

// POST /api/v1/me/cart/merge  { items: [{ product, quantity, variant? }, ...] }
export const mergeCart = catchAsyncErrors(async (req, res, next) => {
  const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
  // start from current
  const cart = await ensureCart(req.user._id);
  const map = new Map(cart.items.map(i => [`${i.product}${i.variant ? `|${i.variant}` : ""}`, i.quantity]));
  // prefer MAX(local, existing)
  for (const it of incoming) {
    const key = `${it.product}${it.variant ? `|${it.variant}` : ""}`;
    map.set(key, Math.max(map.get(key) || 0, it.quantity || 1));
  }
  // write back via bulk setter to clamp to stock
  const normalized = [...map.entries()].map(([k, quantity]) => {
    const [product, variant] = k.split("|");
    return { product, quantity, ...(variant ? { variant } : {}) };
  });
  req.body.items = normalized;
  return setCartBulk(req, res, next);
});
