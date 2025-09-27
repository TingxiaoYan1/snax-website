import React, { useState } from "react";
import MetaData from "./MetaData";
import UserLayout from "./UserLayout";
import toast from "react-hot-toast";
import { useClaimMyCouponMutation } from "../../redux/api/couponsApi";

const msgFromErr = (e) => e?.data?.message || e?.error || e?.message || "Unable to claim this code";

export default function FetchCoupon() {
  const [code, setCode] = useState("");
  const [lastResult, setLastResult] = useState(null); // remember what just happened
  const [claim, { isLoading }] = useClaimMyCouponMutation();

  const onSubmit = async (e) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      toast.error("Enter a code");
      return;
    }

    setLastResult(null);
    try {
      // IMPORTANT: pass a string; couponsApi wraps it as { code }
      const data = await claim(trimmed).unwrap();

      setLastResult({ type: data?.alreadyHad ? "already" : "created", coupon: data?.coupon });

      if (data?.alreadyHad) {
        toast("You already claimed this code — it’s in My Coupons.", { icon: "ℹ️" });
      } else {
        toast.success("Coupon added to your account");
      }

      setCode("");
    } catch (err) {
      // 409 means they've already USED it before (cannot claim)
      if (err?.status === 409) {
        setLastResult({ type: "used", message: msgFromErr(err) });
        toast.error(err?.data?.message || "You have already used this code");
      } else {
        setLastResult({ type: "error", message: msgFromErr(err) });
        toast.error(msgFromErr(err));
      }
    }
  };

  const C = lastResult?.coupon;

  return (
    <UserLayout>
      <MetaData title="Fetch Coupon" />
      <div className="row wrapper">
        <div className="col-10 col-lg-8 mt-4 mt-lg-0">
          <form className="shadow rounded bg-body p-4" onSubmit={onSubmit}>
            <h2 className="mb-3">Fetch Coupon</h2>

            <div className="mb-3">
              <label htmlFor="code_field" className="form-label">Enter Code</label>
              <div className="d-flex gap-2">
                <input
                  id="code_field"
                  className="form-control"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FALL15"
                  autoComplete="off"
                  disabled={isLoading}
                />
                <button className="btn btn-primary" type="submit" disabled={isLoading}>
                  {isLoading ? "Adding…" : "Add"}
                </button>
              </div>
            </div>

            {/* Result panel */}
            {lastResult?.type === "created" && C && (
              <div className="alert alert-success mt-3">
                <div className="fw-bold">Coupon added</div>
                <div><strong>Code:</strong> {C.code}</div>
                <div><strong>Discount:</strong> {C.percentage}% {C.maxDeduction != null ? `(max $${Number(C.maxDeduction).toFixed(2)})` : ""}</div>
                <div><strong>Expires:</strong> {new Date(C.expiresAt).toLocaleString()}</div>
                <div className="mt-2">
                  <a className="btn btn-sm btn-outline-secondary" href="/me/coupons">View My Coupons</a>
                </div>
              </div>
            )}

            {lastResult?.type === "already" && C && (
              <div className="alert alert-info mt-3">
                <div className="fw-bold">You already claimed this code</div>
                <div><strong>Code:</strong> {C.code}</div>
                <div><strong>Discount:</strong> {C.percentage}% {C.maxDeduction != null ? `(max $${Number(C.maxDeduction).toFixed(2)})` : ""}</div>
                <div><strong>Expires:</strong> {new Date(C.expiresAt).toLocaleString()}</div>
                <div className="mt-2">
                  <a className="btn btn-sm btn-outline-secondary" href="/me/coupons">View My Coupons</a>
                </div>
              </div>
            )}

            {lastResult?.type === "used" && (
              <div className="alert alert-warning mt-3">
                {lastResult.message || "You have already used this code."}
              </div>
            )}

            {lastResult?.type === "error" && (
              <div className="alert alert-danger mt-3">
                {lastResult.message || "Not valid or expired."}
              </div>
            )}
          </form>
        </div>
      </div>
    </UserLayout>
  );
}
