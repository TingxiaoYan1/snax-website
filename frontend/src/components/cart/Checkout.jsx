import React, { useEffect, useMemo, useState } from "react";
import MetaData from "../layout/MetaData";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { countries } from "countries-list";

// Cart + Coupons
import { useGetCartQuery } from "../../redux/api/cartApi";
import { useGetMyCouponsQuery } from "../../redux/api/couponsApi";
import { setSelectedCoupon, clearSelectedCoupon } from "../../redux/features/couponSlice";

// Save shipping to redux (optional persistence)
import { saveShippingInfo } from "../../redux/features/cartSlice";

// Checkout backends
import { useCreateNewOrderMutation } from "../../redux/api/orderApi";
import { useCreateSquareCheckoutMutation } from "../../redux/api/paymentsApi";

// NEW: get gift product details to show under cart
import { useGetProductDetailsQuery } from "../../redux/api/productsApi";

const money = (n) => Number(n ?? 0).toFixed(2);

export default function Checkout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ----- DATA -----
  const { user } = useSelector((s) => s.auth);
  const reduxShipping = useSelector((s) => s.cart.shippingInfo);
  const selectedCoupon = useSelector((s) => s.couponUse?.selectedCoupon) || null;

  const { data: cartData, isLoading: cartLoading, isError: cartError, error } = useGetCartQuery();
  const cartItems = cartData?.items || [];

  // Only valid (not used/expired) coupons to pick from
  const { data: myCouponsData } = useGetMyCouponsQuery({ onlyValid: true });
  const myCoupons = myCouponsData?.coupons || [];

  // ----- LOCAL STATE: shipping + payment (NEW fields) -----
  const countryList = Object.values(countries);

  const [country, setCountry]       = useState(reduxShipping?.country   || "");
  const [firstName, setFirstName]   = useState(reduxShipping?.firstName || "");
  const [lastName, setLastName]     = useState(reduxShipping?.lastName  || "");
  const [address, setAddress]       = useState(reduxShipping?.address   || "");
  const [apartment, setApartment]   = useState(reduxShipping?.apartment || "");
  const [city, setCity]             = useState(reduxShipping?.city      || "");
  const [stateProv, setStateProv]   = useState(reduxShipping?.state     || "");
  const [zip, setZip]               = useState(reduxShipping?.zip       || "");
  const [phone, setPhone]           = useState(reduxShipping?.phone     || "");
  const [method, setMethod]         = useState(""); // "COD" | "Card"

  // ----- TOTALS (client-side estimate; server is source of truth) -----
  const { itemsPrice, discountAmount, shippingPrice, taxableBase, taxPrice, totalPrice } = useMemo(() => {
    const itemsPriceRaw = cartItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const itemsPrice = Number(itemsPriceRaw.toFixed(2));

    const isPct = selectedCoupon?.type === "percentage" || (selectedCoupon && selectedCoupon.percentage != null);
    const pct = isPct ? Number(selectedCoupon.percentage) : 0;
    const maxDed =
      isPct && selectedCoupon.maxDeduction != null
        ? Number(selectedCoupon.maxDeduction)
        : Infinity;

    const rawDiscount = isPct ? (itemsPrice * pct) / 100 : 0;
    const discountAmount = Number(Math.min(rawDiscount, isFinite(maxDed) ? maxDed : rawDiscount).toFixed(2));

    const shippingPrice = itemsPrice > 200 ? 0 : 5;
    const taxableBase = Math.max(0, itemsPrice - discountAmount);
    const taxPrice = Number((0.15 * taxableBase).toFixed(2));
    const totalPrice = Number((taxableBase + shippingPrice + taxPrice).toFixed(2));

    return { itemsPrice, discountAmount, shippingPrice, taxableBase, taxPrice, totalPrice };
  }, [cartItems, selectedCoupon]);

  // ----- BACKENDS -----
  const [createNewOrder,   { isLoading: placingCOD }] = useCreateNewOrderMutation();
  const [createSqCheckout, { isLoading: startingCard }] = useCreateSquareCheckoutMutation();

  // ----- HELPERS -----
  const shippingPayload = useMemo(() => ({
    country:   String(country || "").trim(),
    firstName: String(firstName || "").trim(),
    lastName:  String(lastName || "").trim(),
    address:   String(address || "").trim(),
    apartment: String(apartment || "").trim(),
    city:      String(city || "").trim(),
    state:     String(stateProv || "").trim(),
    zip:       String(zip || "").trim(),
    phone:     String(phone || "").trim(),
  }), [country, firstName, lastName, address, apartment, city, stateProv, zip, phone]);

  const couponFields = useMemo(() => {
    if (!selectedCoupon) return {};
    if (selectedCoupon._id) return { couponId: selectedCoupon._id };
    if (selectedCoupon.code) return { couponCode: String(selectedCoupon.code).toUpperCase() };
    return {};
  }, [selectedCoupon]);

  const isFreeGift = selectedCoupon?.type === "free_gift";
  const giftProductId = isFreeGift ? selectedCoupon?.giftProduct : null;
  const giftThreshold = isFreeGift ? Number(selectedCoupon?.threshold || 0) : 0;
  const giftQty = isFreeGift ? Number(selectedCoupon?.giftQty || 1) : 0;
  const meetsGift = isFreeGift ? itemsPrice >= giftThreshold : false;

  // Fetch gift product details to display
  const {
    data: giftData,
    isFetching: giftLoading,
    isError: giftError,
  } = useGetProductDetailsQuery(giftProductId, { skip: !giftProductId });

  const giftProduct = giftData?.product;

  // Validate shipping before posting (Apartment is optional)
  const shippingValid = Boolean(
    shippingPayload.country &&
    shippingPayload.firstName &&
    shippingPayload.lastName &&
    shippingPayload.address &&
    shippingPayload.city &&
    shippingPayload.state &&
    shippingPayload.zip &&
    shippingPayload.phone
  );

  useEffect(() => {
    if (cartError) {
      toast.error(error?.data?.message || "Failed to load cart");
    }
  }, [cartError, error]);

  // ----- ACTION: submit -----
  const submitCheckout = async (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return toast.error("Your cart is empty");
    if (!shippingValid) return toast.error("Please complete shipping info");
    if (!method) return toast.error("Please choose a payment method");

    dispatch(saveShippingInfo(shippingPayload));

    try {
      if (method === "COD") {
        await createNewOrder({
          shippingInfo: shippingPayload,
          paymentMethod: "COD",
          paymentInfo: { status: "Not Paid" },
          ...couponFields,
        }).unwrap();
        dispatch(clearSelectedCoupon());
        toast.success("Order placed (Cash on Delivery)");
        navigate("/me/orders");
        return;
      }

      if (method === "Card") {
        const { url } = await createSqCheckout({
          shippingInfo: shippingPayload,
          ...couponFields,
        }).unwrap();

        if (!url) return toast.error("Checkout link not created");
        window.location.href = url;
        return;
      }

      toast.error("Unsupported payment method");
    } catch (err) {
      const msg = err?.data?.message || err?.error || err?.message || "Checkout failed";
      toast.error(msg);
    }
  };

  if (cartLoading) return <div className="container py-5"><MetaData title="Checkout" /><div>Loading…</div></div>;

  return (
    <>
      <MetaData title="Checkout" />
      <div className="row wrapper mb-5">
        {/* --- Left: Shipping form + Payment method --- */}
        <div className="col-12 col-lg-5">
          <form className="shadow rounded bg-body p-4" onSubmit={submitCheckout}>
            <h2 className="mb-3">Shipping Info</h2>

            <div className="mb-3">
              <label className="form-label" htmlFor="country_field">Country</label>
              <select
                id="country_field"
                className="form-select"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              >
                <option value="">Select country…</option>
                {countryList.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="row">
              <div className="mb-3 col-12 col-md-6">
                <label className="form-label" htmlFor="first_field">First Name</label>
                <input
                  id="first_field"
                  className="form-control"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3 col-12 col-md-6">
                <label className="form-label" htmlFor="last_field">Last Name</label>
                <input
                  id="last_field"
                  className="form-control"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="address_field">Address</label>
              <input
                id="address_field"
                className="form-control"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Turing Way"
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="apartment_field">Apartment (optional)</label>
              <input
                id="apartment_field"
                className="form-control"
                value={apartment}
                onChange={(e) => setApartment(e.target.value)}
                placeholder="Apt / Suite / Unit"
              />
            </div>

            <div className="row">
              <div className="mb-3 col-12 col-md-6">
                <label className="form-label" htmlFor="city_field">City</label>
                <input
                  id="city_field"
                  className="form-control"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3 col-12 col-md-6">
                <label className="form-label" htmlFor="state_field">State / Province</label>
                <input
                  id="state_field"
                  className="form-control"
                  value={stateProv}
                  onChange={(e) => setStateProv(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="row">
              <div className="mb-3 col-12 col-md-6">
                <label className="form-label" htmlFor="zip_field">ZIP / Postal Code</label>
                <input
                  id="zip_field"
                  type="text"
                  className="form-control"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3 col-12 col-md-6">
                <label className="form-label" htmlFor="phone_field">Phone</label>
                <input
                  id="phone_field"
                  type="tel"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <h2 className="mb-3">Payment</h2>
            <div className="form-check mb-2">
              <input
                className="form-check-input"
                type="radio"
                name="pay"
                id="pay_cod"
                value="COD"
                checked={method === "COD"}
                onChange={() => setMethod("COD")}
              />
              <label className="form-check-label" htmlFor="pay_cod">Cash on Delivery (COD)</label>
            </div>
            <div className="form-check mb-3">
              <input
                className="form-check-input"
                type="radio"
                name="pay"
                id="pay_card"
                value="Card"
                checked={method === "Card"}
                onChange={() => setMethod("Card")}
              />
              <label className="form-check-label" htmlFor="pay_card">Card (Square)</label>
            </div>

            {selectedCoupon ? (
              <div className="alert alert-success">
                Using coupon: <strong>{selectedCoupon.code}</strong>{" "}
                {selectedCoupon.type === "percentage" || selectedCoupon.percentage != null
                  ? <>({selectedCoupon.percentage}% off{selectedCoupon.maxDeduction != null ? `, max $${money(selectedCoupon.maxDeduction)}` : ""})</>
                  : <>— Free Gift {giftQty} × <code>{giftProductId}</code> (threshold ${money(giftThreshold)})</>
                }
              </div>
            ) : (
              <div className="alert alert-info small">No coupon selected yet. Pick one on the right.</div>
            )}

            <button type="submit" className="btn btn-primary w-100 mt-2" disabled={!cartItems.length || placingCOD || startingCard}>
              {placingCOD || startingCard ? "Starting checkout…" : "PLACE ORDER"}
            </button>
          </form>
        </div>

        {/* --- Right: Cart review + Coupon picker + Summary --- */}
        <div className="col-12 col-lg-7 mt-4 mt-lg-0">
          <div className="shadow rounded bg-body p-4">
            <h4 className="mb-3">Your Cart Items</h4>
            {cartItems.length === 0 ? (
              <div className="alert alert-secondary">Your cart is empty. <Link to="/">Browse products</Link>.</div>
            ) : (
              <>
                {cartItems.map((item) => (
                  <React.Fragment key={`${item.product}-${item.variant || "default"}`}>
                    <hr />
                    <div className="row align-items-center">
                      <div className="col-3 col-lg-2">
                        <img src={item?.image} alt={item?.name} height="60" width="80" />
                      </div>
                      <div className="col-9 col-lg-6">
                        <Link to={`/product/${item.product}`}>{item?.name}</Link>
                        {item?.variant ? <div className="text-muted small">Variant: {item.variant}</div> : null}
                      </div>
                      <div className="col-12 col-lg-4 mt-2 mt-lg-0">
                        <div className="text-end">
                          {item?.quantity} × ${money(item?.price)} = <b>${money(item?.quantity * item?.price)}</b>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                ))}
                <hr />
              </>
            )}

            {/* ---------- Free Gift preview under cart ---------- */}
            {isFreeGift && giftProductId && (
              <div className="border rounded p-3 mb-3" style={{ background: "#fafafa" }}>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h5 className="m-0">Free Gift</h5>
                  <span className={`badge ${meetsGift ? "text-bg-success" : "text-bg-warning"}`}>
                    {meetsGift ? "Qualified" : `Spend $${money(Math.max(0, giftThreshold - itemsPrice))} more`}
                  </span>
                </div>

                {giftLoading ? (
                  <div className="text-muted">Loading gift…</div>
                ) : giftError ? (
                  <div className="text-danger">Gift product not found.</div>
                ) : giftProduct ? (
                  <div className="row align-items-center">
                    <div className="col-3 col-lg-2">
                      <img
                        src={giftProduct?.images?.[0]?.url || "/images/default_product.png"}
                        alt={giftProduct?.name}
                        height="60"
                        width="80"
                      />
                    </div>
                    <div className="col-9 col-lg-7">
                      <Link to={`/product/${giftProduct._id}`}>{giftProduct?.name}</Link>
                      <div className="text-muted small">Qty: {giftQty}</div>
                    </div>
                    <div className="col-12 col-lg-3 mt-2 mt-lg-0 text-lg-end">
                      <span className="badge text-bg-secondary">$0.00</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted">Gift details unavailable.</div>
                )}

                <div className="small text-muted mt-2">
                  The gift will be added to your order after payment if you meet the threshold.
                </div>
              </div>
            )}
            {/* ---------- END Free Gift preview ---------- */}

            {/* Coupon picker */}
            <div className="mb-3">
              <label className="form-label"><b>Coupon</b></label>
              <select
                className="form-select"
                value={selectedCoupon?._id || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return dispatch(clearSelectedCoupon());
                  const c = myCoupons.find((x) => x._id === v);
                  if (c) dispatch(setSelectedCoupon(c));
                }}
              >
                <option value="">-- No coupon --</option>
                {myCoupons.map((c) => (
                  <option value={c._id} key={c._id}>
                    {c.code} · {c.type === "free_gift"
                      ? `FREE-GIFT (≥ $${money(c.threshold)} → ${c.giftQty} × ${c.giftProduct})`
                      : `${c.percentage}% off${c.maxDeduction != null ? ` (cap $${money(c.maxDeduction)})` : ""}`
                    } · exp {new Date(c.expiresAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <small className="text-muted">
                Don’t see your code? <Link to="/me/fetch_coupon">Claim it here</Link>.
              </small>
            </div>

            {/* For free-gift, show eligibility hint */}
            {isFreeGift && (
              <div className={"alert " + (meetsGift ? "alert-success" : "alert-warning")}>
                {meetsGift
                  ? <>You qualify for the free gift (threshold ${money(giftThreshold)} met).</>
                  : <>Spend ${money(Math.max(0, giftThreshold - itemsPrice))} more to qualify for the free gift.</>
                }
                <div className="small text-muted">Gift is added after payment (in our system, not on Square).</div>
              </div>
            )}

            {/* Order summary */}
            <div className="pt-2">
              <h4>Order Summary</h4>
              <p>Subtotal: <span className="float-end">${money(itemsPrice)}</span></p>
              {discountAmount > 0 && (
                <p>Discount: <span className="float-end">- ${money(discountAmount)}</span></p>
              )}
              <p>Shipping (est.): <span className="float-end">${money(shippingPrice)}</span></p>
              <p>Tax (est.): <span className="float-end">${money(taxPrice)}</span></p>
              <hr />
              <p className="fw-bold">Total (est.): <span className="float-end">${money(totalPrice)}</span></p>
              <div className="text-muted small">
                Final shipping & tax are calculated on the server. Free-gift coupons do not change the price — we add the gift item to your order after payment if you meet the threshold.
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
