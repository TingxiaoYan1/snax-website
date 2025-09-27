import { createSlice } from "@reduxjs/toolkit";

const initialLocale = (() => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("locale");
    if (saved === "en" || saved === "zh") return saved;
  }
  return "en"; // default
})();

const langSlice = createSlice({
  name: "lang",
  initialState: { locale: initialLocale },
  reducers: {
    setLocale: (state, { payload }) => {
      state.locale = payload === "zh" ? "zh" : "en";
      if (typeof window !== "undefined") localStorage.setItem("locale", state.locale);
    },
    toggleLocale: (state) => {
      state.locale = state.locale === "en" ? "zh" : "en";
      if (typeof window !== "undefined") localStorage.setItem("locale", state.locale);
    },
  },
});

export const { setLocale, toggleLocale } = langSlice.actions;
export const selectLocale = (state) => state.lang.locale;
export default langSlice.reducer;
