import { neon } from "@neondatabase/serverless";
import { randomInt, randomUUID } from "node:crypto";
import { buildDynamicTimeSlots, DEFAULT_MENU_ITEMS, DEFAULT_ORDERS, DEFAULT_TIME_SLOTS, DEFAULT_USERS } from "./defaults.js";

let bootstrapPromise;
const RESET_OTP_TTL_MINUTES = 10;

const getSql = () => {
  const env = globalThis.process?.env ?? {};
  const databaseUrl =
    env.POSTGRES_URL ||
    env.DATABASE_URL ||
    env.POSTGRES_PRISMA_URL ||
    env.POSTGRES_URL_NON_POOLING;

  if (!databaseUrl) {
    throw new Error("Missing database connection. Set DATABASE_URL or POSTGRES_URL in Vercel project environment variables.");
  }

  return neon(databaseUrl);
};

const createSchema = async () => {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      password TEXT NOT NULL,
      UNIQUE(role, mobile)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS time_slots (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      booked INTEGER NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      cat TEXT NOT NULL,
      price INTEGER NOT NULL,
      time INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      "desc" TEXT NOT NULL,
      popular BOOLEAN NOT NULL DEFAULT FALSE,
      veg BOOLEAN NOT NULL DEFAULT TRUE,
      active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `;

  await sql`
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
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      mobile TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      consumed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
};

const seedDefaults = async () => {
  const sql = getSql();
  const [{ count: userCount }] = await sql`SELECT COUNT(*)::int AS count FROM users`;
  if (userCount === 0) {
    for (const [role, users] of Object.entries(DEFAULT_USERS)) {
      for (const user of users) {
        await sql`
          INSERT INTO users (role, name, mobile, password)
          VALUES (${role}, ${user.name}, ${user.mobile}, ${user.password})
        `;
      }
    }
  }

  const [{ count: slotCount }] = await sql`SELECT COUNT(*)::int AS count FROM time_slots`;
  if (slotCount === 0) {
    for (const slot of DEFAULT_TIME_SLOTS) {
      await sql`
        INSERT INTO time_slots (id, label, capacity, booked, active)
        VALUES (${slot.id}, ${slot.label}, ${slot.capacity}, ${slot.booked}, ${slot.active})
      `;
    }
  }

  const [{ count: menuCount }] = await sql`SELECT COUNT(*)::int AS count FROM menu_items`;
  if (menuCount === 0) {
    for (const item of DEFAULT_MENU_ITEMS) {
      await sql`
        INSERT INTO menu_items (id, name, cat, price, time, emoji, "desc", popular, veg, active)
        VALUES (${item.id}, ${item.name}, ${item.cat}, ${item.price}, ${item.time}, ${item.emoji}, ${item.desc}, ${item.popular}, ${item.veg}, ${item.active})
      `;
    }
  }

  const [{ count: orderCount }] = await sql`SELECT COUNT(*)::int AS count FROM orders`;
  if (orderCount === 0) {
    for (const order of DEFAULT_ORDERS) {
      await sql`
        INSERT INTO orders (id, student, total, status, time, token, pickup_slot, pickup_slot_id, payment_status, payment_id, items)
        VALUES (${order.id}, ${order.student}, ${order.total}, ${order.status}, ${order.time}, ${order.token}, ${order.pickupSlot}, ${order.pickupSlotId}, ${order.paymentStatus}, ${order.paymentId}, ${JSON.stringify(order.items)}::jsonb)
      `;
    }
  }
};

const syncTimeSlotLabelsToCurrentTime = async () => {
  const sql = getSql();
  const currentSlots = buildDynamicTimeSlots();

  for (const slot of currentSlots) {
    await sql`
      UPDATE time_slots
      SET label = ${slot.label}
      WHERE id = ${slot.id}
    `;
  }
};

export const ensureDatabase = async () => {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await createSchema();
      await seedDefaults();
      await syncTimeSlotLabelsToCurrentTime();
    })();
  }

  return bootstrapPromise;
};

export const getTimeSlots = async () => {
  await ensureDatabase();
  const sql = getSql();
  return sql`SELECT id, label, capacity, booked, active FROM time_slots ORDER BY id`;
};

export const getMenuItems = async () => {
  await ensureDatabase();
  const sql = getSql();
  return sql`SELECT id, name, cat, price, time, emoji, "desc", popular, veg, active FROM menu_items ORDER BY id ASC`;
};

export const getOrders = async () => {
  await ensureDatabase();
  const sql = getSql();
  const rows = await sql`
    SELECT id, student, total, status, time, token, pickup_slot, pickup_slot_id, payment_status, payment_id, items, created_at
    FROM orders
    ORDER BY created_at DESC, id DESC
  `;

  return rows.map((order) => ({
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
    items: Array.isArray(order.items) ? order.items : [],
  }));
};

export const getBootstrap = async () => ({
  timeSlots: await getTimeSlots(),
  menuItems: await getMenuItems(),
  orders: await getOrders(),
});

export const loginUser = async ({ role, mobile, password }) => {
  await ensureDatabase();
  const sql = getSql();
  const [user] = await sql`
    SELECT role, name, mobile
    FROM users
    WHERE role = ${role} AND mobile = ${mobile} AND password = ${password}
    LIMIT 1
  `;
  return user || null;
};

export const registerUser = async ({ role, name, mobile, password }) => {
  await ensureDatabase();
  if (role === "canteen") {
    throw new Error("Staff registration is disabled. Use the assigned staff login credentials.");
  }
  const sql = getSql();
  const [existing] = await sql`
    SELECT 1 AS ok
    FROM users
    WHERE role = ${role} AND mobile = ${mobile}
    LIMIT 1
  `;
  if (existing) {
    throw new Error("This mobile number is already registered.");
  }

  await sql`
    INSERT INTO users (role, name, mobile, password)
    VALUES (${role}, ${name}, ${mobile}, ${password})
  `;

  return { role, name, mobile };
};

const generateOtp = () => String(randomInt(0, 1000000)).padStart(6, "0");

export const requestPasswordReset = async ({ role, mobile }) => {
  await ensureDatabase();
  if (role === "canteen") {
    throw new Error("Staff password reset is disabled. Use the assigned staff login credentials.");
  }

  const sql = getSql();
  const [user] = await sql`
    SELECT role, mobile
    FROM users
    WHERE role = ${role} AND mobile = ${mobile}
    LIMIT 1
  `;

  if (!user) {
    throw new Error("No student account matched that mobile number.");
  }

  const requestId = randomUUID();
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + RESET_OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await sql`DELETE FROM password_reset_requests WHERE expires_at <= NOW()`;
  await sql`DELETE FROM password_reset_requests WHERE role = ${role} AND mobile = ${mobile} AND consumed_at IS NULL`;
  await sql`
    INSERT INTO password_reset_requests (id, role, mobile, otp, expires_at)
    VALUES (${requestId}, ${role}, ${mobile}, ${otp}, ${expiresAt})
  `;

  return {
    requestId,
    expiresAt,
    delivery: "demo",
    demoOtp: otp,
  };
};

export const resetPasswordWithOtp = async ({ role, mobile, requestId, otp, newPassword }) => {
  await ensureDatabase();
  if (role === "canteen") {
    throw new Error("Staff password reset is disabled. Use the assigned staff login credentials.");
  }
  if (!newPassword || newPassword.trim().length < 4) {
    throw new Error("Password must be at least 4 characters.");
  }

  const sql = getSql();
  await sql`DELETE FROM password_reset_requests WHERE expires_at <= NOW()`;

  const [resetRequest] = await sql`
    SELECT id, expires_at, consumed_at
    FROM password_reset_requests
    WHERE id = ${requestId} AND role = ${role} AND mobile = ${mobile} AND otp = ${otp}
    LIMIT 1
  `;

  if (!resetRequest) {
    throw new Error("Invalid or expired OTP.");
  }
  if (resetRequest.consumed_at) {
    throw new Error("This OTP has already been used.");
  }

  const [user] = await sql`
    SELECT 1 AS ok
    FROM users
    WHERE role = ${role} AND mobile = ${mobile}
    LIMIT 1
  `;

  if (!user) {
    throw new Error("No student account matched that mobile number.");
  }

  await sql`
    UPDATE users
    SET password = ${newPassword.trim()}
    WHERE role = ${role} AND mobile = ${mobile}
  `;
  await sql`UPDATE password_reset_requests SET consumed_at = NOW() WHERE id = ${requestId}`;

  return { ok: true };
};

const getNextToken = async () => {
  const sql = getSql();
  const rows = await sql`SELECT token FROM orders`;
  const maxToken = rows.reduce((max, row) => {
    const match = String(row.token || "").match(/(\d+)$/);
    return Math.max(max, match ? Number(match[1]) : 0);
  }, 10);
  return `T-${maxToken + 1}`;
};

const formatTime = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export const createOrder = async ({ items = [], total, student, pickupSlot, pickupSlotId, paymentStatus, paymentId }) => {
  await ensureDatabase();
  const sql = getSql();

  if (!items.length) {
    throw new Error("Order items are required.");
  }

  if (pickupSlotId) {
    const [slot] = await sql`
      SELECT id, label, capacity, booked, active
      FROM time_slots
      WHERE id = ${pickupSlotId}
      LIMIT 1
    `;

    if (!slot || !slot.active) throw new Error("Pickup slot is not available.");
    if (slot.booked >= slot.capacity) throw new Error("Pickup slot is full.");

    await sql`UPDATE time_slots SET booked = booked + 1 WHERE id = ${pickupSlotId}`;
  }

  const id = `ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
  const token = await getNextToken();
  const time = formatTime();

  await sql`
    INSERT INTO orders (id, student, total, status, time, token, pickup_slot, pickup_slot_id, payment_status, payment_id, items)
    VALUES (
      ${id},
      ${student},
      ${total},
      ${"pending"},
      ${time},
      ${token},
      ${pickupSlot || null},
      ${pickupSlotId || null},
      ${paymentStatus || "paid"},
      ${paymentId || "demo-payment"},
      ${JSON.stringify(items)}::jsonb
    )
  `;

  const orders = await getOrders();
  return orders.find((order) => order.id === id);
};

export const updateOrderStatus = async (id, status) => {
  await ensureDatabase();
  const sql = getSql();
  await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
  return getOrders();
};

export const toggleSlot = async (id) => {
  await ensureDatabase();
  const sql = getSql();
  await sql`UPDATE time_slots SET active = NOT active WHERE id = ${id}`;
  return getTimeSlots();
};

export const adjustSlotCapacity = async (id, delta) => {
  await ensureDatabase();
  const sql = getSql();
  const [slot] = await sql`
    SELECT id, capacity, booked
    FROM time_slots
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!slot) {
    throw new Error("Slot not found.");
  }

  const nextCapacity = Math.max(slot.booked, slot.capacity + Number(delta || 0), 1);
  await sql`UPDATE time_slots SET capacity = ${nextCapacity} WHERE id = ${id}`;
  return getTimeSlots();
};

export const toggleMenuItem = async (id) => {
  await ensureDatabase();
  const sql = getSql();
  await sql`UPDATE menu_items SET active = NOT active WHERE id = ${Number(id)} `;
  return getMenuItems();
};

export const saveMenuItem = async (draft) => {
  await ensureDatabase();
  const sql = getSql();

  if (draft.id) {
    await sql`
      UPDATE menu_items
      SET
        name = ${draft.name},
        cat = ${draft.cat},
        price = ${draft.price},
        time = ${draft.time},
        emoji = ${draft.emoji},
        "desc" = ${draft.desc},
        popular = ${draft.popular},
        veg = ${draft.veg},
        active = ${draft.active}
      WHERE id = ${draft.id}
    `;
    return getMenuItems();
  }

  const [{ max_id: maxId }] = await sql`SELECT COALESCE(MAX(id), 0)::int AS max_id FROM menu_items`;
  const nextId = maxId + 1;

  await sql`
    INSERT INTO menu_items (id, name, cat, price, time, emoji, "desc", popular, veg, active)
    VALUES (${nextId}, ${draft.name}, ${draft.cat}, ${draft.price}, ${draft.time}, ${draft.emoji}, ${draft.desc}, ${draft.popular}, ${draft.veg}, ${draft.active})
  `;

  return getMenuItems();
};
