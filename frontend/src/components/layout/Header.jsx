import React, { useState } from "react";
import Search from "./Search";
import { useAddSearchKeywordMutation, useGetMeQuery } from "../../redux/api/userApi";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { useLazyLogoutQuery } from "../../redux/api/authApi";
import { selectLocale, toggleLocale } from "../../redux/features/langSlice";

// ⬇️ NEW: import the server-cart query
import { useGetCartQuery } from "../../redux/api/cartApi";

const Header = () => {
  const [keyword, setKeyword] = useState("");
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [addSearchKeyword] = useAddSearchKeywordMutation();
    
  
  const submitHandler = async (e) => {
    e.preventDefault();
    const term = keyword.trim();
    if (term) {
      addSearchKeyword(term).catch(() => {}); // fire-and-forget; don't block navigation
      navigate(`/?keyword=${encodeURIComponent(term)}`);
    } else {
      navigate(`/`);
    }
  };

  const { isLoading } = useGetMeQuery();
  const [logout] = useLazyLogoutQuery();
  const locale = useSelector(selectLocale);

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

  // return(
  //   <header className="header section" role="banner">
  //     <div className="container header__inner">
  //       {/* Left LOGO (bar.png) */}
  //       <Link to="/" href="#home" className="header__logo" aria-label="Brand home">
  //         <img src="/images/bar.png" alt="Brand Logo" />
  //       </Link>
  //       {/* Center Search */}
  //       <div className="header__search">
  //         <form className="search" onSubmit={submitHandler}>
  //           <button
  //             className="search__button"
  //             type="submit"
  //             title="Search"
  //             aria-label="Search"
  //           >
  //             {/* Minimal magnifier icon */}
  //             <svg
  //               className="icon"
  //               viewBox="0 0 24 24"
  //               fill="none"
  //               stroke="currentColor"
  //               strokeWidth={2}
  //               strokeLinecap="round"
  //               strokeLinejoin="round"
  //               aria-hidden="true"
  //             >
  //               <circle cx={11} cy={11} r={8} />
  //               <line x1={21} y1={21} x2="16.65" y2="16.65" />
  //             </svg>
  //           </button>
  //           <input
  //             className="search__input"
  //             placeholder="Search all products…"
  //             aria-label="Search"
  //             type="text"
  //             id="search_field"
  //             aria-describedby="search_btn"
  //             name="keyword"
  //             value={keyword}
  //             onChange={(e) => setKeyword(e.target.value)}
  //           />
  //         </form>
  //       </div>
  //       {/* Right Icons: Language / Cart / Settings (no radius) */}
  //       <div className="header__icons" aria-label="Quick actions">
  //         <button className="icon-btn" title="Language" aria-label="Language">
  //           <svg
  //             className="icon"
  //             viewBox="0 0 24 24"
  //             fill="none"
  //             stroke="currentColor"
  //             strokeWidth={2}
  //             strokeLinecap="round"
  //             strokeLinejoin="round"
  //             aria-hidden="true"
  //           >
  //             <circle cx={12} cy={12} r={10} />
  //             <path d="M2 12h20" />
  //             <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  //           </svg>
  //         </button>
  //         <button className="icon-btn" title="Cart" aria-label="Cart">
  //           <svg
  //             className="icon"
  //             viewBox="0 0 24 24"
  //             fill="none"
  //             stroke="currentColor"
  //             strokeWidth={2}
  //             strokeLinecap="round"
  //             strokeLinejoin="round"
  //             aria-hidden="true"
  //           >
  //             <circle cx={9} cy={21} r={1} />
  //             <circle cx={20} cy={21} r={1} />
  //             <path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  //           </svg>
  //         </button>
  //       </div>
  //     </div>
  //   </header>
  // );

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
          <Search />
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
                <Link className="dropdown-item text-danger" type="button" onClick={logoutHandler}>
                  退出登录
                </Link>
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
        <Search />
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
