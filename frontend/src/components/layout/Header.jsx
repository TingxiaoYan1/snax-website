// src/components/layout/Header.jsx
import React, { useState } from "react";
import Search from "./Search";
import { useAddSearchKeywordMutation, useGetMeQuery } from "../../redux/api/userApi";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useLazyLogoutQuery } from "../../redux/api/authApi";
import { selectLocale, toggleLocale } from "../../redux/features/langSlice";

// Server-cart query to show cart count
import { useGetCartQuery } from "../../redux/api/cartApi";

const Header = () => {
  const [keyword, setKeyword] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [addSearchKeyword] = useAddSearchKeywordMutation();

  // Submit search to home page with keyword param; empty search goes home
  const submitHandler = async (e) => {
    e.preventDefault();
    const term = keyword.trim();
    if (term) {
      addSearchKeyword(term).catch(() => {}); // fire-and-forget
      navigate(`/?keyword=${encodeURIComponent(term)}`);
    } else {
      navigate(`/`);
    }
  };

  const { isLoading } = useGetMeQuery();
  const [logout] = useLazyLogoutQuery();
  const locale = useSelector(selectLocale);

  const { user } = useSelector((state) => state.auth);

  // Ask the server for the cart only if logged in
  const { data: cartData } = useGetCartQuery(undefined, { skip: !user });
  const cartItems = cartData?.items || [];

  // Show total units (sum of quantities). If you prefer item lines, use cartItems.length
  const cartCount = user
    ? cartItems.reduce((acc, it) => acc + (it?.quantity || 0), 0)
    : 0;

  const logoutHandler = async () => {
    try {
      await logout().unwrap(); // clear cookie/session on server
    } catch (e) {
      console.error("Logout failed", e);
    } finally {
      navigate(0); // hard reload to clear client state
    }
  };

  // Quick nav helpers for the new buttons below the search bar
  const goHome = () => navigate("/");
  const goExplore = () => navigate("/explore");

  // -------------------------
  // Chinese layout (zh-CN)
  // -------------------------
  if (locale === "zh") {
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
          {/* Search bar */}
          <Search />

          {/* NEW: Home / Explore buttons below the search bar */}
          <div className="d-flex justify-content-center gap-2 mt-2">
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={goHome}
              aria-label="Go Home"
            >
              Home
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={goExplore}
              aria-label="Go Explore"
            >
              Explore
            </button>
          </div>
        </div>

        <div className="col-12 col-md-3 mt-4 mt-md-0 text-center">
          {/* Language toggle: show EN while in Chinese */}
          <button
            type="button"
            className="btn btn-sm btn-warning me-3 px-3 fw-semibold rounded-pill shadow border-0"
            onClick={() => dispatch(toggleLocale())}
            aria-label="Switch language"
          >
            中/EN
          </button>

          <Link to="/cart" style={{ textDecoration: "none" }}>
            <span id="cart" className="ms-3">购物车</span>
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
                  <Link className="dropdown-item" to="/admin/dashboard">控制台</Link>
                )}
                <Link className="dropdown-item" to="/me/orders">订单</Link>
                <Link className="dropdown-item" to="/me/profile">个人资料</Link>
                <button className="dropdown-item text-danger" type="button" onClick={logoutHandler}>
                  退出登录
                </button>
              </div>
            </div>
          ) : (
            !isLoading && (
              <Link to="/login" className="btn ms-4" id="login_btn">
                登录
              </Link>
            )
          )}
        </div>
      </nav>
    );
  }

  // -------------------------
  // English layout (default)
  // -------------------------
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
        {/* Search bar */}
        <Search />

        {/* NEW: Home / Explore buttons below the search bar */}
        <div className="d-flex justify-content-center gap-2 mt-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={goHome}
            aria-label="Go Home"
          >
            Home
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={goExplore}
            aria-label="Go Explore"
          >
            Explore
          </button>
        </div>
      </div>

      <div className="col-12 col-md-3 mt-4 mt-md-0 text-center">
        {/* Language toggle: show 中文 while in English */}
        <button
          type="button"
          className="btn btn-sm btn-warning me-3 px-3 fw-semibold rounded-pill shadow border-0"
          onClick={() => dispatch(toggleLocale())}
          aria-label="Switch language"
        >
          EN/中文
        </button>

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
              <button className="dropdown-item text-danger" type="button" onClick={logoutHandler}>
                Logout
              </button>
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
