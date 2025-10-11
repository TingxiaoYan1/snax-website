// backend/controllers/productControllers.js
import mongoose from "mongoose";
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import Product from "../models/product.js";
import ErrorHandler from "../utils/errorHandler.js";
import APIFilters from "../utils/apiFilters.js";
import Order from "../models/order.js";
import { delete_file, upload_file } from "../utils/cloudinary.js";
import {
  CATEGORY_L1,
  CATEGORY_L2_BY_L1,
  isValidCategoryPair,
} from "../constants/categories.js";
import {
  getTagSchema,
  DEFAULT_NUMERIC_TAG_KEYS,
} from "../constants/tags.js";

/* =========================================================================
 * Helpers
 * ========================================================================= */

function buildMatchFromQuery(q) {
  const match = {};
  if (q.l1) match["categories.l1"] = q.l1;
  if (q.l2) match["categories.l2"] = q.l2;

  // Hide blindbox unless explicitly targeted
  const includeBlindbox = q.includeBlindbox === "1" || q.l1 === "blindbox";
  if (!includeBlindbox && !match["categories.l1"]) {
    match["categories.l1"] = { $ne: "blindbox" };
  }
  return match;
}

function normalizeTags(input) {
  const out = { numbers: {}, booleans: {} };

  if (input?.numbers && typeof input.numbers === "object") {
    for (const [k, v] of Object.entries(input.numbers)) {
      const n = Math.floor(Number(v));
      if (Number.isFinite(n) && n >= 0) out.numbers[k] = n;
    }
  }

  if (input?.booleans && typeof input.booleans === "object") {
    for (const [k, v] of Object.entries(input.booleans)) {
      const b = v === true || v === "true" || v === 1 || v === "1";
      out.booleans[k] = b;
    }
  }

  for (const key of DEFAULT_NUMERIC_TAG_KEYS) {
    if (out.numbers[key] == null) out.numbers[key] = 0;
  }

  return out;
}

//Public: list products (keyword + price/ratings + L1/L2), blindbox hidden
// GET /api/v1/products?l1=&l2=&keyword=&price[gte]=&price[lte]=&ratings[gte]
export const getProducts = catchAsyncErrors(async (req, res, next) => {
  const resPerPage = 8;

  // Start APIFilters with a Query (Product.find()), never a Model
  const apiFilters = new APIFilters(Product.find(), req.query).search().filters();

  const match = buildMatchFromQuery(req.query);

  // Count
  let products = await apiFilters.query.find(match);
  const filteredProductsCount = products.length;

  // Pagination
  apiFilters.pagination(resPerPage);
  products = await apiFilters.query.clone().find(match);

  return res.status(200).json({
    resPerPage,
    filteredProductsCount,
    products,
  });
});



function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}
function decodeCursor(s) {
  try { return JSON.parse(Buffer.from(String(s||""), "base64url").toString("utf8")); }
  catch { return null; }
}
export const getExploreProducts = catchAsyncErrors(async (req, res) => {
  const limitRaw = parseInt(req.query.limit || "12", 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 12, 1), 48);

  // same L1/L2 + blindbox behavior as elsewhere
  const match = buildMatchFromQuery(req.query);

  // ---- sort selection: newest (default) | price-asc | price-desc
  const sortKey = String(req.query.sort || "newest").toLowerCase();
  let sort = { _id: -1 };
  let cursorCond = {};

  const cursorRaw = String(req.query.cursor || "").trim();

  if (sortKey === "price-asc") {
    sort = { price: 1, _id: -1 }; // tiebreak by _id for stability
    const cur = decodeCursor(cursorRaw);
    if (cur?.id && cur?.price !== undefined && mongoose.isValidObjectId(cur.id)) {
      cursorCond = {
        $or: [
          { price: { $gt: cur.price } },
          { price: cur.price, _id: { $lt: new mongoose.Types.ObjectId(cur.id) } },
        ],
      };
    }
  } else if (sortKey === "price-desc") {
    sort = { price: -1, _id: -1 };
    const cur = decodeCursor(cursorRaw);
    if (cur?.id && cur?.price !== undefined && mongoose.isValidObjectId(cur.id)) {
      cursorCond = {
        $or: [
          { price: { $lt: cur.price } },
          { price: cur.price, _id: { $lt: new mongoose.Types.ObjectId(cur.id) } },
        ],
      };
    }
  } else {
    // newest (default): simple _id cursor
    if (cursorRaw && mongoose.isValidObjectId(cursorRaw)) {
      cursorCond = { _id: { $lt: new mongoose.Types.ObjectId(cursorRaw) } };
    }
  }

  const filter = Object.keys(cursorCond).length ? { $and: [match, cursorCond] } : match;

  // fetch one extra to know hasMore
  const docs = await Product.find(filter).sort(sort).limit(limit + 1).lean();

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;

  // nextCursor depends on sort type
  let nextCursor = null;
  if (items.length) {
    const last = items[items.length - 1];
    if (sortKey === "price-asc" || sortKey === "price-desc") {
      nextCursor = encodeCursor({ price: last.price ?? 0, id: String(last._id) });
    } else {
      nextCursor = String(last._id);
    }
  }

  return res.status(200).json({ items, nextCursor, hasMore });
});

export const getRandomProducts = catchAsyncErrors(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 4, 1), 24);

  const excludeParam = String(req.query.exclude || "").trim();
  const excludeIds = excludeParam
    ? excludeParam
        .split(",")
        .map((s) => s.trim())
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id))
    : [];

  const inStockOnly =
    req.query.inStockOnly === "1" ||
    req.query.inStockOnly === "true" ||
    req.query.inStockOnly === 1 ||
    req.query.inStockOnly === true;

  // Case-insensitive hide of blindbox; include docs where l1 is missing
  const notBlindbox = {
    $or: [
      { "categories.l1": { $exists: false } },
      { "categories.l1": { $not: /^blindbox$/i } },
    ],
  };

  // Base match
  const baseMatch = { ...notBlindbox };
  if (excludeIds.length) baseMatch._id = { $nin: excludeIds };
  if (inStockOnly) baseMatch.stock = { $gt: 0 };

  const projection = {
    name: 1,
    price: 1,
    images: 1,
    categories: 1,
    stock: 1,
  };

  // Primary attempt (respect inStockOnly)
  let products = await Product.aggregate([
    { $match: baseMatch },
    { $sample: { size: limit } },
    { $project: projection },
  ]);

  // Fallback: if nothing found AND inStockOnly was on, retry without stock filter
  if (products.length === 0 && inStockOnly) {
    const fallbackMatch = { ...notBlindbox };
    if (excludeIds.length) fallbackMatch._id = { $nin: excludeIds };

    products = await Product.aggregate([
      { $match: fallbackMatch },
      { $sample: { size: limit } },
      { $project: projection },
    ]);
  }

  return res.status(200).json({ count: products.length, products });
});

/* =========================================================================
 * Admin: create product
 * ========================================================================= */
export const newProduct = catchAsyncErrors(async (req, res) => {
  req.body.user = req.user._id;

  const categories = req.body.categories;
  if (!categories?.l1) {
    return res.status(400).json({ message: "categories.l1 is required" });
  }
  if (!isValidCategoryPair(categories.l1, categories.l2 ?? null)) {
    return res
      .status(400)
      .json({
        message: `Invalid category pair: l1="${categories.l1}" l2="${categories.l2 || ""}"`,
      });
  }
  req.body.categories = { l1: categories.l1, l2: categories.l2 ?? null };

  if (req.body.tags) req.body.tags = normalizeTags(req.body.tags);
  else req.body.tags = normalizeTags({});

  const product = await Product.create(req.body);
  return res.status(200).json({ product });
});

/* =========================================================================
 * Admin: get product details
 * ========================================================================= */
export const getProductDetails = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req?.params?.id).populate("reviews.user");
  if (!product) return next(new ErrorHandler("Product not found", 404));
  return res.status(200).json({ product });
});

/* =========================================================================
 * Admin: list products (no filters)
 * ========================================================================= */
export const getAdminProducts = catchAsyncErrors(async (req, res) => {
  const products = await Product.find();
  return res.status(200).json({ products });
});

/* =========================================================================
 * Admin: update product
 * ========================================================================= */
export const updateProduct = catchAsyncErrors(async (req, res, next) => {
  let product = await Product.findById(req?.params?.id);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const nextCategories = req.body.categories;
  if (nextCategories) {
    if (!nextCategories.l1) {
      return res.status(400).json({ message: "categories.l1 is required" });
    }
    if (!isValidCategoryPair(nextCategories.l1, nextCategories.l2 ?? null)) {
      return res
        .status(400)
        .json({
          message: `Invalid category pair: l1="${nextCategories.l1}" l2="${nextCategories.l2 || ""}"`,
        });
    }
    req.body.categories = { l1: nextCategories.l1, l2: nextCategories.l2 ?? null };
  }

  if (req.body.tags) req.body.tags = normalizeTags(req.body.tags);

  product = await Product.findByIdAndUpdate(req?.params?.id, req.body, { new: true });
  return res.status(200).json({ product });
});

/* =========================================================================
 * Admin: images
 * ========================================================================= */
export const uploadProductImages = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req?.params?.id);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const uploader = async (image) => upload_file(image, "Snack Planet/products");
  const urls = await Promise.all((req?.body?.images || []).map(uploader));

  product.images.push(...urls);
  await product.save();

  return res.status(200).json({ product });
});

export const deleteProductImages = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req?.params?.id);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const isDeleted = await delete_file(req.body.imgId);
  if (isDeleted) {
    product.images = (product.images || []).filter(
      (img) => img.public_id !== req.body.imgId
    );
  }

  await product.save();
  return res.status(200).json({ product });
});

/* =========================================================================
 * Admin: delete product
 * ========================================================================= */
export const deleteProduct = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req?.params?.id);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  for (const img of product.images || []) {
    await delete_file(img.public_id);
  }
  await product.deleteOne();
  return res.status(200).json({ message: "Product Deleted" });
});

/* =========================================================================
 * Reviews
 * ========================================================================= */
export const createProductReview = catchAsyncErrors(async (req, res, next) => {
  const { rating, comment, productId } = req.body;

  const product = await Product.findById(productId);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const existing = product?.reviews?.find(
    (r) => r.user.toString() === req?.user?._id.toString()
  );
  if (existing) {
    product.reviews.forEach((r) => {
      if (r?.user?.toString() === req?.user?._id.toString()) {
        r.comment = comment;
        r.rating = rating;
      }
    });
  } else {
    product.reviews.push({ user: req?.user?._id, rating: Number(rating), comment });
    product.numOfReviews = product.reviews.length;
  }

  product.ratings =
    product.reviews.reduce((acc, it) => it.rating + acc, 0) / product.reviews.length;

  await product.save({ validateBeforeSave: false });
  return res.status(200).json({ success: true });
});

export const getProductReviews = catchAsyncErrors(async (req, res, next) => {
  const product = await Product.findById(req.query.id).populate("reviews.user");
  if (!product) return next(new ErrorHandler("Product not found", 404));
  return res.status(200).json({ reviews: product.reviews });
});

export const deleteReview = catchAsyncErrors(async (req, res, next) => {
  let product = await Product.findById(req.query.productId);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const reviews = (product.reviews || []).filter(
    (review) => review._id.toString() !== req?.query?.id.toString()
  );
  const numOfReviews = reviews.length;
  const ratings =
    numOfReviews === 0
      ? 0
      : reviews.reduce((acc, it) => it.rating + acc, 0) / numOfReviews;

  product = await Product.findByIdAndUpdate(
    req.query.productId,
    { reviews, numOfReviews, ratings },
    { new: true }
  );
  return res.status(200).json({ success: true, product });
});

export const canUserReview = catchAsyncErrors(async (req, res) => {
  const orders = await Order.find({
    user: req.user._id,
    "orderItems.product": req.query.productId,
  });
  return res.status(200).json({ canReview: orders.length > 0 });
});

/* =========================================================================
 * Catalog initialization endpoints
 * ========================================================================= */
export const getInitializedCategories = catchAsyncErrors(async (req, res) => {
  return res.status(200).json({ l1: CATEGORY_L1, l2ByL1: CATEGORY_L2_BY_L1 });
});

export const getInitializedTags = catchAsyncErrors(async (req, res) => {
  return res.status(200).json(getTagSchema());
});
