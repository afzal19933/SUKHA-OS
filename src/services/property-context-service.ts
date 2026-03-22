// ✅ Server-safe - NO 'use client'
import { db } from '@/lib/firebase-admin';

/**
 * Full Data Context Service for SUKHA OS AI Assistant
 * Fetches ALL collections and returns complete data for intelligent AI responses
 */
export async function getPropertyContext(entityId: string) {
  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = today.substring(0, 7) + '-01';

  try {
    const propertyRef = db.collection('hotel_properties').doc(entityId);

    // ✅ Fetch ALL collections in parallel
    const [
      roomsSnap,
      roomTypesSnap,
      resSnap,
      tasksSnap,
      invSnap,
      laundrySnap,
    ] = await Promise.all([
      propertyRef.collection('rooms').get(),
      propertyRef.collection('room_types').get(),
      propertyRef.collection('reservations').get(),
      propertyRef.collection('housekeeping_tasks').get(),
      propertyRef.collection('invoices').get(),
      propertyRef.collection('guest_laundry_orders').get(),
    ]);

    // ✅ ROOMS — full detail
    const rooms = roomsSnap.docs.map(d => ({
      roomNumber: d.data().roomNumber || d.id,
      floor: d.data().floor || null,
      status: d.data().status || 'unknown',
      roomTypeId: d.data().roomTypeId || null,
      updatedAt: d.data().updatedAt || null,
    }));

    // ✅ ROOM TYPES
    const roomTypes = roomTypesSnap.docs.map(d => ({
      id: d.id,
      name: d.data().name || d.id,
      baseRate: d.data().baseRate || null,
    }));

    // Helper to get room type name
    const getRoomType = (roomTypeId: string) => {
      const rt = roomTypes.find(r => r.id === roomTypeId);
      return rt?.name || 'Standard';
    };

    // ✅ RESERVATIONS — full detail
    const allReservations = resSnap.docs.map(d => ({
      guestName: d.data().guestName || 'Unknown',
      roomNumber: d.data().roomNumber || null,
      status: d.data().status || 'unknown',
      checkInDate: d.data().checkInDate || null,
      checkOutDate: d.data().checkOutDate || null,
      totalAmount: d.data().totalAmount || 0,
      source: d.data().source || 'Direct',
      createdAt: d.data().createdAt || null,
    }));

    // ✅ HOUSEKEEPING TASKS — full detail
    const allTasks = tasksSnap.docs.map(d => ({
      roomNumber: d.data().roomId || d.data().roomNumber || null,
      taskType: d.data().taskType || 'Unknown',
      status: d.data().status || 'unknown',
      notes: d.data().notes || null,
      assignedTo: d.data().assignedTo || null,
      createdAt: d.data().createdAt || null,
    }));

    // ✅ INVOICES — full detail
    const allInvoices = invSnap.docs.map(d => ({
      invoiceNumber: d.data().invoiceNumber || d.id,
      guestName: d.data().guestName || null,
      totalAmount: d.data().totalAmount || 0,
      status: d.data().status || 'unknown',
      type: d.data().type || 'room',
      createdAt: d.data().createdAt || null,
    }));

    // ✅ LAUNDRY ORDERS
    const allLaundry = laundrySnap.docs.map(d => ({
      roomNumber: d.data().roomNumber || null,
      guestName: d.data().guestName || null,
      status: d.data().status || 'unknown',
      hotelTotal: d.data().hotelTotal || 0,
      createdAt: d.data().createdAt || null,
    }));

    // ✅ BUILD INTELLIGENT CONTEXT
    return {

      // --- ROOMS ---
      rooms: {
        total: rooms.length,
        vacant: rooms.filter(r => r.status === 'available').length,
        occupied: rooms.filter(r => r.status?.includes('occupied')).length,
        dirty: rooms.filter(r => r.status?.includes('dirty')).length,
        maintenance: rooms.filter(r => r.status?.includes('maintenance')).length,
        vacantRooms: rooms
          .filter(r => r.status === 'available')
          .map(r => ({
            room: r.roomNumber,
            floor: r.floor,
            type: getRoomType(r.roomTypeId),
          })),
        occupiedRooms: rooms
          .filter(r => r.status?.includes('occupied'))
          .map(r => ({
            room: r.roomNumber,
            floor: r.floor,
            type: getRoomType(r.roomTypeId),
          })),
        dirtyRooms: rooms
          .filter(r => r.status?.includes('dirty'))
          .map(r => ({ room: r.roomNumber, floor: r.floor })),
        allRooms: rooms.map(r => ({
          room: r.roomNumber,
          floor: r.floor,
          status: r.status,
          type: getRoomType(r.roomTypeId),
        })),
      },

      // --- RESERVATIONS ---
      reservations: {
        total: allReservations.length,
        checkedIn: allReservations.filter(r => r.status === 'checked_in').length,
        checkedOut: allReservations.filter(r => r.status === 'checked_out').length,
        confirmed: allReservations.filter(r => r.status === 'confirmed').length,
        arrivalsToday: allReservations.filter(r => r.checkInDate === today),
        checkoutsToday: allReservations.filter(r => r.checkOutDate === today),
        currentGuests: allReservations.filter(r => r.status === 'checked_in'),
        upcomingArrivals: allReservations.filter(r =>
          r.status === 'confirmed' && r.checkInDate >= today
        ),
        recentReservations: allReservations.slice(0, 10),
      },

      // --- HOUSEKEEPING ---
      housekeeping: {
        totalTasks: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        inProgress: allTasks.filter(t => t.status === 'in_progress').length,
        completed: allTasks.filter(t => t.status === 'completed').length,
        pendingTasks: allTasks.filter(t => t.status === 'pending'),
        inProgressTasks: allTasks.filter(t => t.status === 'in_progress'),
        recentTasks: allTasks.slice(0, 10),
      },

      // --- FINANCIALS ---
      financials: {
        totalInvoices: allInvoices.length,
        totalRevenue: allInvoices.reduce((acc, i) => acc + (i.totalAmount || 0), 0),
        paidRevenue: allInvoices
          .filter(i => i.status === 'paid')
          .reduce((acc, i) => acc + (i.totalAmount || 0), 0),
        pendingRevenue: allInvoices
          .filter(i => i.status === 'pending')
          .reduce((acc, i) => acc + (i.totalAmount || 0), 0),
        monthToDate: allInvoices
          .filter(i => i.createdAt >= startOfMonth)
          .reduce((acc, i) => acc + (i.totalAmount || 0), 0),
        recentInvoices: allInvoices.slice(0, 10),
        pendingInvoices: allInvoices.filter(i => i.status === 'pending'),
      },

      // --- LAUNDRY ---
      laundry: {
        totalOrders: allLaundry.length,
        pendingOrders: allLaundry.filter(l => l.status === 'pending').length,
        sentOrders: allLaundry.filter(l => l.status === 'sent').length,
        totalAmount: allLaundry.reduce((acc, l) => acc + (l.hotelTotal || 0), 0),
        pendingAmount: allLaundry
          .filter(l => l.status === 'sent')
          .reduce((acc, l) => acc + (l.hotelTotal || 0), 0),
        recentOrders: allLaundry.slice(0, 10),
      },

      // --- TODAY SUMMARY ---
      today: {
        date: today,
        arrivalsCount: allReservations.filter(r => r.checkInDate === today).length,
        checkoutsCount: allReservations.filter(r => r.checkOutDate === today).length,
        vacantRoomsCount: rooms.filter(r => r.status === 'available').length,
        pendingHousekeeping: allTasks.filter(t => t.status === 'pending').length,
      },

    };

  } catch (error) {
    console.error('❌ Full context fetch failed:', error);
    return 'Data temporarily unavailable. Please try again.';
  }
}