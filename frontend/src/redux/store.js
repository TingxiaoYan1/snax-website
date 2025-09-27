import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./features/userSlice";
import cartReducer from "./features/cartSlice";
import langReducer from "./features/langSlice";
import couponUseReducer from "./features/couponSlice";

import { productApi } from "./api/productsApi";
import { authApi } from "./api/authApi";
import { userApi } from "./api/userApi";
import { orderApi } from "./api/orderApi";

import { cartApi } from "./api/cartApi";
import { paymentsApi } from "./api/paymentsApi";
import { couponsApi } from "./api/couponsApi";

export const store = configureStore({
  reducer: {
    auth: userReducer,
    cart: cartReducer,
    lang: langReducer,
    couponUse: couponUseReducer,
    [productApi.reducerPath]: productApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [userApi.reducerPath]: userApi.reducer,
    [orderApi.reducerPath]: orderApi.reducer,
    [cartApi.reducerPath]: cartApi.reducer,
    [paymentsApi.reducerPath]: paymentsApi.reducer,
    [couponsApi.reducerPath]: couponsApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat([
      productApi.middleware,
      authApi.middleware,
      userApi.middleware,
      orderApi.middleware,
      cartApi.middleware,
      paymentsApi.middleware,
      couponsApi.middleware,
    ]),
});
