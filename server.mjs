import http from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3001);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "canteen.sqlite");
const DIST_DIR = path.join(__dirname, "dist");
const INDEX_FILE = path.join(DIST_DIR, "index.html");
const db = new DatabaseSync(DB_PATH);

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

const DEFAULT_USERS = {
  student: [
    { name: "Riya Sharma", mobile: "9876543210", password: "student123" },
  ],
  canteen: [
    { name: "Canteen Manager", mobile: "9123456780", password: "staff123" },
  ],
};

const DEFAULT_TIME_SLOTS = [
  { id: "slot-1", label: "10:30 AM - 10:45 AM", capacity: 8, booked: 2, active: true },
  { id: "slot-2", label: "10:45 AM - 11:00 AM", capacity: 10, booked: 4, active: true },
  { id: "slot-3", label: "11:00 AM - 11:15 AM", capacity: 12, booked: 5, active: true },
  { id: "slot-4", label: "11:15 AM - 11:30 AM", capacity: 10, booked: 0, active: false },
];

const DEFAULT_MENU_ITEMS = [
  { id: 1, name: "Masala Dosa", cat: "Breakfast", price: 45, time: 8, emoji: "🫓", desc: "Crispy rice crepe with spiced potato filling", popular: true, veg: true, active: true },
  { id: 2, name: "Idli Sambhar", cat: "Breakfast", price: 30, time: 5, emoji: "🍚", desc: "Steamed rice cakes with lentil soup", popular: false, veg: true, active: true },
  { id: 3, name: "Poha", cat: "Breakfast", price: 25, time: 6, emoji: "🍽️", desc: "Flattened rice with mustard seeds & peas", popular: true, veg: true, active: true },
  { id: 4, name: "Veg Thali", cat: "Lunch", price: 80, time: 12, emoji: "🍱", desc: "Complete meal: dal, sabzi, roti, rice & salad", popular: true, veg: true, active: true },
  { id: 5, name: "Chicken Biryani", cat: "Lunch", price: 120, time: 15, emoji: "🍛", desc: "Aromatic basmati rice with tender chicken", popular: true, veg: false, active: true },
  { id: 6, name: "Paneer Butter Masala", cat: "Lunch", price: 90, time: 10, emoji: "🧆", desc: "Cottage cheese in rich tomato-cream gravy", popular: false, veg: true, active: true },
  { id: 7, name: "Dal Tadka + Rice", cat: "Lunch", price: 65, time: 8, emoji: "🍲", desc: "Tempered yellow lentils with steamed rice", popular: false, veg: true, active: true },
  { id: 8, name: "Samosa (2 pcs)", cat: "Snacks", price: 20, time: 3, emoji: "🥟", desc: "Crispy pastry stuffed with spiced potatoes", popular: true, veg: true, active: true },
  { id: 9, name: "Vada Pav", cat: "Snacks", price: 15, time: 4, emoji: "🍔", desc: "Mumbai street burger with spicy potato patty", popular: true, veg: true, active: true },
  { id: 10, name: "Spring Rolls", cat: "Snacks", price: 35, time: 6, emoji: "🥢", desc: "Crispy rolls with mixed veggies filling", popular: false, veg: true, active: true },
  { id: 11, name: "Chai", cat: "Beverages", price: 12, time: 3, emoji: "☕", desc: "Classic Indian masala tea", popular: true, veg: true, active: true },
  { id: 12, name: "Cold Coffee", cat: "Beverages", price: 45, time: 4, emoji: "🥤", desc: "Chilled blended coffee with ice cream", popular: true, veg: true, active: true },
  { id: 13, name: "Lassi", cat: "Beverages", price: 30, time: 3, emoji: "🥛", desc: "Thick sweet yogurt drink", popular: false, veg: true, active: true },
  { id: 14, name: "Fresh Lime Soda", cat: "Beverages", price: 25, time: 2, emoji: "🍋", desc: "Refreshing lime with soda water", popular: false, veg: true, active: true },
  { id: 15, name: "Gulab Jamun", cat: "Desserts", price: 30, time: 2, emoji: "🍮", desc: "Soft milk-solid balls in rose syrup", popular: true, veg: true, active: true },
  { id: 16, name: "Ice Cream", cat: "Desserts", price: 40, time: 1, emoji: "🍨", desc: "Choice of vanilla, chocolate, or strawberry", popular: false, veg: true, active: true },
];

const DEFAULT_ORDERS = [
  { id: "ORD-001", student: "Riya Sharma", items: [{ name: "Masala Dosa", qty: 2, price: 45 }, { name: "Chai", qty: 2, price: 12 }], total: 114, status: "preparing", time: "10:23 AM", token: "T-12", pickupSlot: "10:30 AM - 10:45 AM", pickupSlotId: "slot-1", paymentStatus: "paid", paymentId: "demo-payment-1" },
  { id: "ORD-002", student: "Aarav Mehta", items: [{ name: "Veg Thali", qty: 1, price: 80 }, { name: "Lassi", qty: 1, price: 30 }], total: 110, status: "ready", time: "10:18 AM", token: "T-11", pickupSlot: "10:45 AM - 11:00 AM", pickupSlotId: "slot-2", paymentStatus: "paid", paymentId: "demo-payment-2" },
  { id: "ORD-003", student: "Priya Nair", items: [{ name: "Chicken Biryani", qty: 1, price: 120 }], total: 120, status: "pending", time: "10:31 AM", token: "T-13", pickupSlot: "11:00 AM - 11:15 AM", pickupSlotId: "slot-3", paymentStatus: "paid", paymentId: "demo-payment-3" },
];

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    password TEXT NOT NULL,
    UNIQUE(role, mobile)
  );

  CREATE TABLE IF NOT EXISTS time_slots (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    booked INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    cat TEXT NOT NULL,
    price INTEGER NOT NULL,
    time INTEGER NOT NULL,
    emoji TEXT NOT NULL,
    desc TEXT NOT NULL,
    popular INTEGER NOT NULL DEFAULT 0,
    veg INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    student TEXT NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL,
    time TEXT NOT NULL,
    token TEXT NOT NULL,
    pickup_slot TEXT,
    pickup_slot_id TEXT,
    payment_status TEXT,
    payment_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL,
    price INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );
`);

const countTable = (tableName) => db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get().count;

if (countTable("users") === 0) {
  const insertUser = db.prepare("INSERT INTO users (role, name, mobile, password) VALUES (?, ?, ?, ?)");
  for (const [role, users] of Object.entries(DEFAULT_USERS)) {
    users.forEach((user) => insertUser.run(role, user.name, user.mobile, user.password));
  }
}

if (countTable("time_slots") === 0) {
  const insertSlot = db.prepare("INSERT INTO time_slots (id, label, capacity, booked, active) VALUES (?, ?, ?, ?, ?)");
  DEFAULT_TIME_SLOTS.forEach((slot) => insertSlot.run(slot.id, slot.label, slot.capacity, slot.booked, slot.active ? 1 : 0));
}

if (countTable("menu_items") === 0) {
  const insertItem = db.prepare("INSERT INTO menu_items (id, name, cat, price, time, emoji, desc, popular, veg, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  DEFAULT_MENU_ITEMS.forEach((item) => {
    insertItem.run(item.id, item.name, item.cat, item.price, item.time, item.emoji, item.desc, item.popular ? 1 : 0, item.veg ? 1 : 0, item.active ? 1 : 0);
  });
}

if (countTable("orders") === 0) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, student, total, status, time, token, pickup_slot, pickup_slot_id, payment_status, payment_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertOrderItem = db.prepare("INSERT INTO order_items (order_id, name, qty, price) VALUES (?, ?, ?, ?)");
  DEFAULT_ORDERS.forEach((order) => {
    insertOrder.run(order.id, order.student, order.total, order.status, order.time, order.token, order.pickupSlot, order.pickupSlotId, order.paymentStatus, order.paymentId);
    order.items.forEach((item) => insertOrderItem.run(order.id, item.name, item.qty, item.price));
  });
}

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const sendJson = (req, res, status, payload) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  res.end(JSON.stringify(payload));
};

const sendFile = (req, res, filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
};

const formatBool = (value) => Boolean(value);

const getTimeSlots = () =>
  db.prepare("SELECT id, label, capacity, booked, active FROM time_slots ORDER BY id").all().map((slot) => ({
    ...slot,
    active: formatBool(slot.active),
  }));

const getMenuItems = () =>
  db.prepare("SELECT id, name, cat, price, time, emoji, desc, popular, veg, active FROM menu_items ORDER BY id ASC").all().map((item) => ({
    ...item,
    popular: formatBool(item.popular),
    veg: formatBool(item.veg),
    active: formatBool(item.active),
  }));

const getOrders = () => {
  const orders = db.prepare(`
    SELECT id, student, total, status, time, token, pickup_slot, pickup_slot_id, payment_status, payment_id, created_at
    FROM orders
    ORDER BY datetime(created_at) DESC, rowid DESC
  `).all();
  const items = db.prepare("SELECT order_id, name, qty, price FROM order_items ORDER BY id ASC").all();
  const itemsByOrder = new Map();
  items.forEach((item) => {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push({ name: item.name, qty: item.qty, price: item.price });
  });
  return orders.map((order) => ({
    id: order.id,
    student: order.student,
    total: order.total,
    status: order.status,
    time: order.time,
    token: order.token,
    pickupSlot: order.pickup_slot,
    pickupSlotId: order.pickup_slot_id,
    paymentStatus: order.payment_status,
    paymentId: order.payment_id,
    items: itemsByOrder.get(order.id) || [],
  }));
};

const getBootstrap = () => ({
  timeSlots: getTimeSlots(),
  menuItems: getMenuItems(),
  orders: getOrders(),
});

const getNextToken = () => {
  const rows = db.prepare("SELECT token FROM orders").all();
  const maxToken = rows.reduce((max, row) => {
    const match = String(row.token || "").match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 10);
  return `T-${maxToken + 1}`;
};

const formatTime = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if ((req.method === "GET" || req.method === "HEAD") && pathname === "/health") {
      sendJson(req, res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && pathname === "/api/bootstrap") {
      sendJson(req, res, 200, getBootstrap());
      return;
    }

    if (req.method === "POST" && pathname === "/api/auth/login") {
      const { role, mobile, password } = await readJsonBody(req);
      const user = db.prepare("SELECT role, name, mobile FROM users WHERE role = ? AND mobile = ? AND password = ?").get(role, mobile, password);
      if (!user) {
        sendJson(req, res, 401, { error: `No ${role === "canteen" ? "staff" : "student"} account matched those details.` });
        return;
      }
      sendJson(req, res, 200, { session: user });
      return;
    }

    if (req.method === "POST" && pathname === "/api/auth/register") {
      const { role, name, mobile, password } = await readJsonBody(req);
      const existing = db.prepare("SELECT 1 FROM users WHERE role = ? AND mobile = ?").get(role, mobile);
      if (existing) {
        sendJson(req, res, 409, { error: "This mobile number is already registered." });
        return;
      }
      db.prepare("INSERT INTO users (role, name, mobile, password) VALUES (?, ?, ?, ?)").run(role, name, mobile, password);
      sendJson(req, res, 201, { session: { role, name, mobile } });
      return;
    }

    if (req.method === "POST" && pathname === "/api/orders") {
      const { items = [], total, student, pickupSlot, pickupSlotId, paymentStatus, paymentId } = await readJsonBody(req);
      if (!items.length) {
        sendJson(req, res, 400, { error: "Order items are required." });
        return;
      }

      const createOrder = db.transaction(() => {
        let slot = null;
        if (pickupSlotId) {
          slot = db.prepare("SELECT id, label, capacity, booked, active FROM time_slots WHERE id = ?").get(pickupSlotId);
          if (!slot || !slot.active) throw new Error("Pickup slot is not available.");
          if (slot.booked >= slot.capacity) throw new Error("Pickup slot is full.");
          db.prepare("UPDATE time_slots SET booked = booked + 1 WHERE id = ?").run(pickupSlotId);
        }

        const orderId = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
        const token = getNextToken();
        const orderTime = formatTime();

        db.prepare(`
          INSERT INTO orders (id, student, total, status, time, token, pickup_slot, pickup_slot_id, payment_status, payment_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, student, total, "pending", orderTime, token, pickupSlot || slot?.label || null, pickupSlotId || null, paymentStatus || "paid", paymentId || "demo-payment");

        const insertOrderItem = db.prepare("INSERT INTO order_items (order_id, name, qty, price) VALUES (?, ?, ?, ?)");
        items.forEach((item) => insertOrderItem.run(orderId, item.name, item.qty, item.price));
        return orderId;
      });

      const orderId = createOrder();
      sendJson(req, res, 201, {
        order: getOrders().find((order) => order.id === orderId),
        ...getBootstrap(),
      });
      return;
    }

    const orderStatusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
    if (req.method === "PATCH" && orderStatusMatch) {
      const { status } = await readJsonBody(req);
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderStatusMatch[1]);
      sendJson(req, res, 200, { orders: getOrders() });
      return;
    }

    const slotToggleMatch = pathname.match(/^\/api\/slots\/([^/]+)\/toggle$/);
    if (req.method === "PATCH" && slotToggleMatch) {
      db.prepare("UPDATE time_slots SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?").run(slotToggleMatch[1]);
      sendJson(req, res, 200, { timeSlots: getTimeSlots() });
      return;
    }

    const slotCapacityMatch = pathname.match(/^\/api\/slots\/([^/]+)\/capacity$/);
    if (req.method === "PATCH" && slotCapacityMatch) {
      const { delta } = await readJsonBody(req);
      const slot = db.prepare("SELECT capacity, booked FROM time_slots WHERE id = ?").get(slotCapacityMatch[1]);
      if (!slot) {
        sendJson(req, res, 404, { error: "Slot not found." });
        return;
      }
      const nextCapacity = Math.max(slot.booked, slot.capacity + Number(delta || 0), 1);
      db.prepare("UPDATE time_slots SET capacity = ? WHERE id = ?").run(nextCapacity, slotCapacityMatch[1]);
      sendJson(req, res, 200, { timeSlots: getTimeSlots() });
      return;
    }

    const menuToggleMatch = pathname.match(/^\/api\/menu\/([^/]+)\/toggle$/);
    if (req.method === "PATCH" && menuToggleMatch) {
      db.prepare("UPDATE menu_items SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?").run(Number(menuToggleMatch[1]));
      sendJson(req, res, 200, { menuItems: getMenuItems() });
      return;
    }

    if (req.method === "POST" && pathname === "/api/menu") {
      const draft = await readJsonBody(req);
      if (draft.id) {
        db.prepare(`
          UPDATE menu_items
          SET name = ?, cat = ?, price = ?, time = ?, emoji = ?, desc = ?, popular = ?, veg = ?, active = ?
          WHERE id = ?
        `).run(draft.name, draft.cat, draft.price, draft.time, draft.emoji, draft.desc, draft.popular ? 1 : 0, draft.veg ? 1 : 0, draft.active ? 1 : 0, draft.id);
      } else {
        const nextId = (db.prepare("SELECT COALESCE(MAX(id), 0) as maxId FROM menu_items").get().maxId || 0) + 1;
        db.prepare(`
          INSERT INTO menu_items (id, name, cat, price, time, emoji, desc, popular, veg, active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(nextId, draft.name, draft.cat, draft.price, draft.time, draft.emoji, draft.desc, draft.popular ? 1 : 0, draft.veg ? 1 : 0, draft.active ? 1 : 0);
      }
      sendJson(req, res, 200, { menuItems: getMenuItems() });
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && existsSync(DIST_DIR)) {
      const requestedPath = pathname === "/" ? INDEX_FILE : path.join(DIST_DIR, pathname.replace(/^\/+/, ""));
      if (existsSync(requestedPath) && !requestedPath.endsWith(path.sep)) {
        sendFile(req, res, requestedPath);
        return;
      }

      if (existsSync(INDEX_FILE)) {
        sendFile(req, res, INDEX_FILE);
        return;
      }
    }

    sendJson(req, res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(req, res, 500, { error: error instanceof Error ? error.message : "Unexpected server error." });
  }
});

server.listen(PORT, () => {
  console.log(`CanteenX server listening on http://localhost:${PORT}`);
});
