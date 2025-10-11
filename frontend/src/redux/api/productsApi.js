import { createApi, fetchBaseQuery} from "@reduxjs/toolkit/query/react";

export const productApi = createApi({
    reducerPath: 'productApi',
    baseQuery: fetchBaseQuery({ baseUrl: "/api/v1", credentials: "include" }),
    tagTypes: ["Product", "AdminProducts", "Reviews"],
    //how long keeping the api
    keepUnusedDataFor: 30,
    endpoints: (builder) => ({
        getProducts: builder.query({
            query: (params) => {
                // Build query params for L1/L2 + keep price/ratings/keyword
                const qp = {
                page: params?.page,
                keyword: params?.keyword,
                "price[gte]": params?.min,
                "price[lte]": params?.max,
                "ratings[gte]": params?.ratings,
                };
                // New hierarchical filters
                if (params?.l1) qp.l1 = params.l1;
                if (params?.l2) qp.l2 = params.l2;
                // Backward compat: legacy category -> { l1:"other", l2:<category> }
                if (!qp.l1 && !qp.l2 && params?.category) {
                    qp.l1 = "other";
                    qp.l2 = params.category;
                }
                return { url: "/products", params: qp };
            },
        }),
        getExploreProducts: builder.query({
            query: ({ l1, l2, limit, cursor, sort }) => {
                const p = new URLSearchParams();
                if (l1 && l1 !== "all") p.set("l1", String(l1));
                if (l2) p.set("l2", String(l2));
                if (limit) p.set("limit", String(limit));
                if (cursor) p.set("cursor", String(cursor)); // opaque; just pass it back
                if (sort) p.set("sort", String(sort));       // "newest" | "price-asc" | "price-desc"
                return { url: `/products/explore?${p.toString()}` };
            },
        }),
        // inside createApi({ endpoints: (builder) => ({ ... }) })
        getRandomProducts: builder.query({
            query: ({ limit = 4, exclude = [], inStockOnly = false, seed } = {}) => {
                // Build a stable, all-string query string
                const params = new URLSearchParams();
                params.set("limit", String(limit));

                // exclude as CSV of ObjectIds
                const ex = Array.isArray(exclude) ? exclude : [exclude];
                const exCSV = ex
                .map((v) => (v != null ? String(v) : ""))
                .filter((v) => v)
                .join(",");
                if (exCSV) params.set("exclude", exCSV);

                params.set("inStockOnly", inStockOnly ? "1" : "0");
                params.set("seed", String(seed ?? Date.now()));

                return { url: `/products/random?${params.toString()}` };
            },
            keepUnusedDataFor: 0,
        }),
        getInitializedCategories: builder.query({
            query: () => ({
                url: "/products/categories",
                method: "GET",
            }),
        }),
        getInitializedTags: builder.query({
            query: () => ({ 
                url: "/products/tags/schema", 
                method: "GET" 
            }),
        }),
        getProductDetails: builder.query({
            query: (id) => `/products/${id}`,
            providesTags: ["Product"],
        }),
        submitReview: builder.mutation({
            query(body) {
                return {
                url: "/reviews",
                method: "PUT",
                body,
                };
            },
            invalidatesTags: ["Product"],
        }),
        canUserReview: builder.query({
            query: (productId) => `/can_review/?productId=${productId}`,
        }),
        getAdminProducts: builder.query({
            query: () => `/admin/products`,
            providesTags: ["AdminProducts"],
        }),
        createProduct: builder.mutation({
            query(body) {
                return {
                url: "/admin/products",
                method: "POST",
                body,
                };
            },
            invalidatesTags: ["AdminProducts"],
        }),
        updateProduct: builder.mutation({
            query({id,body}) {
                return {
                url: `/admin/products/${id}`,
                method: "PUT",
                body,
                };
            },
            invalidatesTags: [ "Product","AdminProducts"],
        }),
        uploadProductImages: builder.mutation({
            query({id,body}) {
                return {
                url: `/admin/products/${id}/upload_images`,
                method: "PUT",
                body,
                };
            },
            invalidatesTags: [ "Product"],
        }),
        deleteProductImages: builder.mutation({
            query({id,body}) {
                return {
                url: `/admin/products/${id}/delete_images`,
                method: "PUT",
                body,
                };
            },
            invalidatesTags: [ "Product"],
        }),
        deleteProduct: builder.mutation({
            query(id) {
                return {
                url: `/admin/products/${id}`,
                method: "DELETE",
                };
            },
            invalidatesTags: [ "AdminProducts"],
        }),
        getProductReviews: builder.query({
            query: (productId) => `/reviews?id=${productId}`,
            providesTags: ["Reviews"],
        }),
        deleteReview: builder.mutation({
            query({productId, id}) {
                return {
                url: `/admin/reviews?productId=${productId}&id=${id}`,
                method: "DELETE",
                };
            },
            invalidatesTags: [ "Reviews"],
        }),
    }),
});

export const { 
    useGetProductsQuery,
    useLazyGetProductsQuery,
    useGetProductDetailsQuery, 
    useSubmitReviewMutation, 
    useCanUserReviewQuery,
    useGetAdminProductsQuery,
    useCreateProductMutation,
    useUpdateProductMutation,
    useUploadProductImagesMutation,
    useDeleteProductImagesMutation,
    useDeleteProductMutation,
    useLazyGetProductReviewsQuery,
    useDeleteReviewMutation,
    useGetInitializedCategoriesQuery,
    useGetInitializedTagsQuery,
    useGetRandomProductsQuery,
    useLazyGetRandomProductsQuery,
    useGetExploreProductsQuery,
    useLazyGetExploreProductsQuery,
} = productApi;