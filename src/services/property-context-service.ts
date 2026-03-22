'use client';

import { collection, getDocs, query, where, limit, orderBy, Firestore } from 'firebase/firestore';

/**
 * Summarizes the current property state for the AI Assistant.
 * Optimized for management queries.
 */
export async function getPropertyContext(db: Firestore, entityId: string) {
  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = today.substring(0, 7) + "-01";

  try {
    const [roomsSnap, resSnap, tasksSnap, invSnap, laundrySnap] = await Promise.all([
      getDocs(collection(db, "hotel_properties", entityId, "rooms")),
      getDocs(query(collection(db, "hotel_properties", entityId, "reservations"), where("checkInDate", ">=", startOfMonth))),
      getDocs(query(collection(db, "hotel_properties", entityId, "housekeeping_tasks"), limit(20))),
      getDocs(query(collection(db, "hotel_properties", entityId, "invoices"), where("createdAt", ">=", startOfMonth))),
      getDocs(query(collection(db, "hotel_properties", entityId, "guest_laundry_orders"), where("status", "==", "sent")))
    ]);

    const rooms = roomsSnap.docs.map(d => ({ room: d.id, status: d.data().status }));
    const reservations = resSnap.docs.map(d => ({ guest: d.data().guestName, status: d.data().status, date: d.data().checkInDate }));
    const tasks = tasksSnap.docs.map(d => ({ loc: d.data().roomId, type: d.data().taskType, note: d.data().notes, status: d.data().status }));
    const invoices = invSnap.docs.map(d => ({ no: d.data().invoiceNumber, total: d.data().totalAmount, status: d.data().status }));
    const laundry = laundrySnap.docs.map(d => ({ room: d.data().roomNumber, amount: d.data().hotelTotal }));

    return {
      occupancy: {
        total: rooms.length,
        occupied: rooms.filter(r => r.status.includes('occupied')).length,
        vacant: rooms.filter(r => r.status === 'available').length
      },
      housekeeping: {
        cleaned: rooms.filter(r => r.status === 'available' || r.status === 'occupied').length,
        pending: rooms.filter(r => r.status.includes('dirty')).length
      },
      movement: {
        arrivalsToday: reservations.filter(r => r.date === today).length
      },
      revenue: {
        monthToDate: invoices.reduce((acc, i) => acc + (i.total || 0), 0),
        pendingLaundry: laundry.reduce((acc, l) => acc + (l.amount || 0), 0)
      },
      logs: {
        recentTasks: tasks,
        recentInvoices: invoices
      }
    };
  } catch (error) {
    console.error("Context fetch failed:", error);
    return "Data partially unavailable due to system sync lag.";
  }
}
