// ✅ NO 'use client' - this runs on server
import { db } from '@/lib/firebase-admin'; // ✅ Admin SDK

/**
 * Summarizes the current property state for the AI Assistant.
 * Server-safe version using Firebase Admin SDK.
 */
export async function getPropertyContext(entityId: string) {
  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = today.substring(0, 7) + "-01";

  try {
    const propertyRef = db.collection('hotel_properties').doc(entityId);

    const [roomsSnap, resSnap, tasksSnap, invSnap, laundrySnap] = await Promise.all([
      propertyRef.collection('rooms').get(),
      propertyRef.collection('reservations')
        .where('checkInDate', '>=', startOfMonth).get(),
      propertyRef.collection('housekeeping_tasks')
        .limit(20).get(),
      propertyRef.collection('invoices')
        .where('createdAt', '>=', startOfMonth).get(),
      propertyRef.collection('guest_laundry_orders')
        .where('status', '==', 'sent').get()
    ]);

    const rooms = roomsSnap.docs.map(d => ({ room: d.id, status: d.data().status }));
    const reservations = resSnap.docs.map(d => ({ guest: d.data().guestName, status: d.data().status, date: d.data().checkInDate }));
    const tasks = tasksSnap.docs.map(d => ({ loc: d.data().roomId, type: d.data().taskType, note: d.data().notes, status: d.data().status }));
    const invoices = invSnap.docs.map(d => ({ no: d.data().invoiceNumber, total: d.data().totalAmount, status: d.data().status }));
    const laundry = laundrySnap.docs.map(d => ({ room: d.data().roomNumber, amount: d.data().hotelTotal }));

    return {
      occupancy: {
        total: rooms.length,
        occupied: rooms.filter(r => r.status?.includes('occupied')).length,
        vacant: rooms.filter(r => r.status === 'available').length
      },
      housekeeping: {
        cleaned: rooms.filter(r => r.status === 'available' || r.status === 'occupied').length,
        pending: rooms.filter(r => r.status?.includes('dirty')).length
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
    console.error('❌ Context fetch failed:', error);
    return 'Data partially unavailable due to system sync lag.';
  }
}