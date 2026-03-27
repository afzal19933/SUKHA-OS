// ✅ Server-safe - NO 'use client'
import { db } from '@/lib/firebase-admin';

/**
 * SUKHA OS — Full Intelligence Context Service
 * Fetches ALL modules: Rooms, Reservations, Housekeeping, Maintenance,
 * Inventory, Finance, Laundry, Team, and Attendance — for maximum AI intelligence
 */
export async function getPropertyContext(entityId: string) {
  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];
  const startOfMonth = today.substring(0, 7) + '-01';

  // DD-MM-YYYY format for attendance lookup
  const dd = String(todayDate.getDate()).padStart(2, '0');
  const mm = String(todayDate.getMonth() + 1).padStart(2, '0');
  const yyyy = todayDate.getFullYear();
  const todayFormatted = `${dd}-${mm}-${yyyy}`;

  try {
    const propertyRef = db.collection('hotel_properties').doc(entityId);

    // ✅ Fetch ALL collections in parallel
    const [
      roomsSnap,
      roomTypesSnap,
      reservationsSnap,
      housekeepingSnap,
      invoicesSnap,
      expensesSnap,
      laundryOrdersSnap,
      inventoryStocksSnap,
      supplyPurchasesSnap,
      teamSnap,
      attendanceSnap,
    ] = await Promise.all([
      propertyRef.collection('rooms').get(),
      propertyRef.collection('room_types').get(),
      propertyRef.collection('reservations').get(),
      propertyRef.collection('housekeeping_tasks').get(),
      propertyRef.collection('invoices').get(),
      propertyRef.collection('expenses').get(),
      propertyRef.collection('guest_laundry_orders').get(),
      propertyRef.collection('inventory_stocks').get(),
      propertyRef.collection('supply_purchases').orderBy('date', 'desc').limit(20).get(),
      db.collection('user_profiles').where('entityId', '==', entityId).get(),
      db.collection('attendance_records').where('date', '==', todayFormatted).get(),
    ]);

    // ============================================================
    // 🏨 ROOMS
    // ============================================================
    const roomTypes = roomTypesSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
    const getRoomType = (id: string) => roomTypes.find(r => r.id === id)?.name || 'Standard';

    const rooms = roomsSnap.docs.map(d => ({
      roomNumber: d.data().roomNumber || d.id,
      floor: d.data().floor || null,
      status: d.data().status || 'unknown',
      type: getRoomType(d.data().roomTypeId),
    }));

    const vacantRooms = rooms.filter(r => r.status === 'available');
    const occupiedRooms = rooms.filter(r => r.status?.includes('occupied'));
    const dirtyRooms = rooms.filter(r => r.status?.includes('dirty'));
    const maintenanceRooms = rooms.filter(r => r.status?.includes('maintenance'));

    // ============================================================
    // 📅 RESERVATIONS
    // ============================================================
    const reservations = reservationsSnap.docs.map(d => ({
      guestName: d.data().guestName || 'Unknown',
      roomNumber: d.data().roomNumber || null,
      status: d.data().status || 'unknown',
      checkInDate: d.data().checkInDate || null,
      checkOutDate: d.data().checkOutDate || null,
      totalAmount: d.data().totalAmount || 0,
      source: d.data().bookingSource || d.data().source || 'Direct',
      nights: d.data().nights || null,
    }));

    const checkedInGuests = reservations.filter(r => r.status === 'checked_in');
    const arrivalsToday = reservations.filter(r => r.checkInDate === today);
    const checkoutsToday = reservations.filter(r => r.checkOutDate === today);
    const upcomingArrivals = reservations.filter(r => r.status === 'confirmed' && r.checkInDate >= today);

    // ============================================================
    // 🧹 HOUSEKEEPING & MAINTENANCE
    // ============================================================
    const allTasks = housekeepingSnap.docs.map(d => ({
      room: d.data().roomId || d.data().roomNumber || 'Unknown',
      taskType: d.data().taskType || 'cleaning',
      status: d.data().status || 'unknown',
      priority: d.data().priority || 'medium',
      notes: d.data().notes || null,
      isCommonArea: d.data().isCommonArea || false,
      createdAt: d.data().createdAt || null,
    }));

    const housekeepingTasks = allTasks.filter(t => t.taskType !== 'repair');
    const maintenanceTasks = allTasks.filter(t => t.taskType === 'repair');

    // ============================================================
    // 💰 FINANCE
    // ============================================================
    const invoices = invoicesSnap.docs.map(d => ({
      invoiceNumber: d.data().invoiceNumber || d.id,
      guestName: d.data().guestName || d.data().guestDetails?.name || null,
      totalAmount: d.data().totalAmount || 0,
      status: d.data().status || 'unknown',
      source: d.data().bookingSource || 'Direct',
      isAyursiha: d.data().isCycleInvoice || d.data().invoiceNumber?.startsWith('AYUR') || false,
      createdAt: d.data().createdAt || null,
    }));

    const expenses = expensesSnap.docs.map(d => ({
      description: d.data().description || 'Unknown',
      category: d.data().category || 'General',
      amount: d.data().amount || 0,
      date: d.data().date || null,
    }));

    const monthInvoices = invoices.filter(i => i.createdAt >= startOfMonth);
    const totalRevenue = invoices.reduce((acc, i) => acc + i.totalAmount, 0);
    const monthRevenue = monthInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
    const paidRevenue = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.totalAmount, 0);
    const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.totalAmount, 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
    const monthExpenses = expenses.filter(e => e.date >= startOfMonth).reduce((acc, e) => acc + e.amount, 0);
    const ayursihaInvoices = invoices.filter(i => i.isAyursiha);

    // ============================================================
    // 👥 ATTENDANCE
    // ============================================================
    const attendanceRecords = attendanceSnap.docs.map(d => d.data());
    const attendanceMap: Record<string, any> = {};
    
    attendanceRecords.forEach(r => {
      const name = r.staffName;
      if (!attendanceMap[name]) attendanceMap[name] = { name, checkIn: null, isLate: false };
      if (r.type === 'check_in') {
        attendanceMap[name].checkIn = r.time;
        attendanceMap[name].isLate = r.isLate;
      }
    });

    const presentNames: string[] = [];
    const lateNames: string[] = [];
    const halfDayNames: string[] = [];
    const absentNames: string[] = [];

    // Helper to calculate status from check-in time
    const getStatusForReport = (time: string, isLate: boolean) => {
      if (!time) return "Absent";
      const [h, m] = time.split(':').map(Number);
      const delay = (h - 9) * 60 + m; // From 09:00 AM
      if (delay > 60) return "Half Day";
      if (isLate || delay > 0) return "Late";
      return "Present";
    };

    // Assuming we only check active team members for attendance
    const team = teamSnap.docs.map(d => ({
      name: d.data().name || 'Unknown',
      role: d.data().role || 'staff',
      isActive: d.data().isActive || false,
    }));

    team.filter(t => t.isActive && t.role !== 'admin' && t.role !== 'owner').forEach(member => {
      const record = attendanceMap[member.name];
      const status = getStatusForReport(record?.checkIn, record?.isLate);
      
      if (status === "Present") presentNames.push(member.name);
      else if (status === "Late") lateNames.push(member.name);
      else if (status === "Half Day") halfDayNames.push(member.name);
      else absentNames.push(member.name);
    });

    // ============================================================
    // ✅ RETURN COMPLETE CONTEXT
    // ============================================================
    return {
      today: {
        date: today,
        summary: {
          totalRooms: rooms.length,
          vacantCount: vacantRooms.length,
          occupiedCount: occupiedRooms.length,
          dirtyCount: dirtyRooms.length,
          arrivalsCount: arrivalsToday.length,
          checkoutsCount: checkoutsToday.length,
          pendingHousekeeping: housekeepingTasks.filter(t => t.status === 'pending').length,
          pendingMaintenance: maintenanceTasks.filter(t => t.status === 'pending').length,
          lowStockAlerts: inventoryStocksSnap.docs.filter(d => d.data().currentStock <= (d.data().minStock || 5)).length,
        }
      },

      attendance: {
        presentCount: presentNames.length,
        presentNames: presentNames.join(", ") || "None",
        lateCount: lateNames.length,
        lateNames: lateNames.join(", ") || "None",
        halfDayCount: halfDayNames.length,
        halfDayNames: halfDayNames.join(", ") || "None",
        absentCount: absentNames.length,
        absentNames: absentNames.join(", ") || "None",
      },

      rooms: {
        total: rooms.length,
        vacant: vacantRooms.length,
        occupied: occupiedRooms.length,
        dirty: dirtyRooms.length,
        underMaintenance: maintenanceRooms.length,
        vacantRooms: vacantRooms.map(r => ({ room: r.roomNumber, floor: r.floor, type: r.type })),
        occupiedRooms: occupiedRooms.map(r => ({ room: r.roomNumber, floor: r.floor, type: r.type })),
        allRooms: rooms,
      },

      reservations: {
        totalEver: reservations.length,
        currentlyCheckedIn: checkedInGuests.length,
        arrivalsToday: arrivalsToday,
        checkoutsToday: checkoutsToday,
        currentGuests: checkedInGuests,
      },

      finance: {
        allTime: {
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,
        },
        thisMonth: {
          revenue: monthRevenue,
          expenses: monthExpenses,
          netProfit: monthRevenue - monthExpenses,
        },
        totalCombinedRevenue: totalRevenue + laundryOrdersSnap.docs.reduce((acc, l) => acc + (l.data().hotelTotal || 0), 0),
      },

      laundry: {
        totalOrders: laundryOrdersSnap.docs.length,
        pendingCount: laundryOrdersSnap.docs.filter(l => l.data().status === 'sent' || l.data().status === 'pending').length,
        totalRevenue: laundryOrdersSnap.docs.reduce((acc, l) => acc + (l.data().hotelTotal || 0), 0),
      },

      inventory: {
        totalItems: inventoryStocksSnap.docs.length,
        lowStockCount: inventoryStocksSnap.docs.filter(d => d.data().currentStock <= (d.data().minStock || 5)).length,
      },

      team: {
        totalStaff: team.length,
        activeStaff: team.filter(t => t.isActive).length,
        members: team.filter(t => t.isActive),
      },
    };

  } catch (error) {
    console.error('❌ Full context fetch failed:', error);
    return 'Data temporarily unavailable. Please try again.';
  }
}
