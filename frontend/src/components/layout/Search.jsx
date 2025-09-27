//useless
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAddSearchKeywordMutation } from "../../redux/api/userApi";

const Search = () => {
  const [keyword, setKeyword] = useState("");
  const navigate = useNavigate();

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

  return (
    <form onSubmit={submitHandler}>
      <div className="input-group">
        <input
          type="text"
          id="search_field"
          aria-describedby="search_btn"
          className="form-control"
          placeholder="Enter Product Name ..."
          name="keyword"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <button id="search_btn" className="btn" type="submit">
          <i className="fa fa-search" aria-hidden="true"></i>
        </button>
      </div>
    </form>
  );
};

export default Search;
