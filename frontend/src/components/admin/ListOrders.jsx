// src/components/admin/ListOrders.jsx
import React, { useEffect, useMemo, useState } from "react";
import Loader from "../layout/Loader";
import toast from "react-hot-toast";
import { MDBDataTable } from "mdbreact";
import { Link } from "react-router-dom";
import MetaData from "../layout/MetaData";
import AdminLayout from "../layout/AdminLayout";
import { useDeleteOrderMutation, useGetAdminOrdersQuery } from "../../redux/api/orderApi";

const STATUS_OPTIONS = ["All", "Processing", "Shipped", "Delivered", "Refunding", "Refunded"];

const ListOrders = () => {
  const { data, isLoading, error } = useGetAdminOrdersQuery();
  const [deleteOrder, { error: deleteError, isLoading: isDeleteLoading, isSuccess }] =
    useDeleteOrderMutation();

  // NEW: filter by order status (client-side)
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    if (error) toast.error(error?.data?.message || "Failed to load orders");
    if (deleteError) toast.error(deleteError?.data?.message || "Delete failed");
    if (isSuccess) toast.success("Order deleted");
  }, [error, deleteError, isSuccess]);

  const deleteOrderHandler = (id) => deleteOrder(id);

  // NEW: compute visible orders (filter + sort desc by createdAt)
  const visibleOrders = useMemo(() => {
    const orders = data?.orders || [];
    const filtered =
      statusFilter === "All"
        ? orders
        : orders.filter((o) => (o?.orderStatus || "") === statusFilter);
    return filtered
      .slice()
      .sort(
        (a, b) =>
          new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
      );
  }, [data, statusFilter]);

  // Build the table payload
  const tableData = useMemo(() => {
    const payload = {
      columns: [
        { label: "ID", field: "id", sort: "asc" },
        { label: "Created At", field: "createdAt", sort: "desc" }, // NEW: show time
        { label: "Payment Status", field: "paymentStatus", sort: "asc" },
        { label: "Order Status", field: "orderStatus", sort: "asc" },
        { label: "Actions", field: "actions" },
      ],
      rows: [],
    };

    visibleOrders.forEach((order) => {
      payload.rows.push({
        id: order?._id,
        createdAt: order?.createdAt
          ? new Date(order.createdAt).toLocaleString()
          : "-",
        paymentStatus: (order?.paymentInfo?.status || "").toUpperCase(),
        orderStatus: order?.orderStatus || "-",
        actions: (
          <>
            <Link
              to={`/admin/orders/${order?._id}`}
              className="btn btn-outline-primary"
              title="Edit"
            >
              <i className="fa fa-pencil" />
            </Link>
            <button
              className="btn btn-outline-danger ms-2"
              onClick={() => deleteOrderHandler(order?._id)}
              disabled={isDeleteLoading}
              title="Delete"
            >
              <i className="fa fa-trash" />
            </button>
          </>
        ),
      });
    });

    return payload;
  }, [visibleOrders, isDeleteLoading]);

  if (isLoading) return <Loader />;

  return (
    <AdminLayout>
      <MetaData title={"All Orders"} />
      <div className="d-flex align-items-center justify-content-between my-4">
        <h1 className="m-0">
          {visibleOrders.length} Orders{" "}
          <small className="text-muted"> (newest first)</small>
        </h1>

        {/* NEW: Status filter dropdown */}
        <div className="d-flex align-items-center gap-2">
          <label className="me-2 mb-0">Filter:</label>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: 200 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option value={opt} key={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <MDBDataTable
        data={tableData}
        className="px-3"
        bordered  // fixed typo: was "bproducted"
        striped
        hover
      />
    </AdminLayout>
  );
};

export default ListOrders;
