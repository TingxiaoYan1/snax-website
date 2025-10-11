// src/components/order/OrderDetails.jsx
import React, { useEffect } from "react";
import MetaData from "../layout/MetaData";
import { useOrderDetailsQuery } from "../../redux/api/orderApi";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import Loader from "../layout/Loader";

const money = (n) => Number(n ?? 0).toFixed(2);

const OrderDetails = () => {
  const params = useParams();
  const { data, isLoading, error } = useOrderDetailsQuery(params?.id);
  const order = data?.order || {};

  const {
    shippingInfo,
    orderItems,
    paymentInfo,
    user,
    totalAmount,
    orderStatus,
    itemsPrice,
    taxAmount,
    shippingAmount,
    coupon,
  } = order;

  const isPaid = paymentInfo?.status === "Paid";

  useEffect(() => {
    if (error) {
      toast.error(error?.data?.message || "Failed to load order");
    }
  }, [error]);

  if (isLoading) return <Loader />;

  // --- Legacy compatibility & name fallbacks ---
  const legacy = !shippingInfo?.firstName && !shippingInfo?.lastName;
  const fullName = legacy
    ? user?.name || "N/A"
    : `${shippingInfo?.firstName || ""} ${shippingInfo?.lastName || ""}`.trim();
  const phone = legacy ? shippingInfo?.phoneNo : shippingInfo?.phone;
  const fullAddress = legacy
    ? `${shippingInfo?.address || ""}, ${shippingInfo?.city || ""}, ${shippingInfo?.zipCode || ""}, ${shippingInfo?.country || ""}`
    : `${shippingInfo?.address || ""}${
        shippingInfo?.apartment ? `, ${shippingInfo.apartment}` : ""
      }, ${shippingInfo?.city || ""}, ${shippingInfo?.state || ""}, ${
        shippingInfo?.zip || ""
      }, ${shippingInfo?.country || ""}`;

  // Derive first/last if only user.name exists
  const deriveFirstLastFromUser = () => {
    const nm = (user?.name || "").trim();
    if (!nm) return { first: "N/A", last: "N/A" };
    const [first, ...rest] = nm.split(/\s+/);
    return { first: first || "N/A", last: rest.join(" ") || "N/A" };
  };
  const derived = deriveFirstLastFromUser();
  const displayFirst = shippingInfo?.firstName || derived.first;
  const displayLast = shippingInfo?.lastName || derived.last;

  return (
    <>
      <MetaData title={"Order Details"} />
      <div className="row d-flex justify-content-center">
        <div className="col-12 col-lg-9 mt-5 order-details">
          <div className="d-flex justify-content-between align-items-center">
            <h3 className="mt-5 mb-4">Your Order Details</h3>
            <a className="btn btn-success" href={`/invoice/order/${order?._id}`}>
              <i className="fa fa-print"></i> Invoice
            </a>
          </div>

          {/* Top summary */}
          <table className="table table-striped table-bordered">
            <tbody>
              <tr>
                <th scope="row">ID</th>
                <td>{order?._id}</td>
              </tr>
              <tr>
                <th scope="row">Status</th>
                <td className={String(orderStatus).includes("Delivered") ? "greenColor" : "redColor"}>
                  <b>{orderStatus}</b>
                </td>
              </tr>
              <tr>
                <th scope="row">Date</th>
                <td>{new Date(order?.createdAt).toLocaleString("en-US")}</td>
              </tr>
            </tbody>
          </table>

          {/* Customer */}
          <h3 className="mt-5 mb-4">Customer</h3>
          <table className="table table-striped table-bordered">
            <tbody>
              <tr>
                <th scope="row">Email</th>
                <td>{user?.email || "—"}</td>
              </tr>
              <tr>
                <th scope="row">User ID</th>
                <td>{user?._id || "—"}</td>
              </tr>
              <tr>
                <th scope="row">First Name</th>
                <td>{displayFirst}</td>
              </tr>
              <tr>
                <th scope="row">Last Name</th>
                <td>{displayLast}</td>
              </tr>
            </tbody>
          </table>

          {/* Order Items */}
          <h3 className="mt-5 my-4">Order Items</h3>
          <hr />
          <div className="cart-item my-1">
            {orderItems?.map((item, idx) => (
              <div className="row my-5" key={`${item?.product || item?.name}-${idx}`}>
                <div className="col-4 col-lg-2">
                  <img src={item?.image} alt={item?.name} height="45" width="65" />
                </div>
                <div className="col-5 col-lg-5">
                  {item?.product ? (
                    <Link to={`/product/${item?.product}`}>{item?.name}</Link>
                  ) : (
                    <span>{item?.name}</span>
                  )}
                  {item?.isGift && <div className="badge bg-success text-white ms-2">Gift</div>}
                </div>
                <div className="col-4 col-lg-2 mt-4 mt-lg-0">
                  <p>${money(item?.price)}</p>
                </div>
                <div className="col-4 col-lg-3 mt-4 mt-lg-0">
                  <p>{item?.quantity} Piece(s)</p>
                </div>
              </div>
            ))}
          </div>
          <hr />

          {/* Coupon / Discount */}
          <h3 className="mt-5 mb-4">Coupon / Discount</h3>
          {coupon ? (
            <table className="table table-striped table-bordered">
              <tbody>
                <tr>
                  <th scope="row">Code</th>
                  <td>{coupon?.code || "—"}</td>
                </tr>
                <tr>
                  <th scope="row">Type</th>
                  <td>{coupon?.type || "percentage"}</td>
                </tr>
                {coupon?.type === "percentage" ? (
                  <>
                    <tr>
                      <th scope="row">Percentage</th>
                      <td>{coupon?.percentage != null ? `${coupon.percentage}%` : "—"}</td>
                    </tr>
                    <tr>
                      <th scope="row">Max Deduction</th>
                      <td>{coupon?.maxDeduction != null ? `$${money(coupon.maxDeduction)}` : "—"}</td>
                    </tr>
                    <tr>
                      <th scope="row">Amount Deducted</th>
                      <td className="text-success"><b>- ${money(coupon?.discountApplied || 0)}</b></td>
                    </tr>
                  </>
                ) : (
                  <>
                    <tr>
                      <th scope="row">Gift Threshold</th>
                      <td>${money(coupon?.threshold || 0)}</td>
                    </tr>
                    <tr>
                      <th scope="row">Gift Item</th>
                      <td>
                        {coupon?.gift?.productId ? (
                          <Link to={`/product/${coupon.gift.productId}`}>Product</Link>
                        ) : "—"}
                      </td>
                    </tr>
                    <tr>
                      <th scope="row">Gift Quantity</th>
                      <td>{coupon?.gift?.qty || 1}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          ) : (
            <div className="alert alert-secondary">No coupon applied.</div>
          )}

          {/* Pricing Summary */}
          <h3 className="mt-5 mb-4">Pricing Summary</h3>
          <table className="table table-striped table-bordered">
            <tbody>
              <tr>
                <th scope="row">Items (after discount)</th>
                <td>${money(itemsPrice)}</td>
              </tr>
              <tr>
                <th scope="row">Shipping</th>
                <td>${money(shippingAmount)}</td>
              </tr>
              <tr>
                <th scope="row">Tax</th>
                <td>${money(taxAmount)}</td>
              </tr>
              <tr>
                <th scope="row">Total Paid</th>
                <td><b>${money(totalAmount)}</b></td>
              </tr>
            </tbody>
          </table>

          {/* Shipping Info */}
          <h3 className="mt-5 mb-4">Shipping Info</h3>
          <table className="table table-striped table-bordered">
            <tbody>
              <tr>
                <th scope="row">Name</th>
                <td>{fullName || "N/A"}</td>
              </tr>
              <tr>
                <th scope="row">Phone</th>
                <td>{phone || "—"}</td>
              </tr>
              <tr>
                <th scope="row">Address</th>
                <td>{fullAddress || "—"}</td>
              </tr>
            </tbody>
          </table>

          {/* Payment Info */}
          <h3 className="mt-5 mb-4">Payment Info</h3>
          <table className="table table-striped table-bordered">
            <tbody>
              <tr>
                <th scope="row">Status</th>
                <td className={isPaid ? "greenColor" : "redColor"}>
                  <b>{paymentInfo?.status}</b>
                </td>
              </tr>
              <tr>
                <th scope="row">Method</th>
                <td>{order?.paymentMethod}</td>
              </tr>
              <tr>
                <th scope="row">Square ID</th>
                <td>{paymentInfo?.id || "N/A"}</td>
              </tr>
              <tr>
                <th scope="row">Amount Paid</th>
                <td>${money(totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default OrderDetails;
