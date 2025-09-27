import React, { useMemo, useState } from "react";
import MetaData from "../layout/MetaData";
import { useSelector, useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import CheckoutSteps from "./CheckoutSteps";
import { useGetCartQuery } from "../../redux/api/cartApi";
import { useGetMyCouponsQuery } from "../../redux/api/couponsApi";
import { setSelectedCoupon, clearSelectedCoupon } from "../../redux/features/couponSlice";

const ConfirmOrder = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { shippingInfo } = useSelector((state) => state.cart);
  const selectedCoupon = useSelector((s) => s.couponUse.selectedCoupon);

  const { data: cartData } = useGetCartQuery();
  const cartItems = cartData?.items || [];

  // Only show valid (not expired, not used) coupons
  const { data: myCouponsData } = useGetMyCouponsQuery({ onlyValid: true });
  const myCoupons = myCouponsData?.coupons || [];

  // --- totals client-side (must match server rules) ---
  const { itemsPrice, shippingPrice, discountAmount, taxableBase, taxPrice, totalPrice } = useMemo(() => {
    const itemsPriceRaw = cartItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const itemsPrice = Number(itemsPriceRaw.toFixed(2));

    const pct = selectedCoupon ? Number(selectedCoupon.percentage) : 0;
    const maxDed = selectedCoupon && selectedCoupon.maxDeduction != null
      ? Number(selectedCoupon.maxDeduction)
      : Infinity;

    const rawDiscount = selectedCoupon ? (itemsPrice * pct) / 100 : 0;
    const discountAmount = Number(Math.min(rawDiscount, isFinite(maxDed) ? maxDed : rawDiscount).toFixed(2));

    // shipping rule same as your helper
    const shippingPrice = itemsPrice > 200 ? 0 : 5;

    const taxableBase = Math.max(0, itemsPrice - discountAmount);
    const taxPrice = Number((0.15 * taxableBase).toFixed(2)); // tax AFTER discount
    const totalPrice = Number((taxableBase + shippingPrice + taxPrice).toFixed(2));

    return { itemsPrice, shippingPrice, discountAmount, taxableBase, taxPrice, totalPrice };
  }, [cartItems, selectedCoupon]);

  return (
    <>
      <MetaData title={"Confirm Order"} />
      <CheckoutSteps shipping confirmOrder />

      <div className="row d-flex justify-content-between">
        {/* Left: shipping + items */}
        <div className="col-12 col-lg-8 mt-5 order-confirm">
          <h4 className="mb-3">Shipping Info</h4>
          <p><b>Name:</b> {user?.name}</p>
          <p><b>Phone:</b> {shippingInfo?.phoneNo}</p>
          <p className="mb-4">
            <b>Address:</b> {shippingInfo?.address}, {shippingInfo?.city}, {shippingInfo?.zipCode}, {shippingInfo?.country}
          </p>

          <hr />
          <h4 className="mt-4">Your Cart Items:</h4>

          {cartItems?.map((item) => (
            <React.Fragment key={item.product}>
              <hr />
              <div className="cart-item my-1">
                <div className="row">
                  <div className="col-4 col-lg-2">
                    <img src={item?.image} alt={item?.name} height="45" width="65" />
                  </div>
                  <div className="col-5 col-lg-6">
                    <Link to={`/product/${item.product}`}>{item?.name}</Link>
                  </div>
                  <div className="col-4 col-lg-4 mt-4 mt-lg-0">
                    <p>{item?.quantity} x ${item?.price} = <b>${(item?.quantity * item?.price).toFixed(2)}</b></p>
                  </div>
                </div>
              </div>
              <hr />
            </React.Fragment>
          ))}
        </div>

        {/* Right: summary + coupon selector */}
        <div className="col-12 col-lg-3 my-4">
          <div id="order_summary">
            <h4>Order Summary</h4>
            <hr />

            {/* Coupon selector */}
            <div className="mb-3">
              <label className="form-label"><b>Coupon</b></label>
              <select
                className="form-select"
                value={selectedCoupon?._id || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) {
                    dispatch(clearSelectedCoupon());
                  } else {
                    const c = myCoupons.find((x) => x._id === v);
                    if (c) dispatch(setSelectedCoupon(c));
                  }
                }}
              >
                <option value="">-- No coupon --</option>
                {myCoupons.map((c) => (
                  <option value={c._id} key={c._id}>
                    {c.code} ({c.percentage}% off{c.maxDeduction != null ? `, up to $${Number(c.maxDeduction).toFixed(2)}` : ""}) — exp {new Date(c.expiresAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                You can also <Link to="/me/fetch_coupon">claim a code</Link> if you have one.
              </small>
            </div>

            <p>Subtotal: <span className="order-summary-values">${itemsPrice.toFixed(2)}</span></p>
            {selectedCoupon && (
              <p>Discount ({selectedCoupon.percentage}%): <span className="order-summary-values">- ${discountAmount.toFixed(2)}</span></p>
            )}
            <p>Shipping: <span className="order-summary-values">${shippingPrice.toFixed(2)}</span></p>
            <p>Tax: <span className="order-summary-values">${taxPrice.toFixed(2)}</span></p>

            <hr />
            <p>Total: <span className="order-summary-values">${totalPrice.toFixed(2)}</span></p>
            <hr />

            <Link to="/payment_method" id="checkout_btn" className="btn btn-primary w-100">
              Proceed to Payment
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmOrder;
