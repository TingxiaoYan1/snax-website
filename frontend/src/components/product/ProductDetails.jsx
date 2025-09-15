import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGetProductDetailsQuery } from "../../redux/api/productsApi";
import { useUpsertCartItemMutation } from "../../redux/api/cartApi"; // NEW: server cart
import Loader from "../layout/Loader";
import toast from "react-hot-toast";
import StarRatings from "react-star-ratings";
import { useSelector } from "react-redux";
import MetaData from "../layout/MetaData";
import NewReview from "../reviews/NewReview";
import ListReviews from "../reviews/ListReviews";

const ProductDetails = () => {
  const params = useParams();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState(1);
  const [activeImg, setActiveImg] = useState("");

  const { data, isLoading, error, isError } = useGetProductDetailsQuery(params?.id);
  const product = data?.product;

  // Your auth flag (unchanged)
  const { isAuthenticated } = useSelector((state) => state.auth);

  // NEW: server cart mutation
  const [upsertCartItem, { isLoading: isAdding }] = useUpsertCartItemMutation();

  useEffect(() => {
    setActiveImg(
      product?.images?.[0]?.url || "/images/default_product.png"
    );
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

  // REPLACED: add-to-cart now requires login and hits server cart
  const onAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error("Please log in to add items to your cart.");
      // redirect back to this product after login
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

  if (isLoading) return <Loader />;

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
                    className={`d-block border rounded p-3 cursor-pointer ${
                      img.url === activeImg ? "border-warning" : ""
                    }`}
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
              {" "}
              ({product?.numOfReviews} Reviews){" "}
            </span>
          </div>

          <hr />

          <p id="product_price">${product?.price}</p>

          <div className="stockCounter d-inline">
            <span className="btn btn-danger minus" onClick={decreaseQty}>
              -
            </span>
            <input
              type="number"
              className="form-control count d-inline"
              value={quantity}
              readOnly
            />
            <span className="btn btn-primary plus" onClick={increaseQty}>
              +
            </span>
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
            <span
              id="stock_status"
              className={(product?.stock ?? 0) > 0 ? "greenColor" : "redColor"}
            >
              {(product?.stock ?? 0) > 0 ? "In stock" : "Out of Stock"}
            </span>
          </p>

          <hr />

          <h4 className="mt-2">Description:</h4>
          <p>{product?.description}</p>

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
