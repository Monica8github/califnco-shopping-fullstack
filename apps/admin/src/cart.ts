import { clientId } from "./id";

export type Cart = Record<string, number>;
export type CartItem = { productId: string; quantity: number };

export function readCart(storage: Pick<Storage, "getItem">, uid: string): Cart {
  try {
    const value = JSON.parse(storage.getItem("cart-" + uid) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const cart: Cart = {};
    for (const [productId, quantity] of Object.entries(value))
      if (typeof quantity === "number" && Number.isInteger(quantity) && quantity > 0)
        cart[productId] = quantity;
    return cart;
  } catch {
    return {};
  }
}

export function changeCartQuantity(
  cart: Cart,
  productId: string,
  delta: number,
  stock: number,
  minimum = 1,
): Cart {
  const quantity = Math.max(minimum, Math.min(stock, (cart[productId] || 0) + delta));
  return { ...cart, [productId]: quantity };
}

export function checkoutItems(cart: Cart): CartItem[] {
  return Object.entries(cart)
    .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

export function checkoutKey(
  storage: Pick<Storage, "getItem" | "setItem">,
  uid: string,
  fingerprint: string,
): string {
  const storageKey = "checkout-key-" + uid;
  try {
    const saved = JSON.parse(storage.getItem(storageKey) || "{}");
    if (saved.fingerprint === fingerprint && typeof saved.key === "string")
      return saved.key;
  } catch {
    // Replace malformed session data with a fresh idempotency key.
  }
  const key = clientId();
  storage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
  return key;
}