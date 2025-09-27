import { createSlice } from "@reduxjs/toolkit";

const persisted = (() => {
  try { return JSON.parse(localStorage.getItem("selectedCoupon")) || null; }
  catch { return null; }
})();

const couponSlice = createSlice({
  name: "couponUse",
  initialState: {
    selectedCoupon: persisted, // { _id, code, percentage, maxDeduction?, scope, expiresAt }
  },
  reducers: {
    setSelectedCoupon(state, action) {
      state.selectedCoupon = action.payload || null;
      localStorage.setItem("selectedCoupon", JSON.stringify(state.selectedCoupon));
    },
    clearSelectedCoupon(state) {
      state.selectedCoupon = null;
      localStorage.removeItem("selectedCoupon");
    },
  },
});

export const { setSelectedCoupon, clearSelectedCoupon } = couponSlice.actions;
export default couponSlice.reducer;
