import React from 'react'
import SideMenu from './SideMenu'

const AdminLayout = ({children}) => {
  const menuItems = [
        {
            name: "DashBoard",
            url: "/admin/dashBoard",
            icon: "fas fa-tachometer-alt",
        },
        {
            name: "New Product",
            url: "/admin/product/new",
            icon: "fas fa-plus",
        },
        {
            name: "Products",
            url: "/admin/products",
            icon: "fab fa-product-hunt",
        },
        {
            name: "Order",
            url: "/admin/orders",
            icon: "fas fa-receipt",
        },
        {
            name: "Users",
            url: "/admin/users",
            icon: "fas fa-user",
        },
        {
            name: "Reviews",
            url: "/admin/reviews",
            icon: "fas fa-star",
        },
        {
            name: "Percentage Coupons",
            url: "/admin/coupons",
            icon: "fas fa-list",
        },
        {
            name: "Free Gift Coupons",
            url: "/admin/coupons/freegift",
            icon: "fas fa-gift",
        },
        {
            name: "Review Coupons",
            url: "/admin/coupons/review",
            icon: "fas fa-list",
        },
    ];

  return (
    <div>
        <div className="mt-2 mb-4 py-4">
            <h2 className="text-center fw-border">
                Admin Dashboard
            </h2>

            <div className="row justify-content-around">
                <div className="col-12 col-lg-3">
                    <SideMenu menuItems={menuItems}/>
                </div>
                <div className="col-12 col-lg-8 user-dashboard">
                    {children}
                </div>
            </div>
        </div>
    </div>
  )
}

export default AdminLayout
