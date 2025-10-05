// src/components/admin/AdminGiftCoupons.jsx
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import MetaData from "../layout/MetaData";
import AdminLayout from "../layout/AdminLayout";
import {
  // NEW hooks you’ll add in couponsApi.js
  useCreateUserFreeGiftCouponMutation,
  useCreateGlobalFreeGiftCouponMutation,
} from "../../redux/api/couponsApi";

const initial = {
  scope: "user",          // "user" | "global"
  userId: "",             // required when scope=user
  code: "",
  daysValid: "",
  giftProductId: "",
  giftQty: 1,
  threshold: 0,
  note: "",
  // for global only:
  perUserLimit: 1,
  maxRedemptions: "",
  startAt: "",
};

export default function AdminGiftCoupons() {
  const [form, setForm] = useState(initial);
  const isGlobal = form.scope === "global";

  const [createUserGift, { isLoading: isUserLoading, isSuccess: userOk, error: userErr }] =
    useCreateUserFreeGiftCouponMutation();
  const [createGlobalGift, { isLoading: isGlobalLoading, isSuccess: globalOk, error: globalErr }] =
    useCreateGlobalFreeGiftCouponMutation();

  useEffect(() => {
    if (userErr) toast.error(userErr?.data?.message || "Failed to create gift coupon (user)");
    if (globalErr) toast.error(globalErr?.data?.message || "Failed to create gift coupon (global)");
    if (userOk || globalOk) {
      toast.success("Free-gift coupon created");
      setForm(initial);
    }
  }, [userErr, globalErr, userOk, globalOk]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submitHandler = (e) => {
    e.preventDefault();

    // Basic validations
    if (!form.code?.trim()) return toast.error("Code is required");
    const dv = parseInt(form.daysValid, 10);
    if (!Number.isInteger(dv) || dv <= 0) return toast.error("daysValid must be a positive integer");

    const qty = parseInt(form.giftQty, 10);
    if (!Number.isInteger(qty) || qty <= 0) return toast.error("Gift quantity must be a positive integer");

    const threshold = Number(form.threshold);
    if (!(threshold >= 0)) return toast.error("Threshold must be ≥ 0");

    if (!form.giftProductId?.trim()) return toast.error("Gift product id is required");

    // If you want: do a quick client-side ObjectId format check
    const oidLike = /^[a-fA-F0-9]{24}$/;
    if (!oidLike.test(form.giftProductId.trim())) {
      return toast.error("Gift product id must be a valid Mongo ObjectId (24 hex chars)");
    }

    if (!isGlobal && !form.userId?.trim()) return toast.error("User ID is required for personal coupon");

    if (isGlobal) {
      const payload = {
        code: form.code.trim().toUpperCase(),
        daysValid: dv,
        giftProductId: form.giftProductId.trim(),
        giftQty: qty,
        threshold,
        note: form.note?.trim() || undefined,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : 1,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
      };
      createGlobalGift(payload);
    } else {
      const payload = {
        userId: form.userId.trim(),
        code: form.code.trim().toUpperCase(),
        daysValid: dv,
        giftProductId: form.giftProductId.trim(),
        giftQty: qty,
        threshold,
        note: form.note?.trim() || undefined,
      };
      createUserGift(payload);
    }
  };

  return (
    <AdminLayout>
      <MetaData title={"Create Free-Gift Coupon"} />
      <div className="row wrapper">
        <div className="col-10 col-lg-10 mt-5 mt-lg-0">
          <form className="shadow rounded bg-body p-4" onSubmit={submitHandler}>
            <h2 className="mb-4">Create Free-Gift Coupon</h2>

            {/* Scope selection */}
            <div className="mb-3 d-flex gap-4">
              <label className="form-check">
                <input className="form-check-input" type="radio" name="scope" value="user"
                  checked={!isGlobal} onChange={onChange}/>
                <span className="form-check-label">Personal (assign to one user)</span>
              </label>
              <label className="form-check">
                <input className="form-check-input" type="radio" name="scope" value="global"
                  checked={isGlobal} onChange={onChange}/>
                <span className="form-check-label">Global (any user, limited by caps)</span>
              </label>
            </div>

            {/* User target (only for personal) */}
            {!isGlobal && (
              <div className="mb-3">
                <label className="form-label">User ID</label>
                <input className="form-control" name="userId" value={form.userId} onChange={onChange}/>
              </div>
            )}

            {/* Basic coupon fields */}
            <div className="mb-3">
              <label className="form-label">Code</label>
              <input className="form-control" name="code" value={form.code} onChange={onChange} placeholder="GIFT50" />
            </div>

            <div className="row">
              <div className="mb-3 col">
                <label className="form-label">Valid For (days)</label>
                <input type="number" min="1" className="form-control"
                  name="daysValid" value={form.daysValid} onChange={onChange}/>
              </div>
              <div className="mb-3 col">
                <label className="form-label">Spend Threshold ($)</label>
                <input type="number" min="0" step="0.01" className="form-control"
                  name="threshold" value={form.threshold} onChange={onChange}/>
              </div>
            </div>

            {/* Gift payload */}
            <div className="row">
              <div className="mb-3 col">
                <label className="form-label">Gift Product ID</label>
                <input className="form-control" name="giftProductId" value={form.giftProductId} onChange={onChange}
                  placeholder="Mongo ObjectId of product to gift"/>
                <div className="form-text">
                  This must be a real product id; backend validates it and rejects invalid ids.
                </div>
              </div>
              <div className="mb-3 col">
                <label className="form-label">Gift Quantity</label>
                <input type="number" min="1" className="form-control"
                  name="giftQty" value={form.giftQty} onChange={onChange}/>
              </div>
            </div>

            {/* Optional note */}
            <div className="mb-3">
              <label className="form-label">Note (optional)</label>
              <input className="form-control" name="note" value={form.note} onChange={onChange}/>
            </div>

            {/* Global-only caps/schedule */}
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

            <button className="btn btn-primary w-100" type="submit" disabled={isUserLoading || isGlobalLoading}>
              {isUserLoading || isGlobalLoading ? "Creating..." : "CREATE FREE-GIFT COUPON"}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
