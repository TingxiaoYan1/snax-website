import React from 'react'
import SideMenu from './SideMenu'

const UserLayout = ({children}) => {
    const menuItems = [
        {
            name: "Profile",
            url: "/me/profile",
            icon: "fas fa-user",
        },
        {
            name: "Update Profile",
            url: "/me/update_profile",
            icon: "fas fa-user",
        },
        {
            name: "Upload Avatar",
            url: "/me/upload_avatar",
            icon: "fas fa-user-circle",
        },
        {
            name: "Update Password",
            url: "/me/update_password",
            icon: "fas fa-lock",
        },
        {
            name: "Fetch Coupon",
            url: "/me/fetch_coupon",
            icon: "fas fa-lock",
        },
        {
            name: "Review My Coupons",
            url: "/me/coupons",
            icon: "fas fa-list",
        },
    ];

  return (
    <div>
        <div className="mt-2 mb-4 py-4">
            <h2 className="text-center fw-border">
                User Settings
            </h2>

            <div className="container">
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
    </div>
  )
}

export default UserLayout
