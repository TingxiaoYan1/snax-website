// backend/constants/categories.js

// Level-1 categories (English only)
export const CATEGORY_L1 = [
  "instant",
  "drinks",
  "crisps",
  "biscuits & pastry",
  "sweets",
  "meat",
  "vegan",
  "nuts & fruits",
  "freezed",
  "seasoning",
  "daily necessities",
  "blindbox",      // <= requested
  "other"          // <= legacy bucket for old single-field categories
];

// Level-2 set for each L1 (English only).
// Values extracted & normalized from your Excel ("Sheet1 (2)").
export const CATEGORY_L2_BY_L1 = {
  "instant": [
    "noodles",
    "rice",
    "crispy noodles",
    "chinese instant",
    "canned desserts",
    "canned ingredients"
  ],
  "drinks": [
    "powder",
    "water",
    "tea",
    "juice",
    "sodas",
    "coffee",
    "milktea",
    "energy drink",
    "milk"
  ],
  "crisps": ["potato", "corn", "rice", "sweet", "salty"],
  "biscuits & pastry": ["cookies", "biscuits", "western pastry", "eastern pastry"],
  "sweets": ["candy", "milky", "chocolate", "candy toys", "puddings"],
  "meat": ["duck", "chicken", "beef", "pork", "fish", "egg sausage"],
  "vegan": ["chinese snack", "seaweed", "bean products"],
  "nuts & fruits": ["dry fruits", "nuts"],
  "freezed": ["milk", "yogurt", "beverages", "ice-cream"],
  "seasoning": ["kitchen", "spices", "soup base", "pickles"],
  "daily necessities": [],

  // New L1 as requested
  "blindbox": [],

  // Legacy single-field categories become L2 under L1 "other"
  // (from your current product.js enum)
  "other": [
    "chips",
    "candys",
    "Electronics",
    "Cameras",
    "Laptops",
    "Accessories",
    "Headphones",
    "Food",
    "Books",
    "Sports",
    "Outdoor",
    "Home"
  ]
};

// Validate a given { l1, l2 } pair.
// - l1 must be in CATEGORY_L1
// - if l2 is present (non-empty), it must be in CATEGORY_L2_BY_L1[l1]
export function isValidCategoryPair(l1, l2) {
  if (!l1 || !CATEGORY_L1.includes(l1)) return false;
  if (l2 == null || l2 === "") return true;
  const allowed = CATEGORY_L2_BY_L1[l1] || [];
  return allowed.includes(l2);
}
