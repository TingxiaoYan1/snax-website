import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLazyGetExploreProductsQuery } from "../redux/api/productsApi"; // must expose getExploreProducts
import ProductItem from "./product/ProductItem";
import Loader from "./layout/Loader";
import MetaData from "./layout/MetaData";
import toast from "react-hot-toast";
import { L1_OPTIONS, L2_BY_L1 } from "../constants/constants";
import { useSearchParams } from "react-router-dom";

const q = (s) => (s || "").toString().trim().toLowerCase();
const LIMIT = 12; // ask for 12 at a time (server may clamp)

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- initial state from URL -> sessionStorage -> default
  const initialL1 = searchParams.get("l1") || sessionStorage.getItem("exp_l1") || "all";
  const initialL2 = searchParams.get("l2") || sessionStorage.getItem("exp_l2") || "";
  const initialSort = searchParams.get("sort") || "newest"; // "newest" | "price-asc" | "price-desc"

  const [selectedL1, setSelectedL1] = useState(initialL1);
  const [selectedL2, setSelectedL2] = useState(initialL2);
  const [sortKey, setSortKey] = useState(initialSort);

  const l1Options = useMemo(() => ["all", ...L1_OPTIONS], []);

  // ---- data + paging
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // ---- guards & helpers
  const seenIdsRef = useRef(new Set()); // strong de-dup by _id
  const canPageRef = useRef(false);     // don't prefetch during reset
  const inFlightRef = useRef(false);    // avoid parallel appends
  const sentinelRef = useRef(null);

  const [triggerExplore, { isFetching }] = useLazyGetExploreProductsQuery();

  // ---- keep URL + session in sync
  useEffect(() => {
    const params = {};
    if (selectedL1 && q(selectedL1) !== "all") params.l1 = selectedL1;
    if (selectedL2) params.l2 = selectedL2;
    if (sortKey && sortKey !== "newest") params.sort = sortKey;

    setSearchParams(params, { replace: true });
    sessionStorage.setItem("exp_l1", selectedL1);
    sessionStorage.setItem("exp_l2", selectedL2);
  }, [selectedL1, selectedL2, sortKey, setSearchParams]);

  // ---- respond to back/forward changes
  useEffect(() => {
    const urlL1 = searchParams.get("l1") || "all";
    const urlL2 = searchParams.get("l2") || "";
    const urlSort = searchParams.get("sort") || "newest";

    if (urlL1 !== selectedL1) setSelectedL1(urlL1);
    if (urlL2 !== selectedL2) setSelectedL2(urlL2);
    if (urlSort !== sortKey) setSortKey(urlSort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ---- core fetch (cursor pagination)
  const fetchExplore = useCallback(
    async (cursor, mode /* "reset" | "append" */) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const data = await triggerExplore({
          l1: selectedL1,
          l2: selectedL2,
          limit: LIMIT,
          cursor,         // opaque: either ObjectId string or base64 cursor (for price sorts)
          sort: sortKey,  // "newest" | "price-asc" | "price-desc"
        }).unwrap();

        const list = data?.items || [];
        const fresh = [];

        for (const p of list) {
          const id = p?._id && String(p._id);
          if (!id) continue;
          if (!seenIdsRef.current.has(id)) {
            seenIdsRef.current.add(id);
            fresh.push(p);
          }
        }

        if (mode === "reset") {
          setItems(fresh);
        } else {
          setItems((prev) => [...prev, ...fresh]);
        }

        setNextCursor(data?.nextCursor || null);
        setHasMore(Boolean(data?.hasMore));

        if (mode === "reset") {
          // arm sentinel after first paint to avoid instant prefetch
          requestAnimationFrame(() => {
            canPageRef.current = true;
          });
        }
      } catch (e) {
        toast.error(e?.data?.message || "Failed to load products");
      } finally {
        inFlightRef.current = false;
      }
    },
    [triggerExplore, selectedL1, selectedL2, sortKey]
  );

  // ---- reset when filters or sort change
  useEffect(() => {
    canPageRef.current = false;
    seenIdsRef.current = new Set();
    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    fetchExplore(null, "reset");
  }, [selectedL1, selectedL2, sortKey, fetchExplore]);

  // ---- load more on intersection
  const loadMore = useCallback(() => {
    if (!canPageRef.current || inFlightRef.current || isFetching || !hasMore || !nextCursor) return;
    fetchExplore(nextCursor, "append");
  }, [fetchExplore, hasMore, isFetching, nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) loadMore();
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  // ---- L1/L2 UI interactions
  const onClickL1 = (l1) => {
    setSelectedL1(l1);
    // if current L2 doesn't belong to new L1, clear it
    const l2List = L2_BY_L1[q(l1)] || [];
    if (!l2List.some((x) => q(x) === q(selectedL2))) {
      setSelectedL2("");
    }
  };

  const l2Current = L2_BY_L1[q(selectedL1)] || [];

  return (
    <>
      <MetaData title="Explore Products" />

      <div className="container mt-3">
        {/* L1 tabs */}
        <div className="d-flex flex-wrap gap-3 align-items-center">
          {l1Options.map((l1) => {
            const active = q(l1) === q(selectedL1);
            return (
              <button
                key={l1}
                className={`btn ${active ? "btn-success" : "btn-outline-secondary"} rounded-pill px-3`}
                onClick={() => onClickL1(l1)}
              >
                {l1}
              </button>
            );
          })}
        </div>

        {/* L2 chips */}
        <div className="d-flex flex-wrap gap-2 align-items-center mt-3">
          <button
            className={`btn btn-sm rounded-pill ${!selectedL2 ? "btn-success" : "btn-outline-secondary"}`}
            onClick={() => setSelectedL2("")}
          >
            (All)
          </button>
          {l2Current.map((l2) => {
            const active = q(l2) === q(selectedL2);
            return (
              <button
                key={l2}
                className={`btn btn-sm rounded-pill ${active ? "btn-success" : "btn-outline-secondary"}`}
                onClick={() => setSelectedL2(l2)}
              >
                {l2}
              </button>
            );
          })}
        </div>

        {/* Sort control */}
        <div className="d-flex justify-content-end align-items-center mt-3">
          <span className="me-2 text-muted">Sort by:</span>
          <select
            className="form-select form-select-sm"
            style={{ width: 180 }}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
          </select>
        </div>

        {/* Grid */}
        <div className="row mt-3">
          {items.map((product) => (
            <ProductItem key={product._id} product={product} columnSize={3} />
          ))}
        </div>

        {/* Status / loader */}
        <div className="my-4 text-center">
          {(isFetching || inFlightRef.current) && <Loader />}
          {!hasMore && !isFetching && !inFlightRef.current && (
            <div className="text-muted">You’ve reached the end 🎉</div>
          )}
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} />
      </div>
    </>
  );
}
