export const calculateOrderCost = (cartItems) => {
  const itemsPrice = cartItems?.reduce(
    (acc, item) => acc + Number(item.price) * Number(item.quantity),
    0
  );

  // keep your existing shipping rule
  const shippingPrice = itemsPrice > 200 ? 0 : 5;

  // TAX AFTER DEDUCTION: since itemsPrice here can be the discounted subtotal,
  // tax is computed on the discounted base.
  const taxPrice = Number((0.15 * itemsPrice).toFixed(2));

  const totalPrice = Number((itemsPrice + shippingPrice + taxPrice).toFixed(2));

  // preserve your original return shape (itemsPrice as fixed string)
  return {
    itemsPrice: Number(itemsPrice).toFixed(2),
    shippingPrice,
    taxPrice,
    totalPrice,
  };
};