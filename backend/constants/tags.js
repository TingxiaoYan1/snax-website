// backend/constants/tags.js

// Built-in numeric flavor tags (you can add more any time)
export const DEFAULT_NUMERIC_TAG_KEYS = [
  "sour",
  "sweet",
  "bitter",
  "spicy",
  "salty",
];

// Built-in boolean tags (empty for now; add when needed)
export const DEFAULT_BOOLEAN_TAG_KEYS = [];

// A tiny helper to expose the schema to the frontend/admin UI
export function getTagSchema() {
  return {
    numericKeys: DEFAULT_NUMERIC_TAG_KEYS,
    booleanKeys: DEFAULT_BOOLEAN_TAG_KEYS,
    numericConstraints: { min: 0, integerOnly: true },
  };
}
