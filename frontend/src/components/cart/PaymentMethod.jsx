import React, { useEffect, useState } from "react";
import MetaData from "../layout/MetaData";
import CheckoutSteps from "./CheckoutSteps";
import { useSelector } from "react-redux";
import { useCreateNewOrderMutation } from "../../redux/api/orderApi";
import { useCreateSquareCheckoutMutation } from "../../redux/api/paymentsApi"; // NEW
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const PaymentMethod = () => {
  const [method, setMethod] = useState("");
  const navigate = useNavigate();

  const { shippingInfo } = useSelector((state) => state.cart);

  const [createNewOrder, { error: codError, isSuccess: codSuccess }] =
    useCreateNewOrderMutation();

  const [
    createSquareCheckout,
    { data: checkoutData, error: checkoutError, isLoading: isStartingCheckout },
  ] = useCreateSquareCheckoutMutation();

  // Square result/err handler
  useEffect(() => {
    if (checkoutData?.url) {
      sessionStorage.setItem("squareReturnStart", String(Date.now()));
      window.location.assign(checkoutData.url);
    }
    if (checkoutError) {
      toast.error(checkoutError?.data?.message || "Failed to start checkout");
    }
  }, [checkoutData, checkoutError]);

  // COD result
  useEffect(() => {
    if (codError) {
      toast.error(codError?.data?.message || "Failed to create COD order");
    }
    if (codSuccess) {
      window.location.assign("/me/orders?order_success=1");
    }
  }, [codError, codSuccess]);

  const submitHandler = async (e) => {
    e.preventDefault();
    if (!method) {
      toast.error("Please select a payment method");
      return;
    }

    if (method === "COD") {
      // Server recomputes totals from the server cart; no money fields sent
      await createNewOrder({
        shippingInfo,
        paymentMethod: "COD",
        paymentInfo: { status: "Not Paid" },
      }).unwrap();
    }

    if (method === "Card") {
      // Backend reads server cart and returns a Square Hosted Checkout URL
      await createSquareCheckout({ shippingInfo });
    }
  };

  return (
    <>
      <MetaData title={"Payment Method"} />
      <CheckoutSteps shipping confirmOrder payment />
      <div className="row wrapper">
        <div className="col-10 col-lg-5">
          <form className="shadow rounded bg-body" onSubmit={submitHandler}>
            <h2 className="mb-4">Select Payment Method</h2>

            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="payment_mode"
                id="codradio"
                value="COD"
                onChange={() => setMethod("COD")}
              />
              <label className="form-check-label" htmlFor="codradio">
                Cash on Delivery
              </label>
            </div>

            <div className="form-check">
              <input
                className="form-check-input"
                type="radio"
                name="payment_mode"
                id="cardradio"
                value="Card"
                onChange={() => setMethod("Card")}
              />
              <label className="form-check-label" htmlFor="cardradio">
                Card - VISA, MasterCard
              </label>
            </div>

            <button
              id="shipping_btn"
              type="submit"
              className="btn py-2 w-100"
              disabled={isStartingCheckout}
            >
              CONTINUE
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default PaymentMethod;
