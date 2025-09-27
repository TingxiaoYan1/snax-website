import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGetCartQuery } from "../../redux/api/cartApi";
import { useMyOrdersQuery } from "../../redux/api/orderApi";
import { clearSelectedCoupon } from "../../redux/features/couponSlice";
import { useDispatch } from "react-redux";

export default function SquareReturn() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { data: cartData, refetch: refetchCart } =
    useGetCartQuery(undefined, { refetchOnMountOrArgChange: true });

  const { data: ordersData, refetch: refetchOrders } =
    useMyOrdersQuery(undefined, { refetchOnMountOrArgChange: true });

  useEffect(() => {
    const startedAt = Number(sessionStorage.getItem("squareReturnStart")) || Date.now();
    let tries = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      tries += 1;

      const [cartRes, ordersRes] = await Promise.all([refetchCart(), refetchOrders()]);

      const cartItems = cartRes.data?.items ?? cartData?.items ?? [];
      const orders = ordersRes.data?.orders ?? ordersData?.orders ?? [];

      const cartEmpty = cartItems.length === 0;
      const recentOrder = orders.some(
        (o) => new Date(o.createdAt || o.paidAt || 0).getTime() >= startedAt - 60_000
      );

      if (cartEmpty && recentOrder) {
        dispatch(clearSelectedCoupon());
        navigate("/me/orders?order_success=1", { replace: true });
        return;
      }

      if (tries < 20) {
        setTimeout(poll, 500); // poll every 500ms for ~10s
      } else {
        window.location.replace("/me/orders?order_success=1");
      }
    };

    const t = setTimeout(poll, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  // ✅ add `dispatch` here to satisfy the rule
  }, [navigate, refetchCart, refetchOrders, cartData, ordersData, dispatch]);

  return (
    <div className="container py-5 text-center">
      <h3>Finalizing your order…</h3>
      <p className="text-muted">Waiting for Square to confirm your payment.</p>
      <div className="spinner-border" role="status" aria-hidden="true" />
    </div>
  );
}
