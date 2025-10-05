import React, { useEffect, useState } from "react";
import AdminLayout from "../layout/AdminLayout";
import MetaData from "../layout/MetaData";
import toast from "react-hot-toast";
import {
  useGetAdminCouponsQuery,
  useLazyGetAdminCouponsQuery,
  useAdminDeleteCouponMutation,
} from "../../redux/api/couponsApi";

// Renders a line describing coupon payload
const PayloadCell = ({ c }) => {
  if (c.type === "free_gift") {
    return (
      <span className="badge bg-info text-dark">
        FREE-GIFT · threshold ${Number(c.threshold || 0).toFixed(2)} · product {c.giftProduct} ×{c.giftQty}
      </span>
    );
  }
  // default to percentage coupon display
  return (
    <>
      <strong>{c.percentage}%</strong>
      {c.maxDeduction != null && (
        <span className="ms-1 text-muted">(cap ${Number(c.maxDeduction).toFixed(2)})</span>
      )}
    </>
  );
};

const Row = ({ c, onDelete }) => (
  <tr>
    <td>{c.code}</td>
    <td>{c.type || "percentage"}</td>
    <td><PayloadCell c={c} /></td>
    <td>{c.scope}</td>
    <td>{c.assignedTo || "-"}</td>
    <td>{c.startAt ? new Date(c.startAt).toLocaleString() : "-"}</td>
    <td>{new Date(c.expiresAt).toLocaleString()}</td>
    <td className="text-end">
      <button className="btn btn-sm btn-danger" onClick={() => onDelete(c._id)}>Delete</button>
    </td>
  </tr>
);

export default function ReviewCoupons() {
  const [gPage] = useState(1);
  const { data: globalData, isFetching: gLoading, error: gError, refetch: refetchGlobal } =
    useGetAdminCouponsQuery({ scope: "global", page: gPage, pageSize: 50 });

  const [userId, setUserId] = useState("");
  const [triggerUser, { data: userData, isFetching: uLoading, error: uError, refetch: refetchUser }] =
    useLazyGetAdminCouponsQuery();

  const [removeCoupon] = useAdminDeleteCouponMutation();

  useEffect(() => {
    if (gError) toast.error(gError?.data?.message || "Failed to load global coupons");
    if (uError) toast.error(uError?.data?.message || "Failed to load user coupons");
  }, [gError, uError]);

  const onSearch = (e) => {
    e.preventDefault();
    if (!userId.trim()) return toast.error("Enter a user id");
    triggerUser({ scope: "user", assignedTo: userId, page: 1, pageSize: 50 });
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this coupon?")) return;
    try {
      await removeCoupon(id).unwrap();
      toast.success("Coupon deleted");
      await refetchGlobal();
      refetchUser?.();
    } catch (e) {
      toast.error(e?.data?.message || "Delete failed");
    }
  };

  return (
    <AdminLayout>
      <MetaData title="Review Coupons" />
      <div className="row wrapper">
        <div className="col-10 col-lg-10 mt-4 mt-lg-0">
          <div className="shadow rounded bg-body p-4">
            <h2 className="mb-3">Global Coupons</h2>
            {gLoading ? <p className="text-muted">Loading...</p> : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th><th>Type</th><th>Payload</th><th>Scope</th>
                      <th>User</th><th>Starts</th><th>Expires</th><th></th>
                    </tr>
                  </thead>
                  <tbody>{globalData?.coupons?.map((c) => <Row key={c._id} c={c} onDelete={onDelete} />)}</tbody>
                </table>
              </div>
            )}
          </div>

          <div className="shadow rounded bg-body p-4 mt-4">
            <h2 className="mb-3">User Coupons</h2>
            <form className="row g-2 mb-3" onSubmit={onSearch}>
              <div className="col">
                <input className="form-control" placeholder="User ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
              </div>
              <div className="col-auto">
                <button className="btn btn-primary" type="submit">Search</button>
              </div>
            </form>
            {uLoading ? <p className="text-muted">Loading...</p> : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Code</th><th>Type</th><th>Payload</th><th>Scope</th>
                      <th>User</th><th>Starts</th><th>Expires</th><th></th>
                    </tr>
                  </thead>
                  <tbody>{userData?.coupons?.map((c) => <Row key={c._id} c={c} onDelete={onDelete} />)}</tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
