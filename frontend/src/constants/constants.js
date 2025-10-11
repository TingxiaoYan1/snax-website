// Level-1 options used by Explore (English labels only).
// NOTE: We intentionally exclude "blindbox" here; you’ll surface it on a separate page.
export const L1_OPTIONS = [
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
  "other", // legacy bucket for old single-field categories
];

// Level-2 chips for each L1
export const L2_BY_L1 = {
  instant: [
    "noodles",
    "rice",
    "crispy noodles",
    "chinese instant",
    "canned desserts",
    "canned ingredients",
  ],
  drinks: [
    "powder",
    "water",
    "tea",
    "juice",
    "sodas",
    "coffee",
    "milktea",
    "energy drink",
    "milk",
  ],
  crisps: ["potato", "corn", "rice", "sweet", "salty"],
  "biscuits & pastry": ["cookies", "biscuits", "western pastry", "eastern pastry"],
  sweets: ["candy", "milky", "chocolate", "candy toys", "puddings"],
  meat: ["duck", "chicken", "beef", "pork", "fish", "egg sausage"],
  vegan: ["chinese snack", "seaweed", "bean products"],
  "nuts & fruits": ["dry fruits", "nuts"],
  freezed: ["milk", "yogurt", "beverages", "ice-cream"],
  seasoning: ["kitchen", "spices", "soup base", "pickles"],
  "daily necessities": [],

  // Legacy single-field categories become L2 under L1 "other"
  other: [
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
    "Home",
  ],
};

// Optional helper you might use elsewhere
export const BLINDBOX_L1 = "blindbox";
