// backend/src/data/demoStore.js
import { v4 as uuid } from "uuid";

export const state = {
  users: [
    {
      id: "u-admin",
      role: "admin",
      status: "active",
      fullName: "Admin",
      email: "admin@example.com",
      password: "admin123",
      credits: 9999,
    },
    {
      id: "u-1",
      role: "user",
      status: "active",
      fullName: "Test User",
      email: "test@gmail.com",
      password: "123456",
      credits: 200,
    },
  ],
  bookings: [],
};

// ---------- Users ----------
export function findUserByEmail(email) {
  return (
    state.users.find(
      (u) => u.email.toLowerCase() === String(email).toLowerCase()
    ) || null
  );
}

export function createUser(user) {
  const u = {
    id: uuid(),
    role: user.role || "user",
    status: user.status || "pending", // pending until approved
    fullName: user.fullName || "",
    email: user.email,
    password: user.password || "", // demo password
    credits: user.credits ?? 0,
    createdAt: new Date().toISOString(),
  };
  state.users.push(u);
  return u;
}

export function setUserStatus(email, status) {
  const u = findUserByEmail(email);
  if (!u) return null;
  u.status = status;
  if (status === "active") u.approvedAt = new Date().toISOString();
  return u;
}

// convenience name (your routes were importing approveUserByEmail)
export function approveUserByEmail(email) {
  return setUserStatus(email, "active");
}

// ---------- Bookings ----------
export function createBooking(payload) {
  const booking = {
    id: uuid(),
    vendor: payload.vendor,
    course: payload.course,
    start: payload.start,
    end: payload.end,
    status: payload.status || "pending", // pending | approved | rejected
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    coupon: payload.coupon || "",
    creditsUsed: payload.creditsUsed || 0,
    createdAt: new Date().toISOString(),
    reminderSentAt: null, // for cron reminders
  };
  state.bookings.push(booking);
  return booking;
}

export function listBookings(filter = {}) {
  const { vendor, course, status, startISO, endISO } = filter;

  return state.bookings.filter((b) => {
    if (vendor && b.vendor !== vendor) return false;
    if (course && b.course !== course) return false;
    if (status && b.status !== status) return false;

    if (startISO && endISO) {
      const start = new Date(startISO);
      const end = new Date(endISO);
      const bs = new Date(b.start);
      const be = new Date(b.end);
      if (!(bs < end && be > start)) return false;
    }
    return true;
  });
}

export function updateStatus(id, status) {
  const b = state.bookings.find((x) => x.id === id);
  if (!b) return null;
  b.status = status;
  return b;
}

// IMPORTANT: scheduler.controller imports listBusyEvents
export function listBusyEvents({ vendor, course, startISO, endISO }) {
  const start = new Date(startISO);
  const end = new Date(endISO);

  return state.bookings
    .filter((b) => {
      if (vendor && b.vendor !== vendor) return false;
      if (course && b.course !== course) return false;

      // treat pending + approved as busy (prevents double booking)
      if (!["pending", "approved"].includes(b.status)) return false;

      const bs = new Date(b.start);
      const be = new Date(b.end);

      return bs < end && be > start;
    })
    .map((b) => ({ start: b.start, end: b.end, status: b.status }));
}

export function listBookingsStartingSoon(now, soon) {
  const nowMs = now.getTime();
  const soonMs = soon.getTime();

  return (state.bookings || []).filter((b) => {
    if (!b?.start || !b?.email) return false;
    if (b.reminderSentAt) return false;

    const startMs = new Date(b.start).getTime();
    return startMs >= nowMs && startMs <= soonMs;
  });
}

export function markReminderSent(bookingId, iso) {
  const b = (state.bookings || []).find((x) => x.id === bookingId);
  if (!b) return null;
  b.reminderSentAt = iso;
  return b;
}