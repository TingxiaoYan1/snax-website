// src/redux/api/paymentsApi.js
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const paymentsApi = createApi({
  reducerPath: "paymentsApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1",
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token || localStorage.getItem("token");
      if (token) headers.set("authorization", `Bearer ${token}`);
      return headers;
    },
    credentials: "include",
  }),
  endpoints: (builder) => ({
    createSquareCheckout: builder.mutation({
      // Must match your backend route for square checkout session
      query: (body) => ({ url: "/square/checkout", method: "POST", body }),
    }),
  }),
});

export const { useCreateSquareCheckoutMutation } = paymentsApi;
