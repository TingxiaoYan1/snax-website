import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetProductDetailsQuery } from "../../redux/api/productsApi";
import { useUpsertCartItemMutation } from "../../redux/api/cartApi";
import Loader from "../layout/Loader";
import toast from "react-hot-toast";
import StarRatings from "react-star-ratings";
import { useSelector } from "react-redux";
import MetaData from "../layout/MetaData";
import NewReview from "../reviews/NewReview";
import ListReviews from "../reviews/ListReviews";
import { selectLocale } from "../../redux/features/langSlice";

import { useGetInitializedTagsQuery } from "../../redux/api/productsApi";
import NotFound from "../layout/NotFound";

const LABELS_EN = {
  sour: "Sour",
  sweet: "Sweet",
  bitter: "Bitter",
  spicy: "Spicy",
  salty: "Salty",
};

const LABELS_ZH = {
  sour: "酸",
  sweet: "甜",
  bitter: "苦",
  spicy: "辣",
  salty: "咸",
};

function titleCase(s = "") {
  return s.replace(/[_-]+/g, " ").replace(/\w\S*/g, (t) => t[0].toUpperCase() + t.slice(1));
}

const ProductDetails = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState(1);
  const [activeImg, setActiveImg] = useState("");
  const locale = useSelector(selectLocale);

  const { data, isLoading, error, isError } = useGetProductDetailsQuery(params?.id);
  const product = data?.product;

  const { isAuthenticated } = useSelector((state) => state.auth);
  const [upsertCartItem, { isLoading: isAdding }] = useUpsertCartItemMutation();

  // Optional schema for tags (numeric/boolean keys); falls back if missing
  const { data: tagSchema } = useGetInitializedTagsQuery(undefined, {
    // If you haven't wired the endpoint yet, avoid errors
    skip: false,
  });

  useEffect(() => {
    setActiveImg(product?.images?.[0]?.url || "/images/default_product.png");
  }, [product]);

  useEffect(() => {
    if (isError) {
      toast.error(error?.data?.message);
    }
  }, [isError]);

  const increaseQty = () => {
    const count = document.querySelector(".count");
    if (!product?.stock) return;
    if (count.valueAsNumber >= product.stock) return;
    const qty = count.valueAsNumber + 1;
    setQuantity(qty);
  };

  const decreaseQty = () => {
    const count = document.querySelector(".count");
    if (count.valueAsNumber <= 1) return;
    const qty = count.valueAsNumber - 1;
    setQuantity(qty);
  };

  const onAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error("Please log in to add items to your cart.");
      navigate(`/login?redirect=/product/${params?.id}`);
      return;
    }
    try {
      await upsertCartItem({ productId: product?._id, quantity }).unwrap();
      toast.success("Added to cart");
    } catch (e) {
      toast.error(e?.data?.message || "Failed to add to cart");
    }
  };

  // ---- Derive visible tags (numbers + booleans) with graceful fallback ----
  const numericKeys = useMemo(() => {
    const keysFromSchema = tagSchema?.numericKeys || [];
    const keysFromData = Object.keys(product?.tags?.numbers || {});
    const union = Array.from(new Set([...keysFromSchema, ...keysFromData]));
    return union;
  }, [tagSchema, product]);

  const booleanKeys = useMemo(() => {
    const keysFromSchema = tagSchema?.booleanKeys || [];
    const keysFromData = Object.keys(product?.tags?.booleans || {});
    const union = Array.from(new Set([...keysFromSchema, ...keysFromData]));
    return union;
  }, [tagSchema, product]);

  const numericPairs = numericKeys.map((k) => ({
    key: k,
    value: Number(product?.tags?.numbers?.[k] ?? 0),
  }));

  const truthyBooleanKeys = booleanKeys.filter((k) => !!product?.tags?.booleans?.[k]);

  const labelFor = (k) => {
    if (locale === "zh") return LABELS_ZH[k] || titleCase(k);
    return LABELS_EN[k] || titleCase(k);
  };

  if (isLoading) return <Loader />;

  if(error && error?.status == 404) {
    return <NotFound />
  }

  // ------------------------------- ZH VIEW ---------------------------------
  if (locale === "zh") {
    return (
      <>
        <MetaData title={product?.chinesename} />
        <div className="row d-flex justify-content-around">
          <div className="col-12 col-lg-5 img-fluid" id="product_image">
            <div className="p-3">
              <img
                className="d-block w-100"
                src={activeImg}
                alt={product?.chinesename}
                width="340"
                height="390"
              />
            </div>

            <div className="row justify-content-start mt-5">
              {product?.images?.map((img) => (
                <div className="col-2 ms-4 mt-2" key={img?.url}>
                  <button type="button" className="p-0 border-0 bg-transparent">
                    <img
                      className={`d-block border rounded p-3 cursor-pointer ${img.url === activeImg ? "border-warning" : ""}`}
                      height="100"
                      width="100"
                      src={img?.url}
                      alt={product?.chinesename}
                      onClick={() => setActiveImg(img.url)}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="col-12 col-lg-5 mt-5">
            <h3>{product?.chinesename}</h3>
            <p id="product_id">Product # {product?._id}</p>

            <hr />

            <div className="d-flex">
              <StarRatings
                rating={product?.ratings}
                starRatedColor="#ffb829"
                numberOfStars={5}
                name="rating"
                starDimension="22px"
                starSpacing="1px"
              />
              <span id="no-of-reviews" className="pt-1 ps-2">
                （{product?.numOfReviews} 条评价）
              </span>
            </div>

            <hr />

            <p id="product_price">¥{product?.price}</p>

            <div className="stockCounter d-inline">
              <span className="btn btn-danger minus" onClick={decreaseQty}>-</span>
              <input type="number" className="form-control count d-inline" value={quantity} readOnly />
              <span className="btn btn-primary plus" onClick={increaseQty}>+</span>
            </div>

            <button
              type="button"
              id="cart_btn"
              className="btn btn-primary d-inline ms-4"
              disabled={isAdding || (product?.stock ?? 0) <= 0}
              onClick={onAddToCart}
            >
              {isAdding ? "正在加入..." : "加入购物车"}
            </button>

            <hr />

            <p>
              状态：{" "}
              <span id="stock_status" className={(product?.stock ?? 0) > 0 ? "greenColor" : "redColor"}>
                {(product?.stock ?? 0) > 0 ? "有现货" : "缺货"}
              </span>
            </p>

            <hr />

            <h4 className="mt-2">描述：</h4>
            <p>{product?.description}</p>

            <hr />
            <p>
              分类：<strong>{product?.categories?.l1 || "—"}{product?.categories?.l2 ? ` / ${product?.categories?.l2}` : ""}</strong>
            </p>

            {/* ----------------------- Tags (ZH) ----------------------- */}
            {(numericPairs.length > 0 || truthyBooleanKeys.length > 0) && (
              <>
                <hr />
                <h5 className="mt-3">口味标签</h5>
                {numericPairs.length > 0 && (
                  <div className="mb-2">
                    {numericPairs.map(({ key, value }) => (
                      <span key={key} className="badge bg-secondary me-2 mb-2">
                        {labelFor(key)}：{value}
                      </span>
                    ))}
                  </div>
                )}
                {truthyBooleanKeys.length > 0 && (
                  <>
                    <h6 className="mt-2">属性</h6>
                    <div className="mb-2">
                      {truthyBooleanKeys.map((key) => (
                        <span key={key} className="badge bg-info text-dark me-2 mb-2">
                          {labelFor(key)}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            <hr />
            <p id="product_seller mb-3">
              卖家：<strong>{product?.seller}</strong>
            </p>

            {isAuthenticated ? (
              <NewReview productId={product?._id} />
            ) : (
              <div className="alert alert-danger my-5" role="alert">
                请登录后发表评论。
              </div>
            )}
          </div>
        </div>

        {product?.reviews?.length > 0 && <ListReviews reviews={product?.reviews} />}
      </>
    );
  }

  // ------------------------------- EN VIEW ---------------------------------
  return (
    <>
      <MetaData title={product?.name} />
      <div className="row d-flex justify-content-around">
        <div className="col-12 col-lg-5 img-fluid" id="product_image">
          <div className="p-3">
            <img
              className="d-block w-100"
              src={activeImg}
              alt={product?.name}
              width="340"
              height="390"
            />
          </div>

          <div className="row justify-content-start mt-5">
            {product?.images?.map((img) => (
              <div className="col-2 ms-4 mt-2" key={img?.url}>
                <button type="button" className="p-0 border-0 bg-transparent">
                  <img
                    className={`d-block border rounded p-3 cursor-pointer ${img.url === activeImg ? "border-warning" : ""}`}
                    height="100"
                    width="100"
                    src={img?.url}
                    alt={product?.name}
                    onClick={() => setActiveImg(img.url)}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="col-12 col-lg-5 mt-5">
          <h3>{product?.name}</h3>
          <p id="product_id">Product # {product?._id}</p>

          <hr />

          <div className="d-flex">
            <StarRatings
              rating={product?.ratings}
              starRatedColor="#ffb829"
              numberOfStars={5}
              name="rating"
              starDimension="22px"
              starSpacing="1px"
            />
            <span id="no-of-reviews" className="pt-1 ps-2">
              ({product?.numOfReviews} Reviews)
            </span>
          </div>

          <hr />

          <p id="product_price">${product?.price}</p>

          <div className="stockCounter d-inline">
            <span className="btn btn-danger minus" onClick={decreaseQty}>-</span>
            <input type="number" className="form-control count d-inline" value={quantity} readOnly />
            <span className="btn btn-primary plus" onClick={increaseQty}>+</span>
          </div>

          <button
            type="button"
            id="cart_btn"
            className="btn btn-primary d-inline ms-4"
            disabled={isAdding || (product?.stock ?? 0) <= 0}
            onClick={onAddToCart}
          >
            {isAdding ? "Adding..." : "Add to Cart"}
          </button>

          <hr />

          <p>
            Status:{" "}
            <span id="stock_status" className={(product?.stock ?? 0) > 0 ? "greenColor" : "redColor"}>
              {(product?.stock ?? 0) > 0 ? "In stock" : "Out of Stock"}
            </span>
          </p>

          <hr />

          <h4 className="mt-2">Description:</h4>
          <p>{product?.description}</p>

          <hr />
          <p>
            Category:&nbsp;
            <strong>
              {product?.categories?.l1 || "—"}
              {product?.categories?.l2 ? ` / ${product?.categories?.l2}` : ""}
            </strong>
          </p>

          {/* ----------------------- Tags (EN) ----------------------- */}
          {(numericPairs.length > 0 || truthyBooleanKeys.length > 0) && (
            <>
              <hr />
              <h5 className="mt-3">Tags</h5>

              {numericPairs.length > 0 && (
                <>
                  <h6 className="mt-2">Flavor</h6>
                  <div className="mb-2">
                    {numericPairs.map(({ key, value }) => (
                      <span key={key} className="badge bg-secondary me-2 mb-2">
                        {labelFor(key)}: {value}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {truthyBooleanKeys.length > 0 && (
                <>
                  <h6 className="mt-2">Attributes</h6>
                  <div className="mb-2">
                    {truthyBooleanKeys.map((key) => (
                      <span key={key} className="badge bg-info text-dark me-2 mb-2">
                        {labelFor(key)}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          <hr />
          <p id="product_seller mb-3">
            Sold by: <strong>{product?.seller}</strong>
          </p>

          {isAuthenticated ? (
            <NewReview productId={product?._id} />
          ) : (
            <div className="alert alert-danger my-5" role="alert">
              Login to post your review.
            </div>
          )}
        </div>
      </div>

      {product?.reviews?.length > 0 && <ListReviews reviews={product?.reviews} />}
    </>
  );
};

export default ProductDetails;
