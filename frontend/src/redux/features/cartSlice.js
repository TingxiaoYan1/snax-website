import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  shippingInfo: localStorage.getItem("shippingInfo")
    ? JSON.parse(localStorage.getItem("shippingInfo"))
    : {
        country: "",
        firstName: "",
        lastName: "",
        address: "",
        apartment: "",
        city: "",
        state: "",
        zip: "",
        phone: "",
      },
};

export const cartSlice = createSlice({
  name: "cartSlice",
  initialState,
  reducers: {
    saveShippingInfo: (state, action) => {
      state.shippingInfo = action.payload;
      localStorage.setItem("shippingInfo", JSON.stringify(state.shippingInfo));
    },
    clearShippingInfo: (state) => {
      state.shippingInfo = {
        country: "",
        firstName: "",
        lastName: "",
        address: "",
        apartment: "",
        city: "",
        state: "",
        zip: "",
        phone: "",
      };
      localStorage.removeItem("shippingInfo");
    },
  },
});

export default cartSlice.reducer;
export const { saveShippingInfo, clearShippingInfo } = cartSlice.actions;
