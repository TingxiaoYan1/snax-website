// backend/controllers/userControllers.js
import catchAsyncErrors from "../middlewares/catchAsyncErrors.js";
import ErrorHandler from "../utils/errorHandler.js";
import User from "../models/user.js";

/** Helpers **/
const LIMIT = 40;
const normalize = (s) => String(s || "").trim();


export const addSearchKeyword = catchAsyncErrors(async (req, res, next) => {
  const term = normalize(req?.body?.term);
  if (!term) return next(new ErrorHandler("Search term is required", 400));

  const user = await User.findById(req?.user?._id).select("searchHistory");
  if (!user) return next(new ErrorHandler("User not found", 404));

  user.searchHistory = Array.isArray(user.searchHistory) ? user.searchHistory : [];
  user.searchHistory = user.searchHistory.filter(
    (k) => String(k?.term || "").toLowerCase() !== term.toLowerCase()
  );
  user.searchHistory.unshift({ term, at: new Date() });
  if (user.searchHistory.length > LIMIT) user.searchHistory = user.searchHistory.slice(0, LIMIT);

  await user.save({ validateBeforeSave: true });

  res.status(200).json({
    success: true,
    searchHistory: user.searchHistory,
  });
});

//  Get user's search history
//  Route: GET /api/v1/me/search-history
export const getSearchHistory = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req?.user?._id).select("searchHistory");
  if (!user) return next(new ErrorHandler("User not found", 404));

  res.status(200).json({
    success: true,
    searchHistory: user.searchHistory || [],
  });
});


// Clear user's search history
// Route: DELETE /api/v1/me/search-history
export const clearSearchHistory = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req?.user?._id).select("searchHistory");
  if (!user) return next(new ErrorHandler("User not found", 404));

  user.searchHistory = [];
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true });
});

//Remove a specific keyword by its public_id (timestamp+term) or by exact term
export const deleteOneSearchKeyword = catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req?.user?._id).select("searchHistory");
  if (!user) return next(new ErrorHandler("User not found", 404));

  const term = normalize(req?.body?.term);
  const atIso = req?.body?.at ? new Date(req.body.at).toISOString() : null;

  if (!term && !atIso) {
    return next(new ErrorHandler("Provide term or at to delete one entry", 400));
  }

  user.searchHistory = (user.searchHistory || []).filter((k) => {
    const matchTerm = term ? String(k?.term || "").toLowerCase() === term.toLowerCase() : false;
    const matchAt = atIso ? new Date(k?.at).toISOString() === atIso : false;
    // keep if it does NOT match either provided selector (i.e., delete when it matches)
    return !(matchTerm || matchAt);
  });

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    searchHistory: user.searchHistory,
  });
});
