import React from "react";
import Search from "./Search";
import { useGetMeQuery } from "../../redux/api/userApi";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useLazyLogoutQuery } from "../../redux/api/authApi";

// ⬇️ NEW: import the server-cart query
import { useGetCartQuery } from "../../redux/api/cartApi";

const Header = () => {
  const navigate = useNavigate();

  const { isLoading } = useGetMeQuery();
  const [logout] = useLazyLogoutQuery();

  const { user } = useSelector((state) => state.auth);

  // ⬇️ Ask the server for the cart only if logged in
  const { data: cartData } = useGetCartQuery(undefined, { skip: !user });
  const cartItems = cartData?.items || [];

  // Show total units (sum of quantities). If you prefer item lines, use cartItems.length
  const cartCount = user
    ? cartItems.reduce((acc, it) => acc + (it?.quantity || 0), 0)
    : 0;

  const logoutHandler = async() => {
    try {
    // wait for server to clear the auth cookie/session
      await logout().unwrap();
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      navigate(0);
    }
  };

  return (
    <nav className="navbar row">
      <div className="col-12 col-md-3 ps-5">
        <div className="navbar-brand">
          <Link to="/">
            <img src="/images/shopit_logo.png" alt="ShopIT Logo" />
          </Link>
        </div>
      </div>

      <div className="col-12 col-md-6 mt-2 mt-md-0">
        <Search />
      </div>

      <div className="col-12 col-md-3 mt-4 mt-md-0 text-center">
        {/* ⬇️ Use Link instead of <a> to avoid full reload */}
        <Link to="/cart" style={{ textDecoration: "none" }}>
          <span id="cart" className="ms-3">Cart</span>
          <span className="ms-1" id="cart_count">{cartCount}</span>
        </Link>

        {user ? (
          <div className="ms-4 dropdown">
            <button
              className="btn dropdown-toggle text-white"
              type="button"
              id="dropDownMenuButton"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <figure className="avatar avatar-nav">
                <img
                  src={user?.avatar ? user.avatar?.url : "/images/default_avatar.jpg"}
                  alt="User Avatar"
                  className="rounded-circle"
                />
              </figure>
              <span>{user?.name}</span>
            </button>
            <div className="dropdown-menu w-100" aria-labelledby="dropDownMenuButton">
              {user?.role === "admin" && (
                <Link className="dropdown-item" to="/admin/dashboard">Dashboard</Link>
              )}
              <Link className="dropdown-item" to="/me/orders">Orders</Link>
              <Link className="dropdown-item" to="/me/profile">Profile</Link>
              <Link className="dropdown-item text-danger" type="button" onClick={logoutHandler}>
                Logout
              </Link>
            </div>
          </div>
        ) : (
          !isLoading && (
            <Link to="/login" className="btn ms-4" id="login_btn">
              Login
            </Link>
          )
        )}
      </div>
    </nav>
  );
};

export default Header;
