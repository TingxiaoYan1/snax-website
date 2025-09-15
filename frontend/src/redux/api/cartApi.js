import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const cartApi = createApi({
  reducerPath: "cartApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1",
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.token || localStorage.getItem("token");
      if (token) headers.set("authorization", `Bearer ${token}`);
      return headers;
    },
    credentials: "include",
  }),
  tagTypes: ["Cart"],
  endpoints: (builder) => ({
    getCart: builder.query({
      query: () => ({ url: "/me/cart", method: "GET" }),
      providesTags: ["Cart"],
    }),
    upsertCartItem: builder.mutation({
      query: ({ productId, quantity, variant }) => ({
        url: "/me/cart",
        method: "POST",
        body: { productId, quantity, ...(variant ? { variant } : {}) },
      }),
      invalidatesTags: ["Cart"],
    }),
    removeCartItem: builder.mutation({
      query: ({ productId, variant }) => ({
        url: `/me/cart/${productId}${variant ? `?variant=${encodeURIComponent(variant)}` : ""}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Cart"],
    }),
    clearCart: builder.mutation({
      query: () => ({ url: "/me/cart", method: "DELETE" }),
      invalidatesTags: ["Cart"],
    }),
    mergeCart: builder.mutation({
      query: (items) => ({ url: "/me/cart/merge", method: "POST", body: { items } }),
      invalidatesTags: ["Cart"],
    }),
  }),
});

export const {
  useGetCartQuery,
  useUpsertCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
  useMergeCartMutation,
} = cartApi;
