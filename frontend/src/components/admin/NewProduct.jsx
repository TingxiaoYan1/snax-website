import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import MetaData from "../layout/MetaData";
import AdminLayout from "../layout/AdminLayout";
import { useNavigate } from "react-router-dom";

// RTK Query
import {
  useCreateProductMutation,
  useGetInitializedCategoriesQuery,
  useGetInitializedTagsQuery,
} from "../../redux/api/productsApi";

/**
 * Admin "Create Product" with full Product model fields (except photos).
 * - Categories: L1/L2 cascading select
 * - Tags: dynamic numeric/boolean from /products/tags/schema
 */
const NewProduct = () => {
  const navigate = useNavigate();

  // Load canonical L1/L2 and Tag schema
  const { data: catData, isLoading: catsLoading, isError: catsError } =
    useGetInitializedCategoriesQuery();
  const { data: tagSchema } = useGetInitializedTagsQuery();

  // Base product fields
  const [form, setForm] = useState({
    name: "",
    chinesename: "",
    description: "",
    chinesedescription: "",
    price: "",
    stock: "",
    seller: "",
    expiredate: "1 Month",
    ratings: 0,
    numOfReviews: 0,
  });

  // Categories (L1/L2)
  const [l1, setL1] = useState("");
  const [l2, setL2] = useState("");

  const l2Options = useMemo(() => {
    if (!catData?.l2ByL1 || !l1) return [];
    return catData.l2ByL1[l1] || [];
  }, [catData, l1]);

  // Tags (numbers/booleans)
  const [tagNumbers, setTagNumbers] = useState({});
  const [tagBooleans, setTagBooleans] = useState({});

  // API mutation
  const [createProduct, { isLoading, error, isSuccess }] =
    useCreateProductMutation();

  // Initialize defaults once categories/tags load
  useEffect(() => {
    if (catData?.l1?.length && !l1) {
      const defaultL1 = catData.l1[0];
      setL1(defaultL1);
      const defaults = catData.l2ByL1?.[defaultL1] || [];
      setL2(defaults.length ? defaults[0] : "");
    }
  }, [catData, l1]);

  useEffect(() => {
    if (tagSchema) {
      // Initialize numeric/boolean tags to sensible defaults
      const nums = {};
      (tagSchema.numericKeys || []).forEach((k) => (nums[k] = 0));
      const bools = {};
      (tagSchema.booleanKeys || []).forEach((k) => (bools[k] = false));
      setTagNumbers(nums);
      setTagBooleans(bools);
    }
  }, [tagSchema]);

  // Mutation feedback
  useEffect(() => {
    if (error) toast.error(error?.data?.message || "Create failed");
    if (isSuccess) {
      toast.success("Product created");
      navigate("/admin/products");
    }
  }, [error, isSuccess, navigate]);

  // Handlers
  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onChangeL1 = (e) => {
    const nextL1 = e.target.value;
    setL1(nextL1);
    const nextL2s = catData?.l2ByL1?.[nextL1] || [];
    setL2(nextL2s.length ? nextL2s[0] : "");
  };
  const onChangeL2 = (e) => setL2(e.target.value);

  const onChangeTagNumber = (key) => (e) => {
    const v = e.target.value;
    setTagNumbers((prev) => ({ ...prev, [key]: Math.max(0, parseInt(v || 0, 10)) }));
  };
  const onChangeTagBoolean = (key) => (e) => {
    setTagBooleans((prev) => ({ ...prev, [key]: !!e.target.checked }));
  };

  const submitHandler = (e) => {
    e.preventDefault();
    if (!l1) return toast.error("Please select Level-1 category");

    // Build full body with all model attributes (except images)
    const body = {
      name: form.name,
      chinesename: form.chinesename,
      description: form.description,
      chinesedescription: form.chinesedescription,
      price: Number(form.price),
      stock: Number(form.stock),
      seller: form.seller,
      expiredate: form.expiredate,
      ratings: Number(form.ratings),
      numOfReviews: Number(form.numOfReviews),

      categories: { l1, l2: l2 || null },

      tags: {
        numbers: tagNumbers,
        booleans: tagBooleans,
      },
    };

    createProduct(body);
  };

  return (
    <AdminLayout>
      <MetaData title={"Create New Product"} />
      <div className="row wrapper">
        <div className="col-10 col-lg-10 mt-5 mt-lg-0">
          <form className="shadow rounded bg-body" onSubmit={submitHandler}>
            <h2 className="mb-4">New Product</h2>

            {/* Basic info */}
            <div className="mb-3">
              <label htmlFor="name_field" className="form-label">Name</label>
              <input type="text" id="name_field" className="form-control"
                     name="name" value={form.name} onChange={onChange}/>
            </div>

            <div className="mb-3">
              <label htmlFor="chinesename_field" className="form-label">Chinese Name</label>
              <input type="text" id="chinesename_field" className="form-control"
                     name="chinesename" value={form.chinesename} onChange={onChange}/>
            </div>

            <div className="mb-3">
              <label htmlFor="description_field" className="form-label">Description</label>
              <textarea className="form-control" id="description_field" rows="6"
                        name="description" value={form.description} onChange={onChange}/>
            </div>

            <div className="mb-3">
              <label htmlFor="chinesedescription_field" className="form-label">Chinese Description</label>
              <textarea className="form-control" id="chinesedescription_field" rows="6"
                        name="chinesedescription" value={form.chinesedescription} onChange={onChange}/>
            </div>

            {/* Pricing & stock */}
            <div className="row">
              <div className="mb-3 col">
                <label htmlFor="price_field" className="form-label">Price</label>
                <input type="number" step="0.01" id="price_field" className="form-control"
                       name="price" value={form.price} onChange={onChange}/>
              </div>
              <div className="mb-3 col">
                <label htmlFor="stock_field" className="form-label">Stock</label>
                <input type="number" id="stock_field" className="form-control"
                       name="stock" value={form.stock} onChange={onChange}/>
              </div>
            </div>

            {/* Categories */}
            <div className="row">
              <div className="mb-3 col">
                <label htmlFor="l1_field" className="form-label">Category (L1)</label>
                <select className="form-select" id="l1_field" name="l1" value={l1}
                        onChange={onChangeL1} disabled={catsLoading || catsError}>
                  {(catData?.l1 || []).map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="mb-3 col">
                <label htmlFor="l2_field" className="form-label">Subcategory (L2)</label>
                <select className="form-select" id="l2_field" name="l2" value={l2}
                        onChange={onChangeL2} disabled={catsLoading || catsError || !l1}>
                  {l2Options.length === 0
                    ? <option value="">(None)</option>
                    : l2Options.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
            </div>

            {/* Seller & misc */}
            <div className="row">
              <div className="mb-3 col">
                <label htmlFor="seller_field" className="form-label">Seller</label>
                <input type="text" id="seller_field" className="form-control"
                       name="seller" value={form.seller} onChange={onChange}/>
              </div>
              <div className="mb-3 col">
                <label htmlFor="expiredate_field" className="form-label">Expire Date</label>
                <input type="text" id="expiredate_field" className="form-control"
                       name="expiredate" value={form.expiredate} onChange={onChange}/>
              </div>
            </div>

            {/* Ratings controls (admin-editable as requested) */}
            <div className="row">
              <div className="mb-3 col">
                <label htmlFor="ratings_field" className="form-label">Ratings (avg)</label>
                <input type="number" step="0.1" id="ratings_field" className="form-control"
                       name="ratings" value={form.ratings} onChange={onChange}/>
              </div>
              <div className="mb-3 col">
                <label htmlFor="numReviews_field" className="form-label">Number of Reviews</label>
                <input type="number" id="numReviews_field" className="form-control"
                       name="numOfReviews" value={form.numOfReviews} onChange={onChange}/>
              </div>
            </div>

            {/* TAGS: numeric */}
            {tagSchema?.numericKeys?.length > 0 && (
              <>
                <hr />
                <h5>Flavor Tags</h5>
                <div className="row">
                  {tagSchema.numericKeys.map((k) => (
                    <div className="mb-3 col-6 col-md-3" key={k}>
                      <label className="form-label" htmlFor={`tag_num_${k}`}>{k}</label>
                      <input type="number" min="0" step="1" id={`tag_num_${k}`} className="form-control"
                             value={tagNumbers[k] ?? 0} onChange={onChangeTagNumber(k)}/>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* TAGS: booleans */}
            {tagSchema?.booleanKeys?.length > 0 && (
              <>
                <h5>Boolean Tags</h5>
                <div className="row">
                  {tagSchema.booleanKeys.map((k) => (
                    <div className="form-check col-6 col-md-3" key={k}>
                      <input className="form-check-input" type="checkbox" id={`tag_bool_${k}`}
                             checked={!!tagBooleans[k]} onChange={onChangeTagBoolean(k)} />
                      <label className="form-check-label" htmlFor={`tag_bool_${k}`}>{k}</label>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button type="submit" className="btn w-100 py-2" disabled={isLoading}>
              {isLoading ? "Creating..." : "CREATE"}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
};

export default NewProduct;
