import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import MetaData from "../layout/MetaData";
import AdminLayout from "../layout/AdminLayout";
import {
  useCreateCouponMutation,
  useCreateGlobalCouponMutation,
} from "../../redux/api/couponsApi";

const initial = {
  scope: "user",
  userId: "",
  code: "",
  percentage: "",
  daysValid: "",
  note: "",
  maxDeduction: "",      // NEW
  perUserLimit: 1,
  maxRedemptions: "",
  startAt: "",
};

export default function AdminCoupons() {
  const [form, setForm] = useState(initial);
  const isGlobal = form.scope === "global";

  const [createCoupon, { isLoading: isCreatingUser, isSuccess: isUserSuccess, error: userError }] =
    useCreateCouponMutation();
  const [createGlobalCoupon, { isLoading: isCreatingGlobal, isSuccess: isGlobalSuccess, error: globalError }] =
    useCreateGlobalCouponMutation();

  useEffect(() => {
    if (userError) toast.error(userError?.data?.message || "Failed to create coupon");
    if (globalError) toast.error(globalError?.data?.message || "Failed to create global coupon");
    if (isUserSuccess || isGlobalSuccess) {
      toast.success("Coupon created");
      setForm(initial);
    }
  }, [userError, globalError, isUserSuccess, isGlobalSuccess]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submitHandler = (e) => {
    e.preventDefault();
    if (!form.code?.trim()) return toast.error("Code is required");
    const pct = Number(form.percentage);
    if (!(pct >= 1 && pct <= 100)) return toast.error("Percentage must be 1–100");
    const dv = parseInt(form.daysValid, 10);
    if (!Number.isInteger(dv) || dv <= 0) return toast.error("daysValid must be a positive integer");
    if (!isGlobal && !form.userId?.trim()) return toast.error("User ID is required");
    if (form.maxDeduction !== "" && !(Number(form.maxDeduction) >= 0)) return toast.error("Max deduction must be ≥ 0");

    if (isGlobal) {
      const payload = {
        code: form.code.trim().toUpperCase(),
        percentage: pct,
        daysValid: dv,
        note: form.note?.trim() || undefined,
        ...(form.maxDeduction !== "" ? { maxDeduction: Number(form.maxDeduction) } : {}),
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : 1,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
      };
      createGlobalCoupon(payload);
    } else {
      const payload = {
        userId: form.userId.trim(),
        code: form.code.trim().toUpperCase(),
        percentage: pct,
        daysValid: dv,
        note: form.note?.trim() || undefined,
        ...(form.maxDeduction !== "" ? { maxDeduction: Number(form.maxDeduction) } : {}),
      };
      createCoupon(payload);
    }
  };

  return (
    <AdminLayout>
      <MetaData title={"Create Coupon"} />
      <div className="row wrapper">
        <div className="col-10 col-lg-10 mt-5 mt-lg-0">
          <form className="shadow rounded bg-body p-4" onSubmit={submitHandler}>
            <h2 className="mb-4">Create Coupon</h2>

            <div className="mb-3 d-flex gap-4">
              <label className="form-check">
                <input className="form-check-input" type="radio" name="scope" value="user"
                       checked={!isGlobal} onChange={onChange}/>
                <span className="form-check-label">Personal (assign to one user)</span>
              </label>
              <label className="form-check">
                <input className="form-check-input" type="radio" name="scope" value="global"
                       checked={isGlobal} onChange={onChange}/>
                <span className="form-check-label">Global (any user, once per user)</span>
              </label>
            </div>

            {!isGlobal && (
              <div className="mb-3">
                <label className="form-label">User ID</label>
                <input className="form-control" name="userId" value={form.userId} onChange={onChange}/>
              </div>
            )}

            <div className="mb-3">
              <label className="form-label">Code</label>
              <input className="form-control" name="code" value={form.code} onChange={onChange} placeholder="FALL15"/>
            </div>

            <div className="row">
              <div className="mb-3 col">
                <label className="form-label">Percentage</label>
                <input type="number" min="1" max="100" className="form-control"
                       name="percentage" value={form.percentage} onChange={onChange}/>
              </div>
              <div className="mb-3 col">
                <label className="form-label">Valid For (days)</label>
                <input type="number" min="1" className="form-control"
                       name="daysValid" value={form.daysValid} onChange={onChange}/>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Note (optional)</label>
              <input className="form-control" name="note" value={form.note} onChange={onChange}/>
            </div>

            <div className="mb-3">
              <label className="form-label">Max Deduction ($)</label>
              <input type="number" min="0" className="form-control"
                     name="maxDeduction" value={form.maxDeduction} onChange={onChange} placeholder="Optional (e.g., 10)"/>
            </div>

            {isGlobal && (
              <div className="row">
                <div className="mb-3 col">
                  <label className="form-label">Per-user limit</label>
                  <input type="number" min="1" className="form-control"
                         name="perUserLimit" value={form.perUserLimit} onChange={onChange}/>
                </div>
                <div className="mb-3 col">
                  <label className="form-label">Max redemptions (optional)</label>
                  <input type="number" min="1" className="form-control"
                         name="maxRedemptions" value={form.maxRedemptions} onChange={onChange}/>
                </div>
                <div className="mb-3 col">
                  <label className="form-label">Start at (optional)</label>
                  <input type="datetime-local" className="form-control"
                         name="startAt" value={form.startAt} onChange={onChange}/>
                </div>
              </div>
            )}

            <button className="btn btn-primary w-100" type="submit" disabled={isCreatingUser || isCreatingGlobal}>
              {isCreatingUser || isCreatingGlobal ? "Creating..." : "CREATE"}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
