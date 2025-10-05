import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const couponsApi = createApi({
  reducerPath: "couponsApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/api/v1", credentials: "include" }),
  tagTypes: ["Coupons"],
  endpoints: (builder) => ({
    // --- ADMIN ---
    createCoupon: builder.mutation({
      query: (body) => ({ url: "/admin/coupons", method: "POST", body }),
      invalidatesTags: [{ type: "Coupons", id: "LIST" }],
    }),
    createGlobalCoupon: builder.mutation({
      query: (body) => ({ url: "/admin/coupons/global", method: "POST", body }),
      invalidatesTags: [{ type: "Coupons", id: "LIST" }],
    }),
    getAdminCoupons: builder.query({
      query: (params) => {
        const qs = new URLSearchParams(params || {}).toString();
        return `/admin/coupons${qs ? `?${qs}` : ""}`;
      },
      providesTags: (res) =>
        res?.coupons?.length
          ? [...res.coupons.map((c) => ({ type: "Coupons", id: c._id })), { type: "Coupons", id: "LIST" }]
          : [{ type: "Coupons", id: "LIST" }],
    }),
    adminDeleteCoupon: builder.mutation({
      query: (couponId) => ({ url: `/admin/coupons/${couponId}`, method: "DELETE" }),
      invalidatesTags: (r, e, id) => [{ type: "Coupons", id }, { type: "Coupons", id: "LIST" }],
    }),

    // --- USER ---
    claimMyCoupon: builder.mutation({
      // Accept a string and wrap it into an object for the backend
      query: (code) => ({
        url: "/me/coupons/claim",
        method: "POST",
        body: { code },   // << important
      }),
      invalidatesTags: [{ type: "Coupons", id: "MY_LIST" }],
    }),
        validateMyCode: builder.query({
      query: ({ code }) => `/me/coupons/validate?code=${encodeURIComponent(code)}`,
    }),
    getMyCoupons: builder.query({
      query: (params) => {
        const qs = new URLSearchParams(params || {}).toString();
        return `/me/coupons${qs ? `?${qs}` : ""}`;
      },
      providesTags: (res) =>
        res?.coupons?.length
          ? [...res.coupons.map((c) => ({ type: "Coupons", id: c._id })), { type: "Coupons", id: "MY_LIST" }]
          : [{ type: "Coupons", id: "MY_LIST" }],
    }),

    // --- NEW: create user-scoped FREE-GIFT coupon ---
    createUserFreeGiftCoupon: builder.mutation({
      query: (body) => ({
        url: "/admin/coupons/freegift/user",
        method: "POST",
        body,
      }),
      invalidatesTags: ["AdminCoupons"], // if you use tags
    }),

    // --- NEW: create global FREE-GIFT coupon ---
    createGlobalFreeGiftCoupon: builder.mutation({
      query: (body) => ({
        url: "/admin/coupons/freegift/global",
        method: "POST",
        body,
      }),
      invalidatesTags: ["AdminCoupons"],
    }),
  }),
});

export const {
  // admin
  useCreateCouponMutation,
  useCreateGlobalCouponMutation,
  useGetAdminCouponsQuery,
  useLazyGetAdminCouponsQuery,
  useAdminDeleteCouponMutation,
  // user
  useClaimMyCouponMutation,
  useValidateMyCodeQuery,
  useLazyValidateMyCodeQuery,
  useGetMyCouponsQuery,
  useCreateUserFreeGiftCouponMutation,
  useCreateGlobalFreeGiftCouponMutation,
} = couponsApi;
