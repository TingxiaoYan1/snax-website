import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { userApi } from "./userApi";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/v1",
    credentials: "include",
  }),
  keepUnusedDataFor: 30,
  endpoints: (builder) => ({
    register: builder.mutation({
      query: (body) => ({ url: "/register", method: "POST", body }),
    }),

    login: builder.mutation({
      query: (body) => ({ url: "/login", method: "POST", body }),
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          await dispatch(userApi.endpoints.getMe.initiate(null));
        } catch (e) {}
      },
    }),

    logout: builder.query({ query: () => "/logout" }),

    // NEW: send 6-char code to email
    sendVerificationCode: builder.mutation({
      query: (body) => ({ url: "/email/code/send", method: "POST", body }), // { email }
    }),

    // NEW: verify that 6-char code
    verifyEmailCode: builder.mutation({
      query: (body) => ({ url: "/email/code/verify", method: "POST", body }), // { email, code }
    }),
  }),
});

export const {
  useRegisterMutation,
  useLoginMutation,
  useLazyLogoutQuery,
  useSendVerificationCodeMutation,
  useVerifyEmailCodeMutation,
} = authApi;