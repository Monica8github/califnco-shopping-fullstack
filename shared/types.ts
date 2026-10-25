export const categories = [
  "Purifiers",
  "Dispensers",
  "Pumps",
  "Filters",
  "Spares",
  "Accessories",
] as const;
export type Role = "customer" | "dealer" | "admin";
export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  imageSource?: string;
  price: number;
  wholesalePrice?: number;
  stock: number;
  minDealerQty: number;
  featured: boolean;
  active: boolean;
  specs: Record<string, string>;
  lastPostedAt?: string;
}
export interface Address {
  name: string;
  phone: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lng?: number;
}
export interface Profile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  dealerStatus: "none" | "pending" | "approved" | "rejected";
  businessName?: string;
  address?: Address;
  createdAt: string;
  updatedAt?: string;
}
export interface CartItem {
  productId: string;
  quantity: number;
}
export type OrderStatus =
  | "awaiting_payment"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "payment_failed"
  | "paid_needs_review";
export interface OrderLine {
  productId: string;
  name: string;
  image: string;
  quantity: number;
  unitPrice: number;
}
export interface Order {
  id: string;
  uid: string;
  customerName: string;
  email: string;
  role: Role;
  items: OrderLine[];
  address: Address;
  amount: number;
  currency: "INR";
  status: OrderStatus;
  paymentStatus: "pending" | "captured" | "failed" | "review";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  history: { status: string; at: string }[];
}
export interface ServiceRequest {
  id: string;
  uid: string;
  customerName: string;
  type: string;
  productName: string;
  description: string;
  preferredDate: string;
  address: Address;
  status: "open" | "scheduled" | "in_progress" | "resolved" | "cancelled";
  createdAt: string;
  notes?: string;
}
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
export const retail = (price: number) => money(Math.round(price * 100));
