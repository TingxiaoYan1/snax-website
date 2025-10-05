import React, { useEffect, useMemo, useState } from "react";
import MetaData from "../layout/MetaData";
import Loader from "../layout/Loader";
import { Link, useNavigate } from "react-router-dom";
import {
  useGetCartQuery,
  useUpsertCartItemMutation,
  useRemoveCartItemMutation,
  useClearCartMutation,
} from "../../redux/api/cartApi";
import { useLazyGetRandomProductsQuery } from "../../redux/api/productsApi";
import toast from "react-hot-toast";
import { calculateOrderCost } from "../../helpers/helpers";

// Utility: format as money
const money = (n) => Number(n || 0).toFixed(2);

/* ----------------------------- Suggested card ----------------------------- */
// Small card used in the "What you may want" section
function SuggestionCard({ p, onAdd, busy }) {
  return (
    <div className="col-6 col-md-3 mb-3">
      <div className="card h-100">
        <img
          src={p?.images?.[0]?.url || "/images/default_product.png"}
          className="card-img-top"
          alt={p?.name}
          style={{ objectFit: "cover", height: 140 }}
        />
        <div className="card-body d-flex flex-column">
          <Link to={`/product/${p._id}`} className="fw-semibold mb-1">
            {p?.name}
          </Link>
          <div className="text-muted mb-2">${money(p?.price)}</div>
          <button
            className="btn btn-sm btn-primary mt-auto"
            onClick={() => onAdd(p)}
            disabled={busy}
            title="Add to cart"
          >
            <i className="fa fa-cart-plus me-1" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Cart ---------------------------------- */
const Cart = () => {
  const navigate = useNavigate();

  // Server cart
  const { data, isLoading, isError, error } = useGetCartQuery();
  const [upsertCartItem, { isLoading: isUpdating }] = useUpsertCartItemMutation();
  const [removeCartItem, { isLoading: isRemoving }] = useRemoveCartItemMutation();
  const [clearCart, { isLoading: isClearing }] = useClearCartMutation();

  const cartItems = data?.items || [];

  // Client-calculated estimates (server is the source of truth at checkout)
  const units = cartItems.reduce((s, i) => s + (i.quantity || 0), 0);
  const { itemsPrice, shippingPrice, taxPrice, totalPrice } =
    calculateOrderCost(cartItems);

  // Update a cart line to a new quantity (keeps variant if present)
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

  // Quantity controls
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

  // Remove one line
  const removeCartItemHandler = async (id, variant) => {
    try {
      await removeCartItem({ productId: id, variant }).unwrap();
    } catch (e) {
      toast.error(e?.data?.message || "Failed to remove item");
    }
  };

  const checkoutHandler = () => navigate("/checkout");

  const clearHandler = async () => {
    try {
      await clearCart().unwrap();
    } catch (e) {
      toast.error(e?.data?.message || "Failed to clear cart");
    }
  };

  /* ------------- DB-RANDOM suggestions (manual fetch, no auto-refresh) ------------- */

  // Build a clean list of string ObjectIds to exclude (items already in cart)
  const currentExcludeIds = useMemo(
    () =>
      (cartItems || [])
        .map((ci) => (ci?.product != null ? String(ci.product) : ""))
        .filter((id) => id && id.length >= 12), // loose client guard; server will re-validate
    [cartItems]
  );

  // Use LAZY query so we fetch only when we choose
  const [
    triggerRandom, // call this to fetch suggestions
    { isFetching: randomLoading, isError: randomError, error: randomErrObj },
  ] = useLazyGetRandomProductsQuery();

  // Local suggestions state — we control what’s displayed
  const [suggestions, setSuggestions] = useState([]);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);

  // Fetch once after cart loads; DO NOT depend on cart changing → no auto refresh
  useEffect(() => {
    if (!isLoading && !hasFetchedOnce) {
      (async () => {
        try {
          const data = await triggerRandom({
            limit: 4,
            exclude: currentExcludeIds,
            inStockOnly: false,
            seed: Date.now(),
          }).unwrap();
          setSuggestions(data?.products || []);
        } catch (err) {
          // surfacing error is handled by randomError/randomErrObj
        } finally {
          setHasFetchedOnce(true);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, hasFetchedOnce]); // intentionally NOT depending on cartItems

  // Manual refresh — only when user clicks
  const refreshSuggestions = async () => {
    try {
      const data = await triggerRandom({
        limit: 4,
        exclude: currentExcludeIds,
        inStockOnly: false,
        seed: Date.now(),
      }).unwrap();
      setSuggestions(data?.products || []);
    } catch (err) {
      // error UI handled below
    }
  };

  // Add suggested item to cart and remove it from the suggestions list immediately
  const addSuggested = async (p) => {
    try {
      await upsertCartItem({ productId: p._id, quantity: 1 }).unwrap();
      toast.success("Added to cart");
      // Remove this item from suggestions (no auto re-fetch)
      setSuggestions((prev) => prev.filter((x) => String(x._id) !== String(p._id)));
    } catch (e) {
      toast.error(e?.data?.message || "Failed to add");
    }
  };

  /* ---------------------------------------------------------------------- */

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
            {/* --------------------------- Cart lines --------------------------- */}
            <div className="col-12 col-lg-8">
              {cartItems.map((item) => (
                <div
                  className="cart-item"
                  key={`${item.product}-${item.variant || "default"}`}
                >
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
                        onClick={() =>
                          removeCartItemHandler(item?.product, item?.variant)
                        }
                      />
                    </div>
                  </div>
                  <hr />
                </div>
              ))}

              {/* ----------------------- What you may want ---------------------- */}
              <div className="mt-4">
                <div className="d-flex align-items-center justify-content-between">
                  <h4 className="m-0">What you may want</h4>

                  {/* Single Refresh button only */}
                  <button
                    className="btn btn-sm btn-outline-secondary"
                    onClick={refreshSuggestions}
                    disabled={randomLoading}
                    title="Refresh suggestions"
                  >
                    <i className="fa fa-random me-1" />
                    Refresh
                  </button>
                </div>

                <div className="row mt-3">
                  {randomLoading ? (
                    <div className="col-12">
                      <div className="alert alert-info">Loading suggestions…</div>
                    </div>
                  ) : randomError ? (
                    <div className="col-12">
                      <div className="alert alert-danger">
                        Failed to fetch suggestions.
                        <div className="small text-muted mt-1">
                          {String(
                            randomErrObj?.data?.message ||
                              randomErrObj?.error ||
                              randomErrObj?.status ||
                              "Unknown error"
                          )}
                        </div>
                      </div>
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="col-12">
                      <div className="alert alert-secondary">
                        No suggestions right now.{" "}
                        <Link to="/">Browse products</Link>.
                      </div>
                    </div>
                  ) : (
                    suggestions.map((p) => (
                      <SuggestionCard
                        key={p._id}
                        p={p}
                        onAdd={addSuggested}
                        busy={isUpdating}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* --------------------------- Summary card --------------------------- */}
            <div className="col-12 col-lg-3 my-4">
              <div id="order_summary">
                <h4>Order Summary</h4>
                <hr />
                <p>
                  Units: <span className="order-summary-values">{units} (Units)</span>
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
