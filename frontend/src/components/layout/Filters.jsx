import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPriceQueryParams } from '../../helpers/helpers';
import StarRatings from "react-star-ratings";
import { useGetInitializedCategoriesQuery } from "../../redux/api/productsApi";

const Filters = () => {
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(0);
  const navigate = useNavigate();
  let [searchParams] = useSearchParams();

  // Load canonical L1/L2 (and filter out blindbox on this page)
  const { data: catData } = useGetInitializedCategoriesQuery();
  const l1Options = useMemo(() => {
    const all = catData?.l1 || [];
    return all.filter((c) => c !== "blindbox");
  }, [catData]);

  // read current l1/l2 from URL
  const currentL1 = searchParams.get("l1") || "";
  const currentL2 = searchParams.get("l2") || "";

  // L2 options depend on L1
  const l2Options = useMemo(() => {
    if (!currentL1) return [];
    return catData?.l2ByL1?.[currentL1] || [];
  }, [catData, currentL1]);

  useEffect(() => {
    searchParams.has('min') && setMin(searchParams.get('min'));
    searchParams.has('max') && setMax(searchParams.get('max'));
  }, []);

  // Write price filters
  const handlePriceSubmit = (e) => {
    e.preventDefault();
    searchParams = getPriceQueryParams(searchParams, "min", min);
    searchParams = getPriceQueryParams(searchParams, "max", max);
    navigate(window.location.pathname + "?" + searchParams.toString());
  };

  // Set L1 in URL (and reset/remove L2 when L1 changes)
  const onChangeL1 = (e) => {
    const value = e.target.value;
    if (value) searchParams.set("l1", value);
    else searchParams.delete("l1");
    // When L1 changes, drop stale L2
    searchParams.delete("l2");
    navigate(window.location.pathname + "?" + searchParams.toString());
  };

  // Set L2 in URL
  const onChangeL2 = (e) => {
    const value = e.target.value;
    if (value) searchParams.set("l2", value);
    else searchParams.delete("l2");
    navigate(window.location.pathname + "?" + searchParams.toString());
  };

  // Ratings checkbox behavior unchanged
  const onClickRating = (checkbox) => {
    const checkboxes = document.getElementsByName(checkbox.name);
    checkboxes.forEach((item) => { if (item !== checkbox) item.checked = false; });

    if (checkbox.checked === false) {
      if (searchParams.has(checkbox.name)) {
        searchParams.delete(checkbox.name);
      }
    } else {
      searchParams.set(checkbox.name, checkbox.value);
    }
    navigate(window.location.pathname + "?" + searchParams.toString());
  };

  const defaultChecked = (key, value) => searchParams.get(key) === value;

  return (
    <div className="border p-3 filter">
      <h3>Filters</h3>
      <hr />

      <h5 className="filter-heading mb-3">Price</h5>
      <form id="filter_form" className="px-2" onSubmit={handlePriceSubmit}>
        <div className="row">
          <div className="col">
            <input type="text" className="form-control" placeholder="Min ($)" name="min"
              value={min} onChange={(e) => setMin(e.target.value)} />
          </div>
          <div className="col">
            <input type="text" className="form-control" placeholder="Max ($)" name="max"
              value={max} onChange={(e) => setMax(e.target.value)} />
          </div>
          <div className="col">
            <button type="submit" className="btn btn-primary">GO</button>
          </div>
        </div>
      </form>

      <hr />
      <h5 className="mb-3">Category</h5>

      {/* L1 select (blindbox hidden) */}
      <div className="mb-3">
        <label htmlFor="l1_select" className="form-label">Level-1</label>
        <select className="form-select" id="l1_select" value={currentL1} onChange={onChangeL1}>
          <option value="">(All)</option>
          {l1Options.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>

      {/* L2 select (depends on L1) */}
      <div className="mb-3">
        <label htmlFor="l2_select" className="form-label">Level-2</label>
        <select className="form-select" id="l2_select" value={currentL2} onChange={onChangeL2} disabled={!currentL1}>
          <option value="">(All)</option>
          {l2Options.map((c) => (<option key={c} value={c}>{c}</option>))}
        </select>
      </div>

      <hr />
      <h5 className="mb-3">Ratings</h5>
      {[5,4,3,2,1].map((rating) => (
        <div className="form-check" key={rating}>
          <input
            className="form-check-input"
            type="checkbox"
            name="ratings"
            id={`rating_${rating}`}
            value={rating}
            defaultChecked={defaultChecked("ratings", rating.toString())}
            onClick={(e) => onClickRating(e.target)}
          />
          <label className="form-check-label" htmlFor={`rating_${rating}`}>
            <StarRatings
              rating={rating}
              starRatedColor="#ffb829"
              numberOfStars={5}
              name='rating'
              starDimension="21px"
              starSpacing="1px"
            />
          </label>
        </div>
      ))}
    </div>
  );
};

export default Filters;
