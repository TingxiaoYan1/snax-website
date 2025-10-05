// backend/utils/apiFilters.js
// Robust version that always holds a Mongoose *Query* in this.query

class APIFilters {
  constructor(query, queryStr) {
    // Ensure we start with a Query (not a Model). If a Model was passed, call .find()
    this.query =
      query && typeof query.limit === "function"
        ? query // already a Query
        : query.find(); // was a Model -> make it a Query

    this.queryStr = queryStr || {};
  }

  // Text search across name / chinesename / description
  search() {
    const { keyword } = this.queryStr;
    if (keyword && keyword.trim() !== "") {
      const regex = new RegExp(keyword, "i");
      this.query = this.query.find({
        $or: [{ name: regex }, { chinesename: regex }, { description: regex }],
      });
    }
    return this;
  }

  // Numeric filters: price / ratings, etc. (we DO NOT touch l1/l2 here)
  filters() {
    const queryCopy = { ...this.queryStr };

    // Remove non-filter fields (handled elsewhere)
    const removeFields = [
      "keyword",
      "page",
      "limit",
      // hierarchical handled in controller:
      "l1",
      "l2",
      "includeBlindbox",
      // legacy removed:
      "category",
    ];
    removeFields.forEach((el) => delete queryCopy[el]);

    // Convert [gte]/[lte]/... into Mongo operators
    Object.keys(queryCopy).forEach((key) => {
      if (key.includes("[")) {
        const [field, opWithBracket] = key.split("[");
        const op = opWithBracket.replace("]", "");
        if (!queryCopy[field]) queryCopy[field] = {};
        queryCopy[field][`$${op}`] = queryCopy[key];
        delete queryCopy[key];
      }
    });

    if (Object.keys(queryCopy).length > 0) {
      this.query = this.query.find(queryCopy);
    }

    return this;
  }

  pagination(resPerPage) {
    const currentPage = Number(this.queryStr.page) || 1;
    const skip = resPerPage * (currentPage - 1);
    this.query = this.query.limit(resPerPage).skip(skip);
    return this;
  }
}

export default APIFilters;
