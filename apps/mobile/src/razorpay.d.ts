declare module "react-native-razorpay" {
  interface PaymentResult {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }
  interface CheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    order_id: string;
    prefill: { name: string; email: string; contact: string };
    theme: { color: string };
  }
  const Razorpay: { open(options: CheckoutOptions): Promise<PaymentResult> };
  export default Razorpay;
}
