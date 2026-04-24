import { useState, useEffect, useRef } from "react";
import { api } from "./api";

// ── Palette & constants ──────────────────────────────────────────────────────
const COLORS = {
  bg: "#0D0D0D",
  surface: "#161616",
  card: "#1C1C1C",
  border: "#2A2A2A",
  accent: "#FF6B2B",
  accentSoft: "#FF6B2B22",
  gold: "#F5C518",
  text: "#F0EDE8",
  muted: "#888",
  green: "#22C55E",
  red: "#EF4444",
};

// ── Menu Data ────────────────────────────────────────────────────────────────
const CATEGORIES = ["All", "Breakfast", "Lunch", "Snacks", "Beverages", "Desserts"];

const RAZORPAY_KEY_ID = "rzp_test_SgxOIjCx6eiYGq";

// ── Tiny Components ──────────────────────────────────────────────────────────
const Badge = ({ children, color = COLORS.accent }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>
    {children}
  </span>
);

const Btn = ({ children, onClick, style = {}, variant = "primary", disabled }) => {
  const base = {
    border: "none", borderRadius: 10, padding: "10px 22px", fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 14, transition: "all .18s",
    opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
  };
  const variants = {
    primary: { background: COLORS.accent, color: "#fff" },
    ghost: { background: "transparent", color: COLORS.muted, border: `1px solid ${COLORS.border}` },
    success: { background: COLORS.green, color: "#fff" },
    danger: { background: COLORS.red, color: "#fff" },
  };
  return (
    <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
};

const StatusPill = ({ status }) => {
  const map = {
    pending: { color: COLORS.gold, label: "⏳ Pending" },
    preparing: { color: "#3B82F6", label: "🔥 Preparing" },
    ready: { color: COLORS.green, label: "✅ Ready to Pickup" },
    collected: { color: COLORS.muted, label: "✔ Collected" },
  };
  const s = map[status] || map.pending;
  return <Badge color={s.color}>{s.label}</Badge>;
};

const normalizeMobile = (value) => value.replace(/\D/g, "").slice(0, 10);

const createMenuDraft = (item = {}) => ({
  id: item.id ?? null,
  name: item.name ?? "",
  cat: item.cat ?? "Breakfast",
  price: item.price ?? "",
  time: item.time ?? "",
  emoji: item.emoji ?? "🍽️",
  desc: item.desc ?? "",
  popular: item.popular ?? false,
  veg: item.veg ?? true,
  active: item.active ?? true,
});

// ── STUDENT PORTAL ───────────────────────────────────────────────────────────
function StudentPortal({ currentUser, onLogout, timeSlots, menuItems, orders, onPlaceOrder, onUpdateOrderStatus }) {
  const [cat, setCat] = useState("All");
  const [cart, setCart] = useState({});
  const [view, setView] = useState("menu"); // menu | cart | track
  const [search, setSearch] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [toast, setToast] = useState(null);
  const [razorpayReady, setRazorpayReady] = useState(() => typeof window !== "undefined" && Boolean(window.Razorpay));
  const [isPaying, setIsPaying] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const notifiedReadyOrders = useRef(new Set());

  const filtered = menuItems.filter(i =>
    (cat === "All" || i.cat === cat) &&
    i.active &&
    (vegOnly ? i.veg : true) &&
    (search === "" || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  const totalItems = Object.values(cart).reduce((s, q) => s + q, 0);
  const totalPrice = Object.entries(cart).reduce((s, [id, q]) => {
    const item = menuItems.find(m => m.id === +id);
    return s + (item ? item.price * q : 0);
  }, 0);
  const availableSlots = timeSlots.filter((slot) => slot.active && slot.booked < slot.capacity);
  const effectiveSelectedSlotId = availableSlots.some((slot) => slot.id === selectedSlotId)
    ? selectedSlotId
    : (availableSlots[0]?.id || "");
  const selectedSlot = timeSlots.find((slot) => slot.id === effectiveSelectedSlotId);

  const addToCart = (id) => {
    setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
    showToast("Added to cart 🛒");
  };
  const removeFromCart = (id) => {
    setCart(c => {
      const n = { ...c };
      if (n[id] > 1) n[id]--;
      else delete n[id];
      return n;
    });
  };
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (window.Razorpay) {
      return undefined;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayReady(true);
    script.onerror = () => {
      setRazorpayReady(false);
      showToast("Payment gateway failed to load");
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    orders.forEach((order) => {
      if (order.status !== "ready" || notifiedReadyOrders.current.has(order.id)) return;

      notifiedReadyOrders.current.add(order.id);
      const itemNames = order.items.map((item) => item.name).join(", ");
      showToast(`Your order ${itemNames} is ready to collect`);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Order Ready to Collect", {
          body: `Your order ${itemNames} is ready to collect`,
        });
      }
    });
  }, [orders]);

  const placeOrder = async (payment = {}) => {
    const items = Object.entries(cart).map(([id, qty]) => {
      const item = menuItems.find(m => m.id === +id);
      return { name: item.name, qty, price: item.price };
    });
    const orderPayload = {
      items,
      total: totalPrice,
      student: currentUser?.name || "You",
      pickupSlot: selectedSlot?.label || "Next available slot",
      pickupSlotId: selectedSlot?.id || null,
      paymentStatus: "paid",
      paymentId: payment.razorpay_payment_id || "demo-payment",
    };

    try {
      const savedOrder = await onPlaceOrder(orderPayload);
      setCart({});
      setView("track");
      showToast("Payment successful! Order placed 🎉");

      // simulate status progression
      setTimeout(() => onUpdateOrderStatus(savedOrder.id, "preparing"), 4000);
      setTimeout(() => onUpdateOrderStatus(savedOrder.id, "ready"), 10000);
    } catch (error) {
      showToast(error.message || "Unable to place order");
    }
  };

  const handlePayment = () => {
    if (!cart || totalItems === 0) return;
    if (!selectedSlot) {
      showToast("Choose an available pickup slot");
      return;
    }
    if (!window.Razorpay || !razorpayReady) {
      showToast("Payment gateway is still loading");
      return;
    }

    setIsPaying(true);
    const orderSummary = Object.entries(cart).map(([id, qty]) => {
      const item = menuItems.find(m => m.id === +id);
      return `${item?.name || "Item"} x${qty}`;
    }).join(", ");

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: totalPrice * 100,
      currency: "INR",
      name: "CanteenX",
      description: "Canteen preorder payment",
      handler: async (response) => {
        setIsPaying(false);
        await placeOrder(response);
      },
      modal: {
        ondismiss: () => {
          setIsPaying(false);
          showToast("Payment cancelled");
        },
      },
      prefill: {
        name: currentUser?.name || "Student User",
        email: `${(currentUser?.mobile || "student")}@canteenx.demo`,
        contact: currentUser?.mobile || "9999999999",
      },
      notes: {
        items: orderSummary,
        order_type: "preorder",
        pickup_slot: selectedSlot.label,
      },
      theme: {
        color: COLORS.accent,
      },
    };

    const razorpay = new window.Razorpay(options);
    razorpay.on("payment.failed", () => {
      setIsPaying(false);
      showToast("Payment failed. Please try again.");
    });
    razorpay.open();
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Outfit', sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: COLORS.accent, color: "#fff", padding: "10px 24px", borderRadius: 40, fontWeight: 700, zIndex: 999, fontSize: 14, boxShadow: "0 8px 32px #0008" }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <header style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🍽️</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.5, color: COLORS.text }}>CanteenX</div>
            <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 1 }}>{currentUser?.name || "SKIP THE QUEUE"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <nav style={{ display: "flex", gap: 4 }}>
          {[["menu", "🍴 Menu"], ["cart", `🛒 Cart${totalItems ? ` (${totalItems})` : ""}`], ["track", "📍 Track"]].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? COLORS.accent : "transparent", color: view === v ? "#fff" : COLORS.muted, border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", transition: "all .15s" }}>
              {label}
            </button>
          ))}
          </nav>
          {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
            <Btn onClick={() => Notification.requestPermission()} variant="ghost" style={{ padding: "8px 14px" }}>Enable Alerts</Btn>
          )}
          <Btn onClick={onLogout} variant="ghost" style={{ padding: "8px 14px" }}>Sign Out</Btn>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        {/* MENU VIEW */}
        {view === "menu" && (
          <>
            {/* Hero */}
            <div style={{ background: `linear-gradient(135deg, ${COLORS.accent}22, ${COLORS.gold}11)`, border: `1px solid ${COLORS.accent}33`, borderRadius: 20, padding: "32px 36px", marginBottom: 32, position: "relative", overflow: "hidden" }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>👋</div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, letterSpacing: -1 }}>Order Ahead, Skip the Wait</h1>
              <p style={{ margin: "8px 0 0", color: COLORS.muted, fontSize: 15 }}>Browse the menu, add to cart, and pick up when it's ready.</p>
              <div style={{ position: "absolute", right: 36, top: "50%", transform: "translateY(-50%)", fontSize: 80, opacity: 0.12 }}>🍱</div>
            </div>

            {/* Search + Filter */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
              <input
                placeholder="Search dishes…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, minWidth: 200, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 16px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={() => setVegOnly(v => !v)} style={{ background: vegOnly ? "#22C55E22" : COLORS.card, border: `1px solid ${vegOnly ? COLORS.green : COLORS.border}`, borderRadius: 10, padding: "10px 18px", color: vegOnly ? COLORS.green : COLORS.muted, cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                🌿 Veg Only
              </button>
            </div>

            {/* Category Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 28, overflowX: "auto", paddingBottom: 4 }}>
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => setCat(c)} style={{ background: cat === c ? COLORS.accent : COLORS.card, color: cat === c ? "#fff" : COLORS.muted, border: `1px solid ${cat === c ? COLORS.accent : COLORS.border}`, borderRadius: 40, padding: "7px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", fontFamily: "inherit", transition: "all .15s" }}>
                  {c}
                </button>
              ))}
            </div>

            {/* Menu Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filtered.map(item => {
                const qty = cart[item.id] || 0;
                return (
                  <div key={item.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 20, position: "relative", transition: "border-color .2s", cursor: "default" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = COLORS.accent + "66"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = COLORS.border}
                  >
                    {item.popular && <div style={{ position: "absolute", top: 14, right: 14 }}><Badge color={COLORS.gold}>🔥 Popular</Badge></div>}
                    <div style={{ fontSize: 42, marginBottom: 10 }}>{item.emoji}</div>
                    <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 12, lineHeight: 1.5 }}>{item.desc}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                      <Badge color={item.veg ? COLORS.green : COLORS.red}>{item.veg ? "🟢 Veg" : "🔴 Non-Veg"}</Badge>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>⏱ {item.time} min</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 900, fontSize: 20, color: COLORS.accent }}>₹{item.price}</span>
                      {qty === 0 ? (
                        <Btn onClick={() => addToCart(item.id)}>+ Add</Btn>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.surface, borderRadius: 8, padding: "4px 10px", border: `1px solid ${COLORS.border}` }}>
                          <button onClick={() => removeFromCart(item.id)} style={{ background: "none", border: "none", color: COLORS.accent, fontSize: 18, cursor: "pointer", fontWeight: 900, lineHeight: 1 }}>−</button>
                          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 20, textAlign: "center" }}>{qty}</span>
                          <button onClick={() => addToCart(item.id)} style={{ background: "none", border: "none", color: COLORS.accent, fontSize: 18, cursor: "pointer", fontWeight: 900, lineHeight: 1 }}>+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", color: COLORS.muted, padding: 60, fontSize: 16 }}>No items found 🔍</div>
            )}
          </>
        )}

        {/* CART VIEW */}
        {view === "cart" && (
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <h2 style={{ fontWeight: 900, fontSize: 26, marginBottom: 24 }}>🛒 Your Cart</h2>
            {totalItems === 0 ? (
              <div style={{ textAlign: "center", color: COLORS.muted, padding: 60 }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🍽️</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Cart is empty</div>
                <Btn onClick={() => setView("menu")} style={{ marginTop: 20 }}>Browse Menu</Btn>
              </div>
            ) : (
              <>
                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 20 }}>
                  {Object.entries(cart).map(([id, qty]) => {
                    const item = menuItems.find(m => m.id === +id);
                    if (!item) return null;
                    return (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}` }}>
                        <span style={{ fontSize: 28 }}>{item.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: COLORS.muted }}>₹{item.price} each</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <button onClick={() => removeFromCart(+id)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, color: COLORS.text, width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontWeight: 900, fontSize: 16 }}>−</button>
                          <span style={{ fontWeight: 800, minWidth: 20, textAlign: "center" }}>{qty}</span>
                          <button onClick={() => addToCart(+id)} style={{ background: COLORS.accent, border: "none", color: "#fff", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontWeight: 900, fontSize: 16 }}>+</button>
                        </div>
                        <div style={{ fontWeight: 800, color: COLORS.accent, minWidth: 54, textAlign: "right" }}>₹{item.price * qty}</div>
                      </div>
                    );
                  })}
                  <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, color: COLORS.muted }}>Total ({totalItems} items)</span>
                    <span style={{ fontWeight: 900, fontSize: 22, color: COLORS.accent }}>₹{totalPrice}</span>
                  </div>
                </div>

                {/* Order Note */}
                <div style={{ background: COLORS.accentSoft, border: `1px solid ${COLORS.accent}44`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 13, color: COLORS.muted }}>
                  ⚡ Estimated prep time: ~{Math.max(...Object.keys(cart).map(id => menuItems.find(m => m.id === +id)?.time || 0))} min
                </div>

                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 10 }}>Pickup Time Slot</div>
                  {availableSlots.length === 0 ? (
                    <div style={{ color: "#FCA5A5", fontSize: 13 }}>No pickup slots are available right now.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {availableSlots.map((slot) => {
                        const remaining = slot.capacity - slot.booked;
                        const active = effectiveSelectedSlotId === slot.id;
                        return (
                          <button
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            style={{
                              background: active ? `${COLORS.accent}16` : COLORS.surface,
                              border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                              borderRadius: 12,
                              padding: "12px 14px",
                              color: COLORS.text,
                              fontFamily: "inherit",
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                              <span style={{ fontWeight: 800, fontSize: 14 }}>{slot.label}</span>
                              <Badge color={remaining <= 2 ? COLORS.gold : COLORS.green}>{remaining} left</Badge>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: COLORS.muted }}>
                  Secure test checkout powered by Razorpay. Your order will be placed after successful payment.
                </div>

                <Btn onClick={handlePayment} disabled={!razorpayReady || isPaying || !selectedSlot} style={{ width: "100%", padding: "14px", fontSize: 16 }}>
                  {isPaying ? "Opening Payment..." : `Pay ₹${totalPrice} & Place Order →`}
                </Btn>
              </>
            )}
          </div>
        )}

        {/* TRACK VIEW */}
        {view === "track" && (
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <h2 style={{ fontWeight: 900, fontSize: 26, marginBottom: 24 }}>📍 Track Your Orders</h2>
            {orders.length === 0 ? (
              <div style={{ textAlign: "center", color: COLORS.muted, padding: 60 }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📋</div>
                <div>No orders yet. <span style={{ color: COLORS.accent, cursor: "pointer", fontWeight: 700 }} onClick={() => setView("menu")}>Order now!</span></div>
              </div>
            ) : (
              orders.map(order => (
                <div key={order.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{order.id}</div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>Placed at {order.time}</div>
                      {order.pickupSlot && <div style={{ fontSize: 12, color: COLORS.gold, marginTop: 6 }}>Pickup Slot: {order.pickupSlot}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusPill status={order.status} />
                      <div style={{ marginTop: 6, background: COLORS.accent + "22", color: COLORS.accent, border: `1px solid ${COLORS.accent}44`, borderRadius: 8, padding: "3px 10px", fontSize: 13, fontWeight: 800 }}>
                        Token: {order.token}
                      </div>
                      {order.paymentStatus && (
                        <div style={{ marginTop: 6, fontSize: 11, color: COLORS.green, fontWeight: 700 }}>
                          Payment: {order.paymentStatus}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      {["Pending", "Preparing", "Ready to Pickup", "Collected"].map((s, i) => {
                        const statusOrder = ["pending", "preparing", "ready", "collected"];
                        const current = statusOrder.indexOf(order.status);
                        const done = i <= current;
                        return (
                          <div key={s} style={{ textAlign: "center", flex: 1 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: done ? COLORS.accent : COLORS.border, color: done ? "#fff" : COLORS.muted, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px", fontSize: 13, fontWeight: 800, transition: "background .4s" }}>
                              {done ? "✓" : i + 1}
                            </div>
                            <div style={{ fontSize: 10, color: done ? COLORS.text : COLORS.muted }}>{s}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                    {order.items.map((it, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: COLORS.muted, marginBottom: 4 }}>
                        <span>{it.name} × {it.qty}</span>
                        <span>₹{it.price * it.qty}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, marginTop: 8, color: COLORS.text }}>
                      <span>Total</span><span style={{ color: COLORS.accent }}>₹{order.total}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── CANTEEN DASHBOARD ────────────────────────────────────────────────────────
function CanteenDashboard({ currentUser, onLogout, timeSlots, menuItems, onToggleSlot, onAdjustSlotCapacity, onToggleMenuItem, onSaveMenuItem, orders, onUpdateOrderStatus }) {
  const [activeTab, setActiveTab] = useState("orders"); // orders | analytics | menu | slots
  const [notif, setNotif] = useState(null);
  const [menuDraft, setMenuDraft] = useState(createMenuDraft());
  const [menuFormMode, setMenuFormMode] = useState("add");

  const updateStatus = async (id, status) => {
    try {
      await onUpdateOrderStatus(id, status);
      setNotif(`Order ${id} marked as ${status}`);
      setTimeout(() => setNotif(null), 2500);
    } catch (error) {
      setNotif(error.message || "Unable to update order");
      setTimeout(() => setNotif(null), 2500);
    }
  };

  const startEditingMenuItem = (item) => {
    setMenuFormMode("edit");
    setMenuDraft(createMenuDraft(item));
  };

  const resetMenuDraft = () => {
    setMenuFormMode("add");
    setMenuDraft(createMenuDraft());
  };

  const updateMenuDraft = (field, value) => {
    setMenuDraft((current) => ({
      ...current,
      [field]: field === "price" || field === "time" ? value.replace(/[^\d]/g, "") : value,
    }));
  };

  const submitMenuDraft = async () => {
    if (!menuDraft.name.trim() || !menuDraft.desc.trim() || !menuDraft.emoji.trim()) {
      setNotif("Fill in the item name, emoji, and description");
      setTimeout(() => setNotif(null), 2500);
      return;
    }

    const nextItem = {
      ...menuDraft,
      name: menuDraft.name.trim(),
      emoji: menuDraft.emoji.trim(),
      desc: menuDraft.desc.trim(),
      price: Number(menuDraft.price),
      time: Number(menuDraft.time),
    };

    if (!nextItem.price || !nextItem.time) {
      setNotif("Price and prep time must be greater than 0");
      setTimeout(() => setNotif(null), 2500);
      return;
    }

    try {
      await onSaveMenuItem(nextItem);
      setNotif(menuFormMode === "edit" ? `Updated ${nextItem.name}` : `Added ${nextItem.name}`);
      setTimeout(() => setNotif(null), 2500);
      resetMenuDraft();
    } catch (error) {
      setNotif(error.message || "Unable to save menu item");
      setTimeout(() => setNotif(null), 2500);
    }
  };

  const pending = orders.filter(o => o.status === "pending").length;
  const preparing = orders.filter(o => o.status === "preparing").length;
  const ready = orders.filter(o => o.status === "ready").length;
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);

  const statCards = [
    { label: "Pending", value: pending, color: COLORS.gold, icon: "⏳" },
    { label: "Preparing", value: preparing, color: "#3B82F6", icon: "🔥" },
    { label: "Ready to Pickup", value: ready, color: COLORS.green, icon: "✅" },
    { label: "Revenue Today", value: `₹${totalRevenue}`, color: COLORS.accent, icon: "💰" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'Outfit', sans-serif" }}>
      {notif && (
        <div style={{ position: "fixed", top: 80, right: 24, background: COLORS.card, border: `1px solid ${COLORS.green}`, color: COLORS.green, padding: "12px 20px", borderRadius: 12, fontWeight: 700, zIndex: 999, fontSize: 13, boxShadow: "0 8px 32px #0008" }}>
          ✅ {notif}
        </div>
      )}

      <header style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>🍽️</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: -0.5 }}>CanteenX</div>
            <div style={{ fontSize: 10, color: COLORS.accent, letterSpacing: 1, fontWeight: 700 }}>{currentUser?.name || "CANTEEN DASHBOARD"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 13, color: COLORS.muted }}>🕐 {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
          {pending > 0 && <Badge color={COLORS.red}>🔔 {pending} New</Badge>}
          <Btn onClick={onLogout} variant="ghost" style={{ padding: "8px 14px" }}>Sign Out</Btn>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 28, background: COLORS.card, borderRadius: 12, padding: 4, width: "fit-content", border: `1px solid ${COLORS.border}` }}>
          {[["orders", "📋 Orders"], ["analytics", "📊 Analytics"], ["menu", "🍴 Menu Items"], ["slots", "🕒 Time Slots"]].map(([v, l]) => (
            <button key={v} onClick={() => setActiveTab(v)} style={{ background: activeTab === v ? COLORS.accent : "transparent", color: activeTab === v ? "#fff" : COLORS.muted, border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, fontFamily: "inherit", transition: "all .15s" }}>
              {l}
            </button>
          ))}
        </div>

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <>
            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 30 }}>
              {statCards.map(s => (
                <div key={s.label} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ fontSize: 26, marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Orders */}
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 16 }}>Live Orders</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {orders.filter(o => o.status !== "collected").map(order => (
                <div key={order.id} style={{ background: COLORS.card, border: `1px solid ${order.status === "pending" ? COLORS.gold + "66" : COLORS.border}`, borderRadius: 16, padding: 20, display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 900, fontSize: 15 }}>{order.id}</span>
                      <StatusPill status={order.status} />
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 8 }}>👤 {order.student} · {order.time}</div>
                    {order.pickupSlot && <div style={{ fontSize: 12, color: COLORS.gold, marginBottom: 8 }}>🕒 {order.pickupSlot}</div>}
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {order.items.map((it) => `${it.name} ×${it.qty}`).join(", ")}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div style={{ fontWeight: 900, fontSize: 20, color: COLORS.accent }}>₹{order.total}</div>
                    <div style={{ background: COLORS.accent + "22", color: COLORS.accent, border: `1px solid ${COLORS.accent}44`, borderRadius: 8, padding: "3px 12px", fontWeight: 800, fontSize: 14 }}>
                      {order.token}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {order.status === "pending" && <Btn onClick={() => updateStatus(order.id, "preparing")} style={{ fontSize: 12, padding: "7px 14px" }}>🔥 Start</Btn>}
                      {order.status === "preparing" && <Btn onClick={() => updateStatus(order.id, "ready")} variant="success" style={{ fontSize: 12, padding: "7px 14px" }}>✅ Mark Ready to Pickup</Btn>}
                      {order.status === "ready" && <Btn onClick={() => updateStatus(order.id, "collected")} variant="ghost" style={{ fontSize: 12, padding: "7px 14px" }}>✔ Collected</Btn>}
                    </div>
                  </div>
                </div>
              ))}
              {orders.every(o => o.status === "collected") && (
                <div style={{ textAlign: "center", color: COLORS.muted, padding: 40 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <div style={{ fontWeight: 700 }}>All orders fulfilled! Great work.</div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>Today's Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22 }}>
                <div style={{ fontWeight: 700, color: COLORS.muted, marginBottom: 12, fontSize: 13 }}>ORDERS BY STATUS</div>
                {[["Pending", pending, COLORS.gold], ["Preparing", preparing, "#3B82F6"], ["Ready to Pickup", ready, COLORS.green], ["Collected", orders.filter(o => o.status === "collected").length, COLORS.muted]].map(([label, count, color]) => (
                  <div key={label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color }}>{label}</span><span style={{ fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ background: COLORS.border, borderRadius: 4, height: 6, overflow: "hidden" }}>
                      <div style={{ width: `${orders.length ? (count / orders.length) * 100 : 0}%`, background: color, height: "100%", borderRadius: 4, transition: "width .5s" }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22 }}>
                <div style={{ fontWeight: 700, color: COLORS.muted, marginBottom: 20, fontSize: 13 }}>KEY METRICS</div>
                {[
                  ["Total Orders", orders.length],
                  ["Total Revenue", `₹${totalRevenue}`],
                  ["Avg Order Value", `₹${orders.length ? Math.round(totalRevenue / orders.length) : 0}`],
                  ["Menu Items", menuItems.length],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, fontSize: 14 }}>
                    <span style={{ color: COLORS.muted }}>{k}</span>
                    <span style={{ fontWeight: 800, color: COLORS.accent }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Items */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 22 }}>
              <div style={{ fontWeight: 700, color: COLORS.muted, marginBottom: 16, fontSize: 13 }}>TOP MENU ITEMS (MOCK)</div>
              {menuItems.filter(m => m.popular).slice(0, 5).map((item, i) => (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontWeight: 900, fontSize: 13, color: COLORS.muted, minWidth: 20 }}>#{i + 1}</span>
                  <span style={{ fontSize: 24 }}>{item.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 700 }}>{item.name}</span>
                  <Badge color={COLORS.gold}>🔥 Popular</Badge>
                  <span style={{ fontWeight: 800, color: COLORS.accent }}>₹{item.price}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MENU ITEMS TAB */}
        {activeTab === "menu" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, fontSize: 18, margin: 0 }}>Menu Management</h3>
              <Badge color={COLORS.green}>✅ {menuItems.filter((item) => item.active).length} Items Active</Badge>
            </div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{menuFormMode === "edit" ? "Edit Menu Item" : "Add Menu Item"}</div>
                {menuFormMode === "edit" && <Btn onClick={resetMenuDraft} variant="ghost" style={{ padding: "8px 14px" }}>Cancel Edit</Btn>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 0.8fr 0.8fr 0.7fr", gap: 10, marginBottom: 10 }}>
                <input value={menuDraft.name} onChange={(e) => updateMenuDraft("name", e.target.value)} placeholder="Item name" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <select value={menuDraft.cat} onChange={(e) => updateMenuDraft("cat", e.target.value)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }}>
                  {CATEGORIES.filter((category) => category !== "All").map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <input value={menuDraft.price} onChange={(e) => updateMenuDraft("price", e.target.value)} placeholder="Price" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <input value={menuDraft.time} onChange={(e) => updateMenuDraft("time", e.target.value)} placeholder="Prep min" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <input value={menuDraft.emoji} onChange={(e) => updateMenuDraft("emoji", e.target.value)} placeholder="Emoji" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 10, alignItems: "center" }}>
                <input value={menuDraft.desc} onChange={(e) => updateMenuDraft("desc", e.target.value)} placeholder="Short description" style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "inherit" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 13 }}>
                  <input type="checkbox" checked={menuDraft.veg} onChange={(e) => setMenuDraft((current) => ({ ...current, veg: e.target.checked }))} />
                  Veg
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 13 }}>
                  <input type="checkbox" checked={menuDraft.popular} onChange={(e) => setMenuDraft((current) => ({ ...current, popular: e.target.checked }))} />
                  Popular
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 13 }}>
                  <input type="checkbox" checked={menuDraft.active} onChange={(e) => setMenuDraft((current) => ({ ...current, active: e.target.checked }))} />
                  Active
                </label>
                <Btn onClick={submitMenuDraft} style={{ padding: "10px 18px" }}>{menuFormMode === "edit" ? "Save Item" : "Add Item"}</Btn>
              </div>
            </div>
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 14, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: COLORS.surface }}>
                    {["Item", "Category", "Price", "Prep Time", "Type", "Status", "Actions"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: COLORS.muted, fontWeight: 700, fontSize: 11, letterSpacing: 0.5, borderBottom: `1px solid ${COLORS.border}` }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {menuItems.map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = COLORS.surface}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "12px 16px" }}><span style={{ marginRight: 8 }}>{item.emoji}</span><strong>{item.name}</strong></td>
                      <td style={{ padding: "12px 16px", color: COLORS.muted }}>{item.cat}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 800, color: COLORS.accent }}>₹{item.price}</td>
                      <td style={{ padding: "12px 16px", color: COLORS.muted }}>{item.time} min</td>
                      <td style={{ padding: "12px 16px" }}><Badge color={item.veg ? COLORS.green : COLORS.red}>{item.veg ? "Veg" : "Non-Veg"}</Badge></td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => onToggleMenuItem(item.id)}
                          style={{
                            background: item.active ? `${COLORS.green}22` : `${COLORS.red}22`,
                            color: item.active ? COLORS.green : COLORS.red,
                            border: `1px solid ${item.active ? COLORS.green : COLORS.red}44`,
                            borderRadius: 8,
                            padding: "6px 10px",
                            fontWeight: 800,
                            fontSize: 12,
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                        >
                          {item.active ? "Active" : "Out of Stock"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Btn onClick={() => startEditingMenuItem(item)} variant="ghost" style={{ padding: "7px 12px", fontSize: 12 }}>Edit</Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "slots" && (
          <div>
            <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>Pickup Time Slots</h3>
            <div style={{ display: "grid", gap: 14 }}>
              {timeSlots.map((slot) => {
                const remaining = Math.max(slot.capacity - slot.booked, 0);
                return (
                  <div key={slot.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 18, display: "flex", justifyContent: "space-between", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontWeight: 900, fontSize: 16 }}>{slot.label}</span>
                        <Badge color={slot.active ? COLORS.green : COLORS.red}>{slot.active ? "Active" : "Closed"}</Badge>
                      </div>
                      <div style={{ fontSize: 13, color: COLORS.muted }}>Booked {slot.booked} of {slot.capacity} slots</div>
                      <div style={{ fontSize: 12, color: remaining > 0 ? COLORS.gold : COLORS.red, marginTop: 6 }}>{remaining} spots remaining</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "6px 10px" }}>
                        <button onClick={() => onAdjustSlotCapacity(slot.id, -1)} style={{ background: "none", border: "none", color: COLORS.accent, fontSize: 18, cursor: "pointer", fontWeight: 900 }}>−</button>
                        <span style={{ minWidth: 80, textAlign: "center", fontWeight: 800, fontSize: 13 }}>Capacity {slot.capacity}</span>
                        <button onClick={() => onAdjustSlotCapacity(slot.id, 1)} style={{ background: "none", border: "none", color: COLORS.accent, fontSize: 18, cursor: "pointer", fontWeight: 900 }}>+</button>
                      </div>
                      <Btn onClick={() => onToggleSlot(slot.id)} variant={slot.active ? "ghost" : "success"} style={{ padding: "9px 16px" }}>
                        {slot.active ? "Close Slot" : "Open Slot"}
                      </Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── AUTH / ROLE SELECTOR ─────────────────────────────────────────────────────
export default function App() {
  const [timeSlots, setTimeSlots] = useState([]);
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [authRole, setAuthRole] = useState("student");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", mobile: "", password: "" });
  const [authMessage, setAuthMessage] = useState("");
  const [session, setSession] = useState(null);
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadBootstrap = async () => {
      try {
        const data = await api.bootstrap();
        if (ignore) return;
        setTimeSlots(data.timeSlots || []);
        setOrders(data.orders || []);
        setMenuItems(data.menuItems || []);
      } catch (error) {
        if (!ignore) setAuthMessage(error.message || "Unable to connect to the SQLite API.");
      } finally {
        if (!ignore) setIsHydrating(false);
      }
    };

    loadBootstrap();
    return () => {
      ignore = true;
    };
  }, []);

  const toggleSlot = async (slotId) => {
    const data = await api.toggleSlot(slotId);
    setTimeSlots(data.timeSlots || []);
  };

  const adjustSlotCapacity = async (slotId, delta) => {
    const data = await api.adjustSlotCapacity(slotId, delta);
    setTimeSlots(data.timeSlots || []);
  };

  const placeOrder = async (order) => {
    const data = await api.createOrder(order);
    setOrders(data.orders || []);
    setTimeSlots(data.timeSlots || []);
    return data.order;
  };

  const updateOrderStatus = async (id, status) => {
    const data = await api.updateOrderStatus(id, status);
    setOrders(data.orders || []);
  };

  const toggleMenuItem = async (id) => {
    const data = await api.toggleMenuItem(id);
    setMenuItems(data.menuItems || []);
  };

  const saveMenuItem = async (draft) => {
    const data = await api.saveMenuItem(draft);
    setMenuItems(data.menuItems || []);
  };

  const resetAuthForm = (role = authRole, mode = authMode) => {
    const defaults = mode === "register"
      ? { name: role === "canteen" ? "Staff Member" : "", mobile: "", password: "" }
      : { name: "", mobile: "", password: "" };
    setAuthForm(defaults);
    setAuthMessage("");
  };

  const switchRole = (role) => {
    setAuthRole(role);
    resetAuthForm(role, authMode);
  };

  const switchMode = (mode) => {
    setAuthMode(mode);
    resetAuthForm(authRole, mode);
  };

  const updateAuthField = (field, value) => {
    setAuthForm((current) => ({
      ...current,
      [field]: field === "mobile" ? normalizeMobile(value) : value,
    }));
    setAuthMessage("");
  };

  const handleAuthSubmit = async () => {
    const mobile = normalizeMobile(authForm.mobile);
    const password = authForm.password.trim();
    const name = authForm.name.trim();

    if (mobile.length !== 10) {
      setAuthMessage("Enter a valid 10-digit mobile number.");
      return;
    }
    if (password.length < 4) {
      setAuthMessage("Password must be at least 4 characters.");
      return;
    }

    try {
      if (authMode === "login") {
        const response = await api.login({ role: authRole, mobile, password });
        setSession(response.session);
        setAuthMessage("");
        return;
      }

      if (!name) {
        setAuthMessage("Enter a name to create your account.");
        return;
      }

      const response = await api.register({ role: authRole, name, mobile, password });
      setSession(response.session);
      setAuthMessage("");
    } catch (error) {
      setAuthMessage(error.message || "Unable to complete authentication.");
    }
  };

  const handleLogout = () => {
    setSession(null);
    setAuthMode("login");
    resetAuthForm(authRole, "login");
  };

  if (isHydrating) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "grid", placeItems: "center", color: COLORS.text, fontFamily: "'Outfit', sans-serif" }}>
        Loading canteen data...
      </div>
    );
  }

  if (session?.role === "student") return <StudentPortal currentUser={session} onLogout={handleLogout} timeSlots={timeSlots} menuItems={menuItems} orders={orders.filter((order) => order.student === session.name)} onPlaceOrder={placeOrder} onUpdateOrderStatus={updateOrderStatus} />;
  if (session?.role === "canteen") return <CanteenDashboard currentUser={session} onLogout={handleLogout} timeSlots={timeSlots} menuItems={menuItems} onToggleSlot={toggleSlot} onAdjustSlotCapacity={adjustSlotCapacity} onToggleMenuItem={toggleMenuItem} onSaveMenuItem={saveMenuItem} orders={orders} onUpdateOrderStatus={updateOrderStatus} />;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif", color: COLORS.text, padding: 24 }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Background decoration */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: `radial-gradient(ellipse at 20% 20%, ${COLORS.accent}08 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, ${COLORS.gold}06 0%, transparent 60%)`, pointerEvents: "none" }} />

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>🍽️</div>
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: 42, letterSpacing: -2, background: `linear-gradient(135deg, ${COLORS.text}, ${COLORS.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>CanteenX</h1>
        <p style={{ margin: "10px 0 0", color: COLORS.muted, fontSize: 16, fontWeight: 600 }}>College Canteen Pre-Order System</p>
      </div>

      <div style={{ width: "100%", maxWidth: 980, display: "grid", gridTemplateColumns: "minmax(280px, 360px) minmax(320px, 420px)", gap: 24, alignItems: "stretch" }}>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 28 }}>
          <div style={{ fontSize: 14, color: COLORS.muted, marginBottom: 16 }}>Choose access</div>
          <div style={{ display: "grid", gap: 12 }}>
            {[
              { role: "student", icon: "🎓", title: "Student Login", desc: "Order ahead, pay online, and track pickup.", color: COLORS.accent },
              { role: "canteen", icon: "👨‍🍳", title: "Canteen Staff Login", desc: "Handle live orders, prep flow, and pickup status.", color: COLORS.gold },
            ].map((card) => {
              const active = authRole === card.role;
              return (
                <button
                  key={card.role}
                  onClick={() => switchRole(card.role)}
                  style={{
                    background: active ? `${card.color}16` : COLORS.surface,
                    border: `1px solid ${active ? card.color : COLORS.border}`,
                    borderRadius: 14,
                    padding: "18px 18px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: COLORS.text,
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ fontSize: 26 }}>{card.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{card.title}</div>
                  </div>
                  <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>{card.desc}</div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 18, padding: "14px 16px", borderRadius: 12, background: COLORS.surface, border: `1px solid ${COLORS.border}`, fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
            Demo student: `9876543210` / `student123`<br />
            Demo staff: `9123456780` / `staff123`
          </div>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 28 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            {[
              ["login", "Login"],
              ["register", "Register"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                style={{
                  background: authMode === mode ? COLORS.accent : COLORS.surface,
                  color: authMode === mode ? "#fff" : COLORS.muted,
                  border: `1px solid ${authMode === mode ? COLORS.accent : COLORS.border}`,
                  borderRadius: 10,
                  padding: "10px 18px",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 13,
                  fontFamily: "inherit",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ fontWeight: 900, fontSize: 24, marginBottom: 8 }}>
            {authMode === "login" ? "Welcome back" : "Create your account"}
          </div>
          <div style={{ color: COLORS.muted, fontSize: 14, marginBottom: 22 }}>
            {authRole === "student" ? "Student" : "Canteen staff"} access with mobile number and password.
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {authMode === "register" && (
              <div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Name</div>
                <input
                  value={authForm.name}
                  onChange={(e) => updateAuthField("name", e.target.value)}
                  placeholder={authRole === "canteen" ? "Staff name" : "Student name"}
                  style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                />
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Mobile Number</div>
              <input
                value={authForm.mobile}
                onChange={(e) => updateAuthField("mobile", e.target.value)}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
              />
            </div>

            <div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>Password</div>
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => updateAuthField("password", e.target.value)}
                placeholder="Enter password"
                style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", color: COLORS.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
              />
            </div>
          </div>

          {authMessage && (
            <div style={{ marginTop: 16, background: `${COLORS.red}14`, border: `1px solid ${COLORS.red}44`, color: "#FCA5A5", borderRadius: 10, padding: "12px 14px", fontSize: 13 }}>
              {authMessage}
            </div>
          )}

          <Btn onClick={handleAuthSubmit} style={{ width: "100%", marginTop: 18, padding: "14px", fontSize: 15 }}>
            {authMode === "login"
              ? `Login as ${authRole === "student" ? "Student" : "Canteen Staff"}`
              : `Register ${authRole === "student" ? "Student" : "Canteen Staff"} Account`}
          </Btn>
        </div>
      </div>

      <div style={{ marginTop: 48, fontSize: 12, color: COLORS.muted, textAlign: "center" }}>
        Built with React.js · Inline Styles · Razorpay<br />
        <span style={{ color: COLORS.accent }}>Skip the queue. Order smarter.</span>
      </div>
    </div>
  );
}
