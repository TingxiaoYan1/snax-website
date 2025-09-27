import React, { useEffect, useMemo, useState } from "react";
import MetaData from "../layout/MetaData";
import CheckoutSteps from "./CheckoutSteps";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

// RTK Query hooks (existing in your repo)
import { useCreateNewOrderMutation } from "../../redux/api/orderApi";
import { useCreateSquareCheckoutMutation } from "../../redux/api/paymentsApi";
import { clearSelectedCoupon } from "../../redux/features/couponSlice";

// Helper to extract a readable error message
const errMsg = (e) =>
  e?.data?.message || e?.error || e?.message || (typeof e === "string" ? e : "Something went wrong");

const PaymentMethod = () => {
  // Force the user to choose; don't default to Card or COD
  const [method, setMethod] = useState(""); // "COD" | "Card"
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // We read shipping info and the selected coupon from Redux
  const { shippingInfo } = useSelector((s) => s.cart);
  const selectedCoupon = useSelector((s) => s.couponUse?.selectedCoupon) || null;

  // Backends
  const [createNewOrder, { isLoading: creatingOrder, isSuccess: codSuccess, error: codError }] =
    useCreateNewOrderMutation();
  const [createSquareCheckout, { isLoading: startingSquare, error: squareError }] =
    useCreateSquareCheckoutMutation();

  // show backend errors nicely
  useEffect(() => {
    if (codError) toast.error(errMsg(codError));
    if (squareError) toast.error(errMsg(squareError));
  }, [codError, squareError]);

  // Sanity check: build a clean shipping payload the backend expects
  const shippingPayload = useMemo(
    () => ({
      address: shippingInfo?.address || "",
      city: shippingInfo?.city || "",
      phoneNo: shippingInfo?.phoneNo || "",
      zipCode: shippingInfo?.zipCode || "",
      country: shippingInfo?.country || "",
    }),
    [shippingInfo]
  );

  // Build the coupon fields the backend expects: exactly ONE of these
  const couponFields = useMemo(() => {
    if (!selectedCoupon) return {};
    // Prefer id when we have it; otherwise send the code
    if (selectedCoupon._id) return { couponId: selectedCoupon._id };
    if (selectedCoupon.code) return { couponCode: String(selectedCoupon.code).toUpperCase() };
    return {};
  }, [selectedCoupon]);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!method) {
      toast.error("Please choose a payment method");
      return;
    }

    // Basic guard for required shipping fields (Square metadata uses them)
    if (!shippingPayload.address || !shippingPayload.city || !shippingPayload.country) {
      toast.error("Shipping info is incomplete. Please fill your address first.");
      return;
    }

    try {
      if (method === "COD") {
        // Server recomputes totals and applies coupon (tax after discount)
        await createNewOrder({
          shippingInfo: shippingPayload,
          paymentMethod: "COD",
          paymentInfo: { status: "Not Paid" },
          ...couponFields,
        }).unwrap();
        dispatch(clearSelectedCoupon());

        toast.success("Order placed with Cash on Delivery");
        navigate("/me/orders");
        return;
      }

      if (method === "Card") {
        // Ask server to create a Square hosted-checkout link
        // unwrap() returns the RESPONSE BODY (your backend sends { url })
        const { url } = await createSquareCheckout({
          shippingInfo: shippingPayload,
          ...couponFields,
        }).unwrap();

        if (!url) {
          toast.error("Checkout link not created");
          return;
        }
        // Redirect to Square
        window.location.href = url;
        return;
      }

      toast.error("Unsupported payment method");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <>
      <MetaData title="Payment Method" />
      <CheckoutSteps shipping confirmOrder payment />

      <div className="row d-flex justify-content-center">
        <div className="col-12 col-lg-5">
          <form className="shadow rounded bg-body p-4" onSubmit={onSubmit}>
            <h2 className="mb-4">Select Payment Method</h2>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="radio"
                name="payment_method"
                id="pay_cod"
                value="COD"
                checked={method === "COD"}
                onChange={() => setMethod("COD")}
              />
              <label className="form-check-label" htmlFor="pay_cod">
                Cash on Delivery (COD)
              </label>
            </div>

            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="radio"
                name="payment_method"
                id="pay_card"
                value="Card"
                checked={method === "Card"}
                onChange={() => setMethod("Card")}
              />
              <label className="form-check-label" htmlFor="pay_card">
                Card (via Square)
              </label>
            </div>

            {/* show a small summary of the coupon being sent */}
            {selectedCoupon ? (
              <div className="alert alert-success">
                Using coupon: <strong>{selectedCoupon.code}</strong>
                {selectedCoupon.percentage ? ` (${selectedCoupon.percentage}% off)` : ""}
                {selectedCoupon.maxDeduction != null ? ` — max $${Number(selectedCoupon.maxDeduction).toFixed(2)}` : ""}
                <div className="small text-muted">You can change this on the Confirm Order page.</div>
              </div>
            ) : (
              <div className="alert alert-info small">
                No coupon selected. You can pick one on the Confirm Order page.
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-100 mt-2"
              disabled={creatingOrder || startingSquare}
            >
              {creatingOrder || startingSquare ? "Starting checkout…" : "CONTINUE"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default PaymentMethod;
