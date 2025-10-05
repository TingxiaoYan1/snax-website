import React from "react";
import MetaData from "../layout/MetaData";
import UserLayout from "../layout/UserLayout";
import { useGetMyCouponsQuery } from "../../redux/api/couponsApi";

const money = (n) => Number(n ?? 0).toFixed(2);

function Payload({ c }) {
  if (c.type === "free_gift") {
    return (
      <span className="badge bg-info text-dark">
        FREE-GIFT · ≥ ${money(c.threshold)} · product {c.giftProduct} ×{c.giftQty}
      </span>
    );
  }
  return (
    <>
      {c.percentage}% {c.maxDeduction != null ? <span className="text-muted">(cap ${money(c.maxDeduction)})</span> : null}
    </>
  );
}

export default function MyCoupons() {
  const { data, isFetching, isError, error } = useGetMyCouponsQuery({ onlyValid: false, page: 1, pageSize: 100 });
  const coupons = data?.coupons || [];

  return (
    <UserLayout>
      <MetaData title="My Coupons" />
      <div className="row wrapper">
        <div className="col-12">
          <h2 className="mb-4">My Coupons</h2>

          {isFetching && <div className="alert alert-info">Loading…</div>}
          {isError && <div className="alert alert-danger">{error?.data?.message || "Failed to load coupons"}</div>}

          {!isFetching && coupons.length === 0 && (
            <div className="alert alert-secondary">You have no coupons yet.</div>
          )}

          {coupons.length > 0 && (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Type</th>
                    <th>Payload</th>
                    <th>Scope</th>
                    <th>Expires</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => {
                    const expired = new Date(c.expiresAt) <= new Date();
                    const status = c.used ? "Used" : expired ? "Expired" : "Active";
                    return (
                      <tr key={c._id}>
                        <td>{c.code}</td>
                        <td>{c.type || "percentage"}</td>
                        <td><Payload c={c} /></td>
                        <td>{c.scope || "user"}</td>
                        <td>{new Date(c.expiresAt).toLocaleString()}</td>
                        <td>
                          <span className={
                            "badge " + (c.used ? "text-bg-secondary"
                                   : expired ? "text-bg-warning"
                                   : "text-bg-success")
                          }>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
