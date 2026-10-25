# Architecture and trust boundaries

The Android and browser clients authenticate with Firebase Auth and send an ID token to a Node API. The API verifies the token (including revocation), reads the authoritative user profile, validates the requested operation, and accesses Firestore through the Admin SDK. Firebase rules defend direct client reads/writes separately.

## Data

| Collection      | Main fields                                                                             | Writes                                       |
| --------------- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| `users`         | UID, email, name, role, dealer status, address                                          | Profile API; admin script/approval API       |
| `products`      | SKU, category, retail/wholesale price, inventory, photo, specs, last-post time          | Seed; admin API; stock and post transactions |
| `orders`        | Owner, canonical item snapshots, amount in paise, payment/provider IDs, history, expiry | Checkout/payment/fulfillment/expiry API      |
| `services`      | Owner, service type, address, preferred date, notes/status                              | Owner creation; admin update                 |
| `devices`       | Hashed token ID, owner UID, device token                                                | Authenticated device registration/removal    |
| `posts`         | Day, product snapshot, stage, caption/image, lease, container/media ID                  | Scheduled engine                             |
| `notifications` | Event/channel, status, timestamps, delivery error summary                               | Notification adapter                         |

Retail and wholesale catalogue prices are integer INR. Order amounts and item unit prices are integer paise. No shipping fee or tax is added by this sample; the total equals the server-priced line items. Fulfillment and service appointments are manual business operations.

## Checkout lifecycle

1. Merge duplicate SKUs and validate quantities/address. Read the latest role/dealer approval inside the transaction.
2. Read products, enforce availability/dealer minimums, calculate prices, reserve stock, and write one order identified by owner + idempotency key. Reusing a key for a different payload is rejected.
3. Create a test-mode Razorpay order. A known preparation failure releases stock. An uncertain/crashed attachment may need operator reconciliation; the stock reservation still has an expiry.
4. Verify payment HMAC, then fetch provider details. A signed webhook can confirm payment even if the client closes after paying. Repeated capture events do not duplicate confirmation.
5. Only a captured payment can move from confirmed → processing → shipped → delivered. A payment after stock release requires manual review.

The browser and Android clients use native/provider checkout interfaces; the API never handles raw card data. A failed network request does not mean the payment failed—check order history and the provider before creating a fresh payment.

## Routes

| Route                                 | Access                      | Purpose                                      |
| ------------------------------------- | --------------------------- | -------------------------------------------- |
| `GET /api/health`                     | Public                      | Configuration presence and mode              |
| `GET /api/products`                   | Public/optional signed user | Active catalogue with role-based pricing     |
| `POST /api/profile`                   | Signed Firebase user        | Create customer or pending dealer profile    |
| `GET/PATCH /api/me`                   | Profile owner               | Profile; no role editing                     |
| `POST/DELETE /api/devices`            | Signed profile              | Register/remove own push token               |
| `POST /api/checkout`                  | Customer/approved dealer    | Canonical order and test payment preparation |
| `POST /api/payments/verify`           | Order owner                 | Verify and capture confirmation              |
| `POST /api/payments/webhook`          | Razorpay HMAC               | Provider event confirmation                  |
| `GET /api/orders`                     | Owner                       | Own order history                            |
| `POST /api/orders/:id/cancel`         | Owner/admin                 | Cancel only unpaid orders                    |
| `GET/POST /api/services`              | Owner                       | List/book service                            |
| `GET /api/admin/overview`             | Admin                       | Dashboard records                            |
| `PUT /api/admin/products/:id`         | Admin                       | Product creation/edit                        |
| `PATCH /api/admin/dealers/:id`        | Admin                       | Approve/reject dealer                        |
| `PATCH /api/admin/orders/:id`         | Admin                       | Valid fulfillment transition                 |
| `PATCH /api/admin/services/:id`       | Admin                       | Service status/notes                         |
| `POST /api/admin/automation/step`     | Admin                       | Advance draft only                           |
| `POST /api/automation/daily`          | Scheduler bearer secret     | One durable daily step                       |
| `POST /api/maintenance/expire-orders` | Scheduler bearer secret     | Release expired unpaid stock                 |

`POST /api/demo/pay` and fixed demo identities are available only when `DEMO_MODE=true` **and** the process is neither on Vercel nor production. They are visibly labeled and excluded from real integration claims.

The web apps additionally provide a `browser-demo:` session adapter for sample evaluation. It handles requests in the browser without fetching protected API routes. Records live only in that tab's session storage; the real API rejects those strings as Firebase tokens. The persistent sample banner states that no payments, bookings, notifications or posts are sent. Browser samples across different origins are independent. The sample AI panel displays a previously generated example rather than claiming a live AI generation.

## Tradeoffs

The single Vercel entry point keeps the assignment simple and avoids framework-specific server state. Persistent state lives in Firestore. Local demo persistence is a mutex-protected JSON store and is never used as a cloud database. Daily jobs are resumable between requests; credentials and publishing capability stay on the server. Lists are bounded and no refund, real-time fleet delivery, general OAuth connection manager, or production-scale operations system is claimed.
