import React from "react";
import MetaData from "../layout/MetaData";
import Loader from "../layout/Loader";
import { Link, useNavigate } from "react-router-dom";
import {
  useGetCartQuery,
  useUpsertCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
} from "../../redux/api/cartApi";
import toast from "react-hot-toast";
import { calculateOrderCost } from '../../helpers/helpers';

const money = (n) => Number(n || 0).toFixed(2);

const Cart = () => {
  const navigate = useNavigate();

  // Server cart
  const { data, isLoading, isError, error } = useGetCartQuery();
  const [upsertCartItem, { isLoading: isUpdating }] = useUpsertCartItemMutation();
  const [removeCartItem, { isLoading: isRemoving }] = useRemoveCartItemMutation();
  const [clearCart, { isLoading: isClearing }] = useClearCartMutation();

  const cartItems = data?.items || [];

  // ---- quantities & estimates for display only (server is authoritative) ----
  const units = cartItems.reduce((s, i) => s + (i.quantity || 0), 0);
  const {itemsPrice,
        shippingPrice, 
        taxPrice, 
        totalPrice} = calculateOrderCost(cartItems);

  const setItemToCart = async (item, newQty) => {
    try {
      await upsertCartItem({
        productId: item?.product,
        quantity: newQty,
        variant: item?.variant,
      }).unwrap();
    } catch (e) {
      toast.error(e?.data?.message || "Failed to update cart");
    }
  };

  const increaseQty = (item, quantity) => {
    const newQty = (quantity || 0) + 1;
    if (newQty > (item?.stock ?? 0)) return;
    setItemToCart(item, newQty);
  };

  const decreaseQty = (item, quantity) => {
    const newQty = (quantity || 0) - 1;
    if (newQty <= 0) return;
    setItemToCart(item, newQty);
  };

  const removeCartItemHandler = async (id, variant) => {
    try {
      await removeCartItem({ productId: id, variant }).unwrap();
    } catch (e) {
      toast.error(e?.data?.message || "Failed to remove item");
    }
  };

  const checkoutHandler = () => navigate("/shipping");

  const clearHandler = async () => {
    try {
      await clearCart().unwrap();
    } catch (e) {
      toast.error(e?.data?.message || "Failed to clear cart");
    }
  };

  if (isLoading) return <Loader />;
  if (isError) {
    return (
      <>
        <MetaData title={"Your Cart"} />
        <div className="alert alert-danger mt-4">
          {error?.data?.message || "Failed to load cart."}
        </div>
      </>
    );
  }

  return (
    <>
      <MetaData title={"Your Cart"} />

      {cartItems.length === 0 ? (
        <div className="mt-5">
          <h2>Your Cart is Empty</h2>
          <p className="mt-3">
            <Link to="/" className="btn btn-primary">
              Browse products
            </Link>
          </p>
        </div>
      ) : (
        <>
          <h2 className="mt-5">
            Your Cart: <b>{cartItems.length} item{cartItems.length > 1 ? "s" : ""}</b>
          </h2>

          <div className="row d-flex justify-content-between">
            <div className="col-12 col-lg-8">
              {cartItems.map((item) => (
                <div className="cart-item" key={`${item.product}-${item.variant || "default"}`}>
                  <hr />
                  <div className="row">
                    <div className="col-4 col-lg-3">
                      <img
                        src={item?.image}
                        alt={item?.name}
                        height="90"
                        width="115"
                      />
                    </div>

                    <div className="col-5 col-lg-3">
                      <Link to={`/product/${item?.product}`}>{item?.name}</Link>
                      {item?.variant ? (
                        <div className="text-muted small">Variant: {item.variant}</div>
                      ) : null}
                    </div>

                    <div className="col-4 col-lg-2 mt-4 mt-lg-0">
                      <p id="card_item_price">${money(item?.price)}</p>
                    </div>

                    <div className="col-4 col-lg-3 mt-4 mt-lg-0">
                      <div className="stockCounter d-inline">
                        <span
                          className="btn btn-danger minus"
                          onClick={() => decreaseQty(item, item.quantity)}
                        >
                          -
                        </span>
                        <input
                          type="number"
                          className="form-control count d-inline"
                          value={item?.quantity}
                          readOnly
                        />
                        <span
                          className="btn btn-primary plus"
                          onClick={() => increaseQty(item, item.quantity)}
                        >
                          +
                        </span>
                      </div>
                    </div>

                    <div className="col-4 col-lg-1 mt-4 mt-lg-0">
                      <i
                        id="delete_cart_item"
                        className="fa fa-trash btn btn-danger"
                        onClick={() => removeCartItemHandler(item?.product, item?.variant)}
                      />
                    </div>
                  </div>
                  <hr />
                </div>
              ))}
            </div>

            <div className="col-12 col-lg-3 my-4">
              <div id="order_summary">
                <h4>Order Summary</h4>
                <hr />
                <p>
                  Units:{" "}
                  <span className="order-summary-values">{units} (Units)</span>
                </p>
                <p>
                  Subtotal:{" "}
                  <span className="order-summary-values">${money(itemsPrice)}</span>
                </p>
                <p>
                  Shipping (est.):{" "}
                  <span className="order-summary-values">${money(shippingPrice)}</span>
                </p>
                <p>
                  Tax (est. 15%):{" "}
                  <span className="order-summary-values">${money(taxPrice)}</span>
                </p>
                <hr />
                <p className="fw-bold">
                  Est. total:{" "}
                  <span className="order-summary-values">${money(totalPrice)}</span>
                </p>
                <p className="text-muted small">
                  Final shipping & tax are calculated securely at checkout.
                </p>

                <div className="d-grid gap-2 mt-3">
                  <button
                    id="checkout_btn"
                    className="btn btn-primary"
                    onClick={checkoutHandler}
                    disabled={isUpdating || isRemoving || isClearing}
                  >
                    Check out
                  </button>
                  <button
                    className="btn btn-outline-danger"
                    onClick={clearHandler}
                    disabled={isClearing}
                  >
                    Clear cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Cart;
