import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  Handshake,
  Wrench,
  Sparkles,
  Settings,
  Search,
  Bell,
  ArrowUpRight,
  ArrowRight,
  Plus,
  ChevronRight,
  LogOut,
  Menu,
  Download,
  Check,
  RefreshCw,
  ArrowDownRight,
  Clock,
  SlidersHorizontal,
  X,
  CircleHelp,
} from "lucide-react";
import { api, type Session } from "./api";
import {
  Brand,
  Badge,
  Empty,
  Loading,
  Modal,
  Field,
  FormError,
  date,
} from "./components";
import {
  categories,
  money,
  retail,
  type Product,
  type Order,
  type Profile,
  type ServiceRequest,
} from "../../../shared/types";
type Data = {
  orders: Order[];
  users: Profile[];
  products: Product[];
  services: ServiceRequest[];
  notifications: any[];
  posts: any[];
  integrations: Record<string, boolean>;
  mode: string;
};
const nav = [
  ["overview", "Overview", LayoutDashboard],
  ["orders", "Orders", ShoppingBag],
  ["products", "Products", Package],
  ["dealers", "Dealer network", Handshake],
  ["customers", "Customers", Users],
  ["services", "Service desk", Wrench],
  ["automation", "AI studio", Sparkles],
  ["settings", "Settings", Settings],
] as const;
const matches = (value: unknown, search: string) =>
  JSON.stringify(value).toLowerCase().includes(search.toLowerCase());
export default function Admin({
  session,
  automationOnly = false,
}: {
  session: Session;
  automationOnly?: boolean;
}) {
  const [page, setPage] = useState(automationOnly ? "automation" : "overview"),
    [data, setData] = useState<Data | null>(null),
    [loadFailed, setLoadFailed] = useState(false),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [modal, setModal] = useState<{ type: string; data?: any } | null>(null),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false);
  async function refresh() {
    try {
      setData(await api("/admin/overview"));
      setLoadFailed(false);
      setError("");
    } catch (e) {
      setLoadFailed(true);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    setStatus("all");
    setSearch("");
    setMenu(false);
  }, [page]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function mutate(
    path: string,
    method: string,
    body: unknown,
    message = "Changes saved",
  ) {
    setBusy(true);
    setError("");
    try {
      await api(path, method, body);
      await refresh();
      setToast(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const title = nav.find((n) => n[0] === page)?.[1] || "Overview";
  const stats = useMemo(() => {
    const orders = data?.orders || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekRevenue = orders
      .filter(
        (o) =>
          o.paymentStatus === "captured" &&
          new Date(o.createdAt).getTime() >= weekStart.getTime() &&
          new Date(o.createdAt).getTime() < today.getTime() + 86400000,
      )
      .reduce((sum, o) => sum + o.amount, 0);
    return {
      revenue: orders
        .filter((o) => o.paymentStatus === "captured")
        .reduce((s, o) => s + o.amount, 0),
      weekRevenue,
      orders: orders.length,
      pending:
        data?.users.filter(
          (u) => u.role === "dealer" && u.dealerStatus === "pending",
        ).length || 0,
      services:
        data?.services.filter(
          (s) => !["resolved", "cancelled"].includes(s.status),
        ).length || 0,
    };
  }, [data]);
  const filteredOrders =
    data?.orders.filter(
      (o) => matches(o, search) && (status === "all" || o.status === status),
    ) || [];
  const filteredProducts =
    data?.products.filter(
      (p) => matches(p, search) && (status === "all" || p.category === status),
    ) || [];
  const filteredServices =
    data?.services.filter(
      (s) => matches(s, search) && (status === "all" || s.status === status),
    ) || [];
  function exportOrders() {
    if (!filteredOrders.length) {
      setToast("No matching orders to export.");
      return;
    }
    const csv = [
      "Order,Customer,Status,Payment,Total INR",
      ...filteredOrders.map((o) =>
        [
          o.id,
          o.customerName,
          o.status,
          o.paymentStatus,
          (o.amount / 100).toFixed(2),
        ]
          .map(
            (v) =>
              '"' +
              String(v)
                .replaceAll('"', '""')
                .replace(/^[=+@-]/, "'") +
              '"',
          )
          .join(","),
      ),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "califnco-orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function dryRun() {
    setBusy(true);
    setError("");
    try {
      for (let i = 0; i < 8; i++) {
        const r = await api("/admin/automation/step", "POST", {});
        await refresh();
        if (r.done) {
          if (r.post.status === "failed" || r.post.status === "needs_review")
            throw new Error(r.post.error);
          setToast(
            r.post.exampleImage
              ? "Example loaded. No live AI request or Instagram post was made."
              : r.post.fixture
                ? "Local fixture saved. No AI call or Instagram post was made."
                : "AI draft generated. No Instagram post was made.",
          );
          break;
        }
        if (r.post.error) throw new Error(r.post.error);
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function orderTable(rows: Order[]) {
    return rows.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>
                  <button
                    className="text-link"
                    onClick={() => setModal({ type: "order", data: o })}
                  >
                    {o.id.slice(0, 14)}
                  </button>
                  <small>{date(o.createdAt)}</small>
                </td>
                <td>
                  <div className="person">
                    <span className="avatar">{o.customerName.slice(0, 1)}</span>
                    <div>
                      {o.customerName}
                      <small>{o.role}</small>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="truncate">{o.items[0]?.name}</span>
                  <small>
                    {o.items.reduce((s, i) => s + i.quantity, 0)} items
                  </small>
                </td>
                <td className="strong">{money(o.amount)}</td>
                <td>
                  <Badge value={o.status} />
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={"View " + o.id}
                    onClick={() => setModal({ type: "order", data: o })}
                  >
                    <ChevronRight size={17} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title="No matching orders"
        text="Try a different filter or wait for the first checkout."
      />
    );
  }
  return (
    <div className="workspace">
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Brand />
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {nav
            .filter(
              ([key]) =>
                !automationOnly || ["automation", "settings"].includes(key),
            )
            .map(([key, label, Icon]) => (
              <button
                key={key}
                className={page === key ? "active" : ""}
                onClick={() => setPage(key)}
              >
                <Icon size={18} />
                {label}
                {key === "dealers" && stats.pending > 0 && (
                  <span className="nav-count">{stats.pending}</span>
                )}
                {key === "automation" && <span className="new-tag">AI</span>}
              </button>
            ))}
        </nav>
        <div className="sidebar-note">
          <div className="note-icon">
            <Sparkles size={17} />
          </div>
          <strong>A little less manual.</strong>
          <p>Bring your catalogue to life with daily product stories.</p>
          <button onClick={() => setPage("automation")}>
            Open AI studio <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setPage("settings")}>
            <CircleHelp size={17} />
            Setup & support
          </button>
          <button onClick={session.logout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
        <div className="user-chip">
          <span className="avatar dark">{session.profile!.name[0]}</span>
          <div>
            <strong>{session.profile!.name}</strong>
            <small>Administrator</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-shade"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle menu"
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{title}</b>
          </div>
          <div className="top-actions">
            <span className="date-label">
              {new Date().toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              className="icon-button"
              aria-label="Notification activity"
              onClick={() => setModal({ type: "notifications" })}
            >
              <Bell size={19} />
            </button>
            <span className="avatar dark small">
              {session.profile!.name[0]}
            </span>
          </div>
        </header>
        <div className="content">
          {data?.mode === "local-demo" && (
            <div className="demo-banner">
              <span className="online-dot" /> Local demo · sample records ·
              payments and messages are simulated
            </div>
          )}
          <div className="page-head">
            <div>
              <div className="eyebrow">YOUR WATER CARE WORKSPACE</div>
              <h1>
                {page === "overview"
                  ? `Good to see you, ${session.profile!.name.split(" ")[0]}.`
                  : title}
              </h1>
              <p>
                {
                  (
                    {
                      overview:
                        "Here’s what’s flowing through your business today.",
                      orders:
                        "Track every order, from first click to doorstep.",
                      products:
                        "A considered catalogue for every water care need.",
                      dealers:
                        "Build stronger partnerships, one approval at a time.",
                      customers:
                        "The people at the heart of your water care business.",
                      services: "Keep water care going long after the sale.",
                      automation:
                        "Your products. Fresh stories. Less manual work.",
                      settings: "Connect the services behind your workspace.",
                    } as any
                  )[page]
                }
              </p>
            </div>
            <div className="head-actions">
              <button className="secondary icon-label" onClick={refresh}>
                <RefreshCw size={16} />
                Refresh
              </button>
              {page === "products" ? (
                <button
                  className="primary"
                  onClick={() => setModal({ type: "product" })}
                >
                  <Plus size={16} />
                  Add product
                </button>
              ) : page === "automation" ? (
                <button className="primary" disabled={busy} onClick={dryRun}>
                  <Sparkles size={16} />
                  {busy
                    ? "Preparing…"
                    : data?.mode === "browser-demo"
                      ? "Show sample post"
                      : "Generate dry run"}
                </button>
              ) : (
                !automationOnly && (
                  <button
                    className="primary"
                    onClick={() => {
                      setPage("orders");
                      exportOrders();
                    }}
                  >
                    <Download size={16} />
                    Export orders
                  </button>
                )
              )}
            </div>
          </div>
          <FormError error={error} />
          {!data ? (
            loadFailed ? (
              <div className="panel profile-panel">
                <h2>We couldn’t load the administration data.</h2>
                <p>Check your server connection and permissions, then retry.</p>
                <button className="secondary" onClick={() => void refresh()}>
                  Retry
                </button>
              </div>
            ) : (
              <Loading />
            )
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="metric-grid">
                    {[
                      [
                        ShoppingBag,
                        "Total revenue",
                        money(stats.revenue),
                        "All captured payments",
                      ],
                      [
                        Package,
                        "Orders",
                        String(stats.orders),
                        "Across customer & dealer orders",
                      ],
                      [
                        Handshake,
                        "Dealer applications",
                        String(stats.pending),
                        "Awaiting your review",
                      ],
                      [
                        Wrench,
                        "Open service requests",
                        String(stats.services),
                        "Ready for the next step",
                      ],
                    ].map(([Icon, label, value, note]: any) => (
                      <div className="metric" key={label}>
                        <div className="metric-top">
                          <span>{label}</span>
                          <Icon size={18} />
                        </div>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </div>
                    ))}
                  </div>
                  <div className="overview-grid">
                    <section className="panel revenue-panel">
                      <div className="panel-head">
                        <div>
                          <h2>Sales at a glance</h2>
                          <p>Captured revenue over the last 7 days</p>
                        </div>
                        <span className="pill">Last 7 days</span>
                      </div>
                      <div className="revenue-total">
                        {money(stats.weekRevenue)} <small>last 7 days</small>
                      </div>
                      <div className="bar-chart">
                        {Array.from({ length: 7 }, (_, i) => {
                          const d = new Date();
                          d.setDate(d.getDate() - 6 + i);
                          const value = data.orders
                            .filter(
                              (o) =>
                                o.paymentStatus === "captured" &&
                                new Date(o.createdAt).toDateString() ===
                                  d.toDateString(),
                            )
                            .reduce((s, o) => s + o.amount, 0);
                          return (
                            <div className="bar-col" key={i}>
                              <span className="bar-value">
                                {value ? money(value) : "—"}
                              </span>
                              <div className="bar-track">
                                <div
                                  className={
                                    "bar " + (i === 6 ? "current" : "")
                                  }
                                  style={{
                                    height: `${value ? Math.max(10, (value / Math.max(stats.weekRevenue, 1)) * 100) : 2}%`,
                                  }}
                                  title={money(value)}
                                />
                              </div>
                              <span>
                                {d.toLocaleDateString("en-IN", {
                                  weekday: "short",
                                })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                    <section className="attention-panel">
                      <div className="eyebrow">
                        A LITTLE ATTENTION GOES A LONG WAY
                      </div>
                      <h2>
                        Keep things
                        <br />
                        moving forward.
                      </h2>
                      <p>Your next steps, in one place.</p>
                      <button onClick={() => setPage("dealers")}>
                        <span>
                          <Handshake size={19} />
                          <b>{stats.pending} dealer applications</b>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                      <button onClick={() => setPage("services")}>
                        <span>
                          <Wrench size={19} />
                          <b>{stats.services} service requests</b>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                      <button onClick={() => setPage("products")}>
                        <span>
                          <Package size={19} />
                          <b>
                            {data.products.filter((p) => p.stock < 10).length}{" "}
                            low-stock products
                          </b>
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Recent orders</h2>
                        <p>A closer look at the latest activity</p>
                      </div>
                      <button
                        className="text-link"
                        onClick={() => setPage("orders")}
                      >
                        View all orders <ArrowUpRight size={15} />
                      </button>
                    </div>
                    {orderTable(data.orders.slice(0, 5))}
                  </section>
                  <div className="bottom-strip">
                    <span>
                      <Check size={15} /> Server-verified orders and pricing
                    </span>
                    <span>Thoughtful water care, end to end.</span>
                  </div>
                </>
              )}
              {[
                "orders",
                "products",
                "services",
                "dealers",
                "customers",
              ].includes(page) && (
                <div className="toolbar">
                  <div className="search-field">
                    <Search size={18} />
                    <input
                      aria-label={"Search " + title}
                      placeholder={"Search " + title.toLowerCase() + "…"}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        className="icon-button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {["orders", "products", "services"].includes(page) && (
                    <div className="filter-field">
                      <SlidersHorizontal size={16} />
                      <select
                        aria-label="Filter"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="all">
                          All {page === "products" ? "categories" : "statuses"}
                        </option>
                        {(page === "products"
                          ? categories
                          : page === "orders"
                            ? [
                                "awaiting_payment",
                                "confirmed",
                                "processing",
                                "shipped",
                                "delivered",
                                "cancelled",
                                "payment_failed",
                                "paid_needs_review",
                              ]
                            : [
                                "open",
                                "scheduled",
                                "in_progress",
                                "resolved",
                                "cancelled",
                              ]
                        ).map((s) => (
                          <option key={s} value={s}>
                            {s.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              {page === "orders" && (
                <section className="panel">
                  {orderTable(filteredOrders)}
                </section>
              )}
              {page === "products" && (
                <>
                  <div className="result-count">
                    {filteredProducts.length} products{" "}
                    <span>Retail and dealer pricing in INR</span>
                  </div>
                  <div className="product-grid">
                    {filteredProducts.map((p) => (
                      <article className="product-card" key={p.id}>
                        <div className="product-image">
                          <img src={p.image} alt={p.name} loading="lazy" />
                          <span className="category-chip">{p.category}</span>
                        </div>
                        <div className="product-body">
                          <small>{p.id}</small>
                          <h3>{p.name}</h3>
                          <div className="product-prices">
                            <strong>{retail(p.price)}</strong>
                            <span>
                              Dealer {retail(p.wholesalePrice || p.price)}
                            </span>
                          </div>
                          <div className="product-footer">
                            <span
                              className={p.stock < 10 ? "stock low" : "stock"}
                            >
                              <i />
                              {p.active ? `${p.stock} in stock` : "Inactive"}
                            </span>
                            <button
                              className="text-link"
                              onClick={() =>
                                setModal({ type: "product", data: p })
                              }
                            >
                              Edit <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!filteredProducts.length && <Empty />}
                </>
              )}
              {["dealers", "customers"].includes(page) && (
                <section className="panel">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{page === "dealers" ? "Partner" : "Customer"}</th>
                          <th>Contact</th>
                          <th>Joined</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.users
                          .filter(
                            (u) =>
                              u.role ===
                                (page === "dealers" ? "dealer" : "customer") &&
                              matches(u, search),
                          )
                          .map((u) => (
                            <tr key={u.id}>
                              <td>
                                <div className="person">
                                  <span className="avatar">{u.name[0]}</span>
                                  <div>
                                    <strong>{u.businessName || u.name}</strong>
                                    <small>{u.name}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {u.email}
                                <small>{u.phone || "No phone added"}</small>
                              </td>
                              <td>{date(u.createdAt)}</td>
                              <td>
                                <Badge
                                  value={
                                    u.role === "dealer"
                                      ? u.dealerStatus
                                      : "active"
                                  }
                                />
                              </td>
                              <td>
                                {u.role === "dealer" ? (
                                  <div className="row-actions">
                                    {u.dealerStatus !== "approved" && (
                                      <button
                                        className="secondary"
                                        disabled={busy}
                                        onClick={() =>
                                          setModal({
                                            type: "dealer",
                                            data: { ...u, next: "approved" },
                                          })
                                        }
                                      >
                                        Approve
                                      </button>
                                    )}
                                    {u.dealerStatus !== "rejected" && (
                                      <button
                                        className="text-link danger"
                                        onClick={() =>
                                          setModal({
                                            type: "dealer",
                                            data: { ...u, next: "rejected" },
                                          })
                                        }
                                      >
                                        Reject
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    className="text-link"
                                    onClick={() => {
                                      setPage("orders");
                                      setTimeout(() => setSearch(u.email), 0);
                                    }}
                                  >
                                    View orders
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {page === "services" && (
                <div className="service-grid">
                  {filteredServices.length ? (
                    filteredServices.map((s) => (
                      <article key={s.id} className="panel service-card">
                        <div className="panel-head">
                          <span className="service-icon">
                            <Wrench size={20} />
                          </span>
                          <Badge value={s.status} />
                        </div>
                        <h3>{s.type}</h3>
                        <p>{s.productName}</p>
                        <div className="service-description">
                          {s.description}
                        </div>
                        <small>
                          {s.customerName} · {s.address.city}
                        </small>
                        <div className="service-bottom">
                          <span>
                            <Clock size={14} />
                            {s.preferredDate}
                          </span>
                          <button
                            className="text-link"
                            onClick={() =>
                              setModal({ type: "service", data: s })
                            }
                          >
                            Manage <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <Empty title="Service desk is clear" />
                  )}
                </div>
              )}
              {page === "automation" && (
                <>
                  <div className="studio-hero">
                    <div>
                      <span className="pill">
                        <Sparkles size={14} /> DAILY PRODUCT STORIES
                      </span>
                      <h2>
                        Give your catalogue
                        <br />a voice of its own.
                      </h2>
                      <p>
                        One product, one fresh image, one thoughtful caption.
                        <br />
                        Scheduled publishing through the official Instagram API.
                      </p>
                      <div className="row-actions">
                        <Badge
                          value={
                            data.integrations.publishEnabled
                              ? "active"
                              : "dry_run"
                          }
                        />
                        <span>
                          {data.integrations.publishEnabled
                            ? "Scheduled publishing enabled"
                            : "Publishing is disabled until configured"}
                        </span>
                      </div>
                    </div>
                    <div className="studio-sample">
                      <img
                        src={data.products[0]?.image}
                        alt="Sample water care product"
                      />
                      <span>CURATED BY CALIFNCO</span>
                      <strong>
                        Fresh water.
                        <br />
                        Fresh perspective.
                      </strong>
                    </div>
                  </div>
                  <div className="process-strip">
                    {[
                      "Select product",
                      "Generate with AI",
                      "Prepare image",
                      "Publish & record",
                    ].map((s, i) => (
                      <div key={s}>
                        <span>{i + 1}</span>
                        {s}
                        {i < 3 && <ChevronRight size={17} />}
                      </div>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2>Publishing journal</h2>
                        <p>
                          Drafts, published posts, and errors are recorded here.
                        </p>
                      </div>
                    </div>
                    {data.posts.length ? (
                      <div className="posts-grid">
                        {data.posts.map((p) => (
                          <article key={p.id} className="post-card">
                            {p.imageUrl && (
                              <img src={p.imageUrl} alt={p.product.name} />
                            )}
                            <div>
                              <Badge value={p.status} />
                              <h3>{p.product.name}</h3>
                              <p className="caption">
                                {p.caption || "Caption pending"}
                              </p>
                              {p.fixture && (
                                <p className="setup-note">
                                  {p.exampleImage
                                    ? "Previously AI-generated image example; prepared sample caption. This demonstration does not call AI providers or publish to Instagram."
                                    : "Local fixture: this image and caption were not generated by AI."}
                                </p>
                              )}
                              {p.error && <p className="error">{p.error}</p>}
                              <small>
                                {date(p.createdAt)}{" "}
                                {p.mediaId && `· Media ${p.mediaId}`}
                              </small>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title="Your first story starts here"
                        text="Run a dry run to verify the pipeline without publishing."
                      />
                    )}
                  </section>
                </>
              )}
              {page === "settings" && (
                <>
                  <div className="settings-grid">
                    {Object.entries(data.integrations).map(([key, value]) => (
                      <div className="panel integration" key={key}>
                        <span
                          className={
                            "integration-dot " + (value ? "ready" : "")
                          }
                        />
                        <div>
                          <h3>
                            {(
                              {
                                captionAI: "Gemini captions",
                                imageAI: "AI image provider",
                                cloudinary: "Cloudinary images",
                                publishEnabled: "Instagram publishing",
                                scheduler: "Scheduler credential",
                              } as any
                            )[key] || key}
                          </h3>
                          <p>
                            {value
                              ? "Configured — verify with a live test"
                              : "Setup required in server environment"}
                          </p>
                        </div>
                        <Badge value={value ? "configured" : "pending"} />
                      </div>
                    ))}
                  </div>
                  <div className="panel setup-panel">
                    <h2>Deployment checklist</h2>
                    <p>
                      Use the repository root in Vercel. The build configuration
                      publishes the admin frontend and trusted API together.
                    </p>
                    <ol>
                      <li>Connect Firebase Auth and deploy Firestore rules.</li>
                      <li>
                        Set server and public Firebase environment variables.
                      </li>
                      <li>
                        Bootstrap your administrator UID with the included
                        script.
                      </li>
                      <li>
                        Add Razorpay test credentials and the signed webhook.
                      </li>
                      <li>
                        Import the n8n workflow and connect AI, image hosting,
                        and Instagram.
                      </li>
                    </ol>
                    <p className="muted">
                      Detailed instructions: docs/SETUP.md · docs/ANDROID.md ·
                      automation/README.md
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <footer className="main-footer">
          <span>
            califnco <b>·</b> Water care, thoughtfully connected.
          </span>
          <span>Operations workspace</span>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.type === "product"
              ? modal.data
                ? "Edit product"
                : "Add product"
              : modal.type === "order"
                ? "Order details"
                : modal.type === "dealer"
                  ? "Review dealer application"
                  : modal.type === "service"
                    ? "Manage service request"
                    : "Notification activity"
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "product" && (
            <ProductEditor
              product={modal.data}
              onSave={async (value) => {
                if (await mutate("/admin/products/" + value.id, "PUT", value))
                  setModal(null);
              }}
            />
          )}
          {modal.type === "order" && (
            <OrderDetails
              order={
                data?.orders.find((o) => o.id === modal.data.id) || modal.data
              }
              busy={busy}
              onUpdate={async (status) => {
                await mutate(
                  "/admin/orders/" + modal.data.id,
                  "PATCH",
                  { status },
                  "Order updated",
                );
              }}
            />
          )}
          {modal.type === "dealer" && (
            <>
              <p>
                Set <b>{modal.data.businessName || modal.data.name}</b> to{" "}
                <b>{modal.data.next}</b>?
              </p>
              <p className="muted">
                Only approved dealers can view wholesale prices and place bulk
                orders.
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (
                    await mutate("/admin/dealers/" + modal.data.id, "PATCH", {
                      status: modal.data.next,
                    })
                  )
                    setModal(null);
                }}
              >
                Confirm{" "}
                {modal.data.next === "approved" ? "approval" : "rejection"}
              </button>
            </>
          )}
          {modal.type === "service" && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                if (
                  await mutate("/admin/services/" + modal.data.id, "PATCH", {
                    status: fd.get("status"),
                    notes: fd.get("notes"),
                  })
                )
                  setModal(null);
              }}
            >
              <p>
                {modal.data.customerName} · {modal.data.address.phone}
              </p>
              <p>
                {modal.data.address.line1}, {modal.data.address.city}
              </p>
              <Field label="Status">
                <select name="status" defaultValue={modal.data.status}>
                  {[
                    "open",
                    "scheduled",
                    "in_progress",
                    "resolved",
                    "cancelled",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Service notes">
                <textarea
                  name="notes"
                  defaultValue={modal.data.notes}
                  maxLength={1000}
                />
              </Field>
              <button className="primary" disabled={busy}>
                Save service request
              </button>
            </form>
          )}
          {modal.type === "notifications" &&
            (data?.notifications.length ? (
              <div>
                {data.notifications.map((n) => (
                  <div className="notification" key={n.id}>
                    <div>
                      <strong>{n.title}</strong>
                      <small>
                        {n.channel} · {date(n.createdAt)}
                      </small>
                      {n.error && <p>{n.error}</p>}
                    </div>
                    <Badge value={n.status} />
                  </div>
                ))}
              </div>
            ) : (
              <Empty title="No notification activity" />
            ))}
          <FormError error={error} />
        </Modal>
      )}
    </div>
  );
}
function OrderDetails({
  order: o,
  busy,
  onUpdate,
}: {
  order: Order;
  busy: boolean;
  onUpdate: (status: string) => void;
}) {
  const next: Record<string, string> = {
    confirmed: "processing",
    processing: "shipped",
    shipped: "delivered",
  };
  return (
    <>
      <div className="detail-heading">
        <div>
          <h3>{o.id}</h3>
          <p>
            {o.customerName} · {o.email}
          </p>
        </div>
        <Badge value={o.status} />
      </div>
      {o.items.map((i) => (
        <div className="order-line" key={i.productId}>
          <img src={i.image} alt="" />
          <div>
            {i.name}
            <small>
              {i.quantity} × {money(i.unitPrice)}
            </small>
          </div>
          <strong>{money(i.unitPrice * i.quantity)}</strong>
        </div>
      ))}
      <div className="total-row">
        <strong>Total</strong>
        <strong>{money(o.amount)}</strong>
      </div>
      <p>
        Payment: <Badge value={o.paymentStatus} />
      </p>
      <div className="address-box">
        <strong>Delivery address</strong>
        <p>
          {o.address.name}
          <br />
          {o.address.line1}
          <br />
          {o.address.city}, {o.address.state} {o.address.pincode}
          <br />
          {o.address.phone}
        </p>
      </div>
      <div className="timeline">
        {o.history.map((h, i) => (
          <div key={i}>
            <i />
            <strong>{h.status.replaceAll("_", " ")}</strong>
            <small>{new Date(h.at).toLocaleString("en-IN")}</small>
          </div>
        ))}
      </div>
      {next[o.status] && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => onUpdate(next[o.status])}
        >
          Mark as {next[o.status]}
          <ArrowRight size={16} />
        </button>
      )}
      {o.status === "paid_needs_review" && (
        <p className="error">
          Payment arrived after stock was released. Reconcile or refund in
          Razorpay before fulfillment.
        </p>
      )}
    </>
  );
}
function ProductEditor({
  product,
  onSave,
}: {
  product?: Product;
  onSave: (p: Product) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const fd = new FormData(e.currentTarget);
        try {
          const specs = JSON.parse(String(fd.get("specs")));
          await onSave({
            ...product,
            id: String(fd.get("id")),
            name: String(fd.get("name")),
            category: String(fd.get("category")),
            description: String(fd.get("description")),
            image: String(fd.get("image")),
            price: Number(fd.get("price")),
            wholesalePrice: Number(fd.get("wholesalePrice")),
            stock: Number(fd.get("stock")),
            minDealerQty: Number(fd.get("minDealerQty")),
            featured: fd.get("featured") === "on",
            active: fd.get("active") === "on",
            specs,
          });
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label="SKU">
          <input
            name="id"
            defaultValue={product?.id}
            readOnly={!!product}
            required
            pattern="[\w-]+"
          />
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={product?.category}>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Product name">
        <input
          name="name"
          defaultValue={product?.name}
          required
          minLength={3}
        />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          defaultValue={product?.description}
          required
        />
      </Field>
      <Field label="Image URL or /products/ asset">
        <input name="image" defaultValue={product?.image} required />
      </Field>
      <div className="form-grid">
        {[
          ["price", "Retail price (INR)", product?.price],
          ["wholesalePrice", "Wholesale price (INR)", product?.wholesalePrice],
          ["stock", "Stock", product?.stock ?? 0],
          ["minDealerQty", "Dealer minimum", product?.minDealerQty ?? 1],
        ].map(([name, label, value]) => (
          <Field key={String(name)} label={String(label)}>
            <input
              type="number"
              name={String(name)}
              defaultValue={value}
              min={name === "stock" ? 0 : 1}
              required
              step={1}
            />
          </Field>
        ))}
      </div>
      <Field label="Specifications (JSON)">
        <textarea
          name="specs"
          defaultValue={JSON.stringify(product?.specs || {}, null, 2)}
          rows={4}
        />
      </Field>
      <div className="row-actions">
        <label>
          <input
            type="checkbox"
            name="active"
            defaultChecked={product?.active ?? true}
          />{" "}
          Active
        </label>
        <label>
          <input
            type="checkbox"
            name="featured"
            defaultChecked={product?.featured}
          />{" "}
          Featured
        </label>
      </div>
      <FormError error={error} />
      <button className="primary full" disabled={busy}>
        {busy ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
