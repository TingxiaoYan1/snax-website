// backend/routes/user.js
import express from "express";
import { isAuthenticatedUser } from "../middlewares/auth.js";
import {
  getSearchHistory,
  addSearchKeyword,
  clearSearchHistory,
  deleteOneSearchKeyword,
} from "../controllers/userControllers.js";

const router = express.Router(); 

router
  .route("/me/search-history")
  .get(isAuthenticatedUser, getSearchHistory)
  .post(isAuthenticatedUser, addSearchKeyword)
  .delete(isAuthenticatedUser, clearSearchHistory);

router
  .route("/me/search-history/one")
  .delete(isAuthenticatedUser, deleteOneSearchKeyword);

export default router;
