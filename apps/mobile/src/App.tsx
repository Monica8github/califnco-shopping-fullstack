import { useEffect, useState } from "react";
import {
  Text,
  View,
  ScrollView,
  FlatList,
  Image,
  Pressable,
  Modal,
  Alert,
  BackHandler,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, request, imageUrl, setDemoToken } from "./services/client";
import { enablePush, disablePush } from "./services/notifications";
import {
  s,
  C,
  Button,
  Input,
  Badge,
  Card,
  Empty,
  Loading,
} from "./components/ui";
import AddressForm, { blankAddress } from "./components/AddressForm";
import Login from "./screens/Login";
import {
  categories,
  retail,
  money,
  type Product,
  type Profile,
  type Order,
  type ServiceRequest,
  type Address,
} from "../../../shared/types";
export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.page}>
        <StatusBar style="dark" />
        <Experience />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function Experience() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [complete, setComplete] = useState(false),
    [boot, setBoot] = useState(true),
    [demo, setDemo] = useState(false),
    [page, setPage] = useState("shop"),
    [products, setProducts] = useState<Product[]>([]),
    [orders, setOrders] = useState<Order[]>([]),
    [services, setServices] = useState<ServiceRequest[]>([]),
    [cart, setCart] = useState<Record<string, number>>({}),
    [cartLoaded, setCartLoaded] = useState(false),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("All"),
    [sort, setSort] = useState("featured"),
    [modal, setModal] = useState<string | null>(null),
    [selected, setSelected] = useState<Product | null>(null),
    [address, setAddress] = useState<Address>(blankAddress),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [serviceType, setServiceType] = useState("Installation"),
    [serviceProduct, setServiceProduct] = useState(""),
    [serviceDesc, setServiceDesc] = useState(""),
    [serviceDate, setServiceDate] = useState(""),
    [profileName, setProfileName] = useState(""),
    [profilePhone, setProfilePhone] = useState("");
  const dealer =
    profile?.role === "dealer" && profile.dealerStatus === "approved";
  const price = (p: Product) =>
    dealer ? p.wholesalePrice || p.price : p.price;
  async function refresh() {
    const [p, o, sr, me] = await Promise.all([
      request("/products"),
      request("/orders"),
      request("/services"),
      request("/me"),
    ]);
    setProducts(p.products);
    setOrders(o.orders);
    setServices(sr.services);
    setProfile(me.profile);
  }
  async function login() {
    try {
      const r = await request("/me");
      setProfile(r.profile);
      setComplete(false);
      setProfileName(r.profile.name);
      setProfilePhone(r.profile.phone);
      setAddress(
        r.profile.address || {
          ...blankAddress,
          name: r.profile.name,
          phone: r.profile.phone,
        },
      );
      setError("");
    } catch (e) {
      if ((e as Error).message.includes("Complete your account")) {
        setComplete(true);
        return;
      }
      throw e;
    }
  }
  useEffect(() => {
    request("/health")
      .then((r) => setDemo(r.mode === "local-demo"))
      .catch(() => {});
    if (!auth) {
      setBoot(false);
      return;
    }
    return onAuthStateChanged(auth, async (u) => {
      try {
        if (u) await login();
        else setProfile(null);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBoot(false);
      }
    });
  }, []);
  useEffect(() => {
    if (!profile) return;
    setCartLoaded(false);
    AsyncStorage.getItem("califnco-cart-" + profile.id).then((raw) => {
      try {
        setCart(raw ? JSON.parse(raw) : {});
      } catch {
        setCart({});
      }
      setCartLoaded(true);
    });
    refresh().catch((e) => setError(e.message));
  }, [profile?.id]);
  useEffect(() => {
    if (profile && cartLoaded)
      void AsyncStorage.setItem(
        "califnco-cart-" + profile.id,
        JSON.stringify(cart),
      );
  }, [cart, cartLoaded, profile?.id]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (modal) {
        setModal(null);
        return true;
      }
      if (selected) {
        setSelected(null);
        return true;
      }
      if (page !== "shop") {
        setPage("shop");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [page, selected, modal]);
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function add(p: Product, delta?: number) {
    setCart((c) => ({
      ...c,
      [p.id]: Math.max(
        0,
        Math.min(
          p.stock,
          (c[p.id] || 0) + (delta ?? (dealer ? p.minDealerQty : 1)),
        ),
      ),
    }));
  }
  async function checkout() {
    if (!profile) return;
    await task(async () => {
      const result = await request("/checkout", "POST", {
        items: items.map((p) => ({ productId: p.id, quantity: cart[p.id] })),
        address,
        idempotencyKey: Date.now() + "-" + Math.random().toString(36).slice(2),
      });
      if (result.demo) {
        await request("/demo/pay", "POST", { orderId: result.order.id });
        Alert.alert(
          "Demo order created",
          "No money was charged. This is a local simulated checkout.",
        );
      } else {
        try {
          const Razorpay = (await import("react-native-razorpay")).default;
          const payment = await Razorpay.open({
            key: result.keyId,
            amount: result.order.amount,
            currency: "INR",
            name: "Califnco Water Care",
            order_id: result.order.razorpayOrderId,
            prefill: {
              name: profile.name,
              email: profile.email,
              contact: address.phone,
            },
            theme: { color: C.green },
          });
          await request("/payments/verify", "POST", {
            orderId: result.order.id,
            razorpay_payment_id: payment.razorpay_payment_id,
            razorpay_signature: payment.razorpay_signature,
          });
        } catch (e) {
          await refresh();
          throw new Error(
            "Checkout did not complete or verification is pending. Check order history before retrying. " +
              ((e as Error).message || ""),
          );
        }
      }
      setCart({});
      setModal(null);
      setPage("orders");
      await refresh();
    });
  }
  const items = products.filter((p) => (cart[p.id] || 0) > 0),
    total = items.reduce((sum, p) => sum + price(p) * cart[p.id], 0),
    quantity = Object.values(cart).reduce((s, n) => s + n, 0);
  const filtered = products
    .filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (p.name + " " + p.description)
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? price(a) - price(b)
        : sort === "high"
          ? price(b) - price(a)
          : Number(b.featured) - Number(a.featured),
    );
  const errorBox = error ? (
    <View style={s.error}>
      <Text accessibilityRole="alert" style={s.errorText}>
        {error}
      </Text>
      <Pressable onPress={() => setError("")}>
        <Text style={[s.small, { marginTop: 5 }]}>Dismiss</Text>
      </Pressable>
    </View>
  ) : null;
  if (boot) return <Loading />;
  if (!profile)
    return (
      <Login
        key={String(complete)}
        complete={complete}
        demo={demo}
        onLogin={login}
      />
    );
  if (profile.role === "admin")
    return (
      <View style={s.body}>
        <Text style={s.h2}>Administrator account</Text>
        <Text style={s.p}>
          Use the Vercel web dashboard to manage operations. Sign in here with a
          customer or dealer account to shop.
        </Text>
        <Button
          title="Sign out"
          onPress={() => {
            setDemoToken("");
            if (auth) void signOut(auth);
            setProfile(null);
          }}
        />
      </View>
    );
  return (
    <View style={s.page}>
      <View style={[s.header, s.row]}>
        <View>
          <Text style={s.brand}>califnco</Text>
          <Text
            style={[
              s.eyebrow,
              { fontSize: 7, marginBottom: 0, letterSpacing: 3 },
            ]}
          >
            WATER CARE
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open cart"
          onPress={() => setPage("cart")}
        >
          <Badge value={`Bag · ${quantity}`} />
        </Pressable>
      </View>
      {demo && (
        <Text
          style={{
            fontSize: 10,
            color: "#968653",
            backgroundColor: "#fbf4df",
            padding: 8,
            textAlign: "center",
          }}
        >
          LOCAL DEMO · Payments and messages are simulated
        </Text>
      )}
      {profile.role === "dealer" && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 10,
            backgroundColor: C.soft,
          }}
        >
          <Text style={s.small}>
            Dealer account: {profile.dealerStatus}
            {dealer
              ? " · Wholesale pricing active"
              : " · Approval required to place orders"}
          </Text>
        </View>
      )}
      {page === "shop" ? (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          contentContainerStyle={s.body}
          columnWrapperStyle={{ gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              tintColor={C.green}
              onRefresh={() => void task(refresh)}
            />
          }
          ListHeaderComponent={
            <>
              {errorBox}
              <View style={s.hero}>
                <Text style={s.eyebrow}>THOUGHTFUL WATER CARE</Text>
                <Text style={s.h1}>Good water.{"\n"}A better everyday.</Text>
                <Text style={[s.p, { marginTop: 12 }]}>
                  Discover essentials for your home and business.
                </Text>
              </View>
              <Input
                label="Search the catalogue"
                placeholder="Purifiers, filters, pumps…"
                value={query}
                onChangeText={setQuery}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginVertical: 18 }}
              >
                {["All", ...categories].map((c) => (
                  <Pressable
                    key={c}
                    style={[s.tab, category === c && s.tabActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text
                      style={[s.tabText, category === c && s.tabTextActive]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={[s.row, { marginBottom: 18 }]}>
                <Text style={s.small}>{filtered.length} products</Text>
                <Pressable
                  onPress={() =>
                    setSort(
                      sort === "featured"
                        ? "low"
                        : sort === "low"
                          ? "high"
                          : "featured",
                    )
                  }
                >
                  <Text style={[s.small, { color: C.green }]}>
                    {sort === "featured"
                      ? "Featured first"
                      : sort === "low"
                        ? "Price: low to high"
                        : "Price: high to low"}{" "}
                    ↕
                  </Text>
                </Pressable>
              </View>
            </>
          }
          ListEmptyComponent={<Empty text="No products match your search." />}
          renderItem={({ item: p }) => (
            <View
              style={{
                flex: 1,
                maxWidth: "49%",
                borderWidth: 1,
                borderColor: C.line,
                borderRadius: 14,
                backgroundColor: "white",
                marginBottom: 14,
                overflow: "hidden",
              }}
            >
              <Pressable
                onPress={() => setSelected(p)}
                accessibilityLabel={"View " + p.name}
              >
                <View style={{ backgroundColor: "#f0f4e9", padding: 14 }}>
                  <Image
                    source={{ uri: imageUrl(p.image) }}
                    style={{
                      height: 135,
                      width: "100%",
                      resizeMode: "contain",
                    }}
                  />
                </View>
                <View style={{ padding: 12 }}>
                  <Text
                    style={{ fontSize: 9, color: C.muted, marginBottom: 5 }}
                  >
                    {p.category}
                  </Text>
                  <Text
                    style={[s.h3, { fontSize: 12, minHeight: 40 }]}
                    numberOfLines={2}
                  >
                    {p.name}
                  </Text>
                  <Text style={[s.price, { fontSize: 17, marginTop: 10 }]}>
                    {retail(price(p))}
                  </Text>
                  <Text style={[s.small, { fontSize: 9, marginTop: 4 }]}>
                    {dealer ? "Wholesale · " : ""}
                    {p.stock} in stock
                  </Text>
                </View>
              </Pressable>
              <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                <Button
                  title={p.stock ? "Add to bag" : "Sold out"}
                  disabled={!p.stock}
                  secondary
                  onPress={() => add(p)}
                />
              </View>
            </View>
          )}
        />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => void task(refresh)}
            />
          }
        >
          {errorBox}
          {page === "cart" && (
            <>
              <Text style={s.h1}>Your shopping bag</Text>
              <Text style={[s.p, { marginTop: 8, marginBottom: 20 }]}>
                A little closer to better water.
              </Text>
              {items.length ? (
                items.map((p) => (
                  <Card key={p.id}>
                    <View style={s.row}>
                      <Image
                        source={{ uri: imageUrl(p.image) }}
                        style={s.thumb}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={s.h3}>{p.name}</Text>
                        <Text style={s.small}>{retail(price(p))} each</Text>
                        <View style={s.qty}>
                          <Pressable
                            accessibilityLabel={"Decrease " + p.name}
                            style={s.qtyButton}
                            onPress={() => add(p, -1)}
                          >
                            <Text>−</Text>
                          </Pressable>
                          <Text>{cart[p.id]}</Text>
                          <Pressable
                            accessibilityLabel={"Increase " + p.name}
                            style={s.qtyButton}
                            onPress={() => add(p, 1)}
                          >
                            <Text>+</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    {dealer && (
                      <Text style={[s.small, { marginTop: 10 }]}>
                        Dealer minimum: {p.minDealerQty} units
                      </Text>
                    )}
                  </Card>
                ))
              ) : (
                <Empty text="Your bag is empty. Explore the catalogue to add your essentials." />
              )}
              <View style={[s.row, { marginVertical: 15 }]}>
                <Text style={s.h3}>Total</Text>
                <Text style={s.price}>{retail(total)}</Text>
              </View>
              <Button
                title="Continue to checkout"
                disabled={
                  !items.length || (profile.role === "dealer" && !dealer)
                }
                onPress={() => setModal("checkout")}
              />
            </>
          )}
          {page === "orders" && (
            <>
              <Text style={[s.h1, { marginBottom: 20 }]}>Your orders</Text>
              {orders.length ? (
                orders.map((o) => (
                  <Card key={o.id}>
                    <View style={s.row}>
                      <Text style={[s.small, { flex: 1 }]}>{o.id}</Text>
                      <Badge value={o.status} />
                    </View>
                    <Text style={[s.price, { marginVertical: 12 }]}>
                      {money(o.amount)}
                    </Text>
                    {o.items.map((i) => (
                      <View
                        style={[s.row, { marginVertical: 8 }]}
                        key={i.productId}
                      >
                        <Image
                          source={{ uri: imageUrl(i.image) }}
                          style={s.thumb}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={s.h3}>{i.name}</Text>
                          <Text style={s.small}>
                            {i.quantity} × {money(i.unitPrice)}
                          </Text>
                        </View>
                      </View>
                    ))}
                    <View style={s.line} />
                    {o.history.map((h, i) => (
                      <Text key={i} style={[s.small, { marginBottom: 7 }]}>
                        ● {h.status.replaceAll("_", " ")} ·{" "}
                        {new Date(h.at).toLocaleString()}
                      </Text>
                    ))}
                    {o.status === "awaiting_payment" && (
                      <Button
                        title="Cancel unpaid order"
                        secondary
                        onPress={() =>
                          void task(async () => {
                            await request(
                              "/orders/" + o.id + "/cancel",
                              "POST",
                              {},
                            );
                            await refresh();
                          })
                        }
                      />
                    )}
                  </Card>
                ))
              ) : (
                <Empty text="No orders yet. Your next water care upgrade starts in the shop." />
              )}
            </>
          )}
          {page === "services" && (
            <>
              <Text style={s.h1}>Care that continues.</Text>
              <Text style={[s.p, { marginVertical: 10 }]}>
                Installation, maintenance, and a helping hand when you need it.
              </Text>
              <Button
                title="Book a service"
                onPress={() => setModal("service")}
              />
              <View style={s.sectionGap} />
              {services.length ? (
                services.map((v) => (
                  <Card key={v.id}>
                    <Badge value={v.status} />
                    <Text style={[s.h3, { marginTop: 12 }]}>{v.type}</Text>
                    <Text style={s.p}>{v.productName}</Text>
                    <Text style={[s.p, { marginVertical: 10 }]}>
                      {v.description}
                    </Text>
                    <Text style={s.small}>
                      Preferred date: {v.preferredDate}
                    </Text>
                    {v.notes && (
                      <Text style={s.p}>Service note: {v.notes}</Text>
                    )}
                  </Card>
                ))
              ) : (
                <Empty text="No service bookings yet." />
              )}
            </>
          )}
          {page === "profile" && (
            <>
              <Text style={s.h1}>Your account</Text>
              <Text style={[s.p, { marginTop: 10 }]}>{profile.email}</Text>
              <Input
                label="Full name"
                value={profileName}
                onChangeText={setProfileName}
              />
              <Input
                label="Phone"
                keyboardType="phone-pad"
                value={profilePhone}
                onChangeText={setProfilePhone}
              />
              <Text style={[s.h2, { marginTop: 25 }]}>Delivery address</Text>
              <AddressForm
                value={address}
                onChange={setAddress}
                onError={setError}
              />
              <Button
                title="Save profile"
                disabled={busy}
                onPress={() =>
                  void task(async () => {
                    await request("/me", "PATCH", {
                      name: profileName,
                      phone: profilePhone,
                      address,
                    });
                    await login();
                    Alert.alert("Saved", "Your profile is updated.");
                  })
                }
              />
              <Button
                title="Enable order notifications"
                secondary
                onPress={() =>
                  void task(async () => {
                    await enablePush();
                    Alert.alert(
                      "Notifications enabled",
                      "This device is registered for FCM order updates.",
                    );
                  })
                }
              />
              <Button
                title="Refresh dealer status"
                secondary
                onPress={() => void task(refresh)}
              />
              <Button
                title="Sign out"
                secondary
                onPress={() =>
                  void task(async () => {
                    try {
                      await disablePush();
                    } catch {}
                    setDemoToken("");
                    if (auth) await signOut(auth);
                    setProfile(null);
                    setCart({});
                    setCartLoaded(false);
                    setPage("shop");
                  })
                }
              />
            </>
          )}
        </ScrollView>
      )}
      <View style={s.nav}>
        {[
          ["shop", "Shop"],
          ["cart", `Bag (${quantity})`],
          ["orders", "Orders"],
          ["services", "Service"],
          ["profile", "Account"],
        ].map(([p, label]) => (
          <Pressable
            key={p}
            accessibilityRole="tab"
            accessibilityState={{ selected: page === p }}
            style={s.navItem}
            onPress={() => {
              setPage(p);
              setError("");
            }}
          >
            <Text style={[s.navText, page === p && s.navActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={s.page}>
          <ScrollView contentContainerStyle={s.body}>
            {selected && (
              <>
                <Button
                  title="Back to shop"
                  secondary
                  onPress={() => setSelected(null)}
                />
                <ScrollView
                  maximumZoomScale={3}
                  minimumZoomScale={1}
                  contentContainerStyle={{ alignItems: "center" }}
                >
                  <Image
                    source={{ uri: imageUrl(selected.image) }}
                    style={{ width: 320, height: 300, resizeMode: "contain" }}
                  />
                </ScrollView>
                <Badge value={selected.category} />
                <Text style={[s.h1, { fontSize: 26, marginTop: 14 }]}>
                  {selected.name}
                </Text>
                <Text style={[s.price, { marginVertical: 16 }]}>
                  {retail(price(selected))}
                </Text>
                <Text style={s.p}>{selected.description}</Text>
                <View style={s.line} />
                {Object.entries(selected.specs).map(([k, v]) => (
                  <View key={k} style={[s.row, { marginBottom: 13 }]}>
                    <Text style={[s.small, { flex: 1 }]}>{k}</Text>
                    <Text
                      style={[
                        s.small,
                        { flex: 1, textAlign: "right", color: C.ink },
                      ]}
                    >
                      {v}
                    </Text>
                  </View>
                ))}
                {dealer && (
                  <Text style={s.p}>
                    Minimum wholesale quantity: {selected.minDealerQty}
                  </Text>
                )}
                <Button
                  title="Add to bag"
                  disabled={!selected.stock}
                  onPress={() => {
                    add(selected);
                    setSelected(null);
                    setPage("cart");
                  }}
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Modal
        visible={!!modal}
        animationType="slide"
        onRequestClose={() => setModal(null)}
      >
        <SafeAreaView style={s.page}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              contentContainerStyle={s.body}
              keyboardShouldPersistTaps="handled"
            >
              <Button title="Back" secondary onPress={() => setModal(null)} />
              <Text style={[s.h1, { marginTop: 20 }]}>
                {modal === "checkout"
                  ? "Delivery & checkout"
                  : "Book a service"}
              </Text>
              {errorBox}
              {modal === "service" && (
                <>
                  <ScrollView horizontal style={{ marginTop: 20 }}>
                    {[
                      "Installation",
                      "Filter replacement",
                      "Repair",
                      "Annual maintenance",
                    ].map((t) => (
                      <Pressable
                        key={t}
                        style={[s.tab, t === serviceType && s.tabActive]}
                        onPress={() => setServiceType(t)}
                      >
                        <Text
                          style={[
                            s.tabText,
                            t === serviceType && s.tabTextActive,
                          ]}
                        >
                          {t}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Input
                    label="Product name"
                    value={serviceProduct}
                    onChangeText={setServiceProduct}
                  />
                  <Input
                    label="Describe what you need"
                    multiline
                    value={serviceDesc}
                    onChangeText={setServiceDesc}
                  />
                  <Input
                    label="Preferred date (YYYY-MM-DD)"
                    placeholder="2026-10-26"
                    value={serviceDate}
                    onChangeText={setServiceDate}
                  />
                </>
              )}
              <AddressForm
                value={address}
                onChange={setAddress}
                onError={setError}
              />
              {modal === "checkout" ? (
                <>
                  <View style={[s.row, { marginTop: 25 }]}>
                    <Text style={s.h3}>Order total</Text>
                    <Text style={s.price}>{retail(total)}</Text>
                  </View>
                  <Text style={[s.small, { marginTop: 10 }]}>
                    Razorpay test checkout. Prices and stock are verified by the
                    server.
                  </Text>
                  <Button
                    title={
                      busy
                        ? "Preparing…"
                        : demo
                          ? "Place simulated demo order"
                          : "Pay with Razorpay (test)"
                    }
                    disabled={busy}
                    onPress={checkout}
                  />
                </>
              ) : (
                <Button
                  title={busy ? "Saving…" : "Request service"}
                  disabled={busy}
                  onPress={() =>
                    void task(async () => {
                      await request("/services", "POST", {
                        type: serviceType,
                        productName: serviceProduct,
                        description: serviceDesc,
                        preferredDate: serviceDate,
                        address,
                      });
                      setModal(null);
                      setPage("services");
                      await refresh();
                      Alert.alert(
                        "Request received",
                        "Your service slot will be confirmed by the team.",
                      );
                    })
                  }
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
