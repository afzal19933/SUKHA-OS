// ✅ Server-safe - NO 'use client'
import { db } from '@/lib/firebase-admin';

/**
 * SUKHA OS — Full Intelligence Context Service
 * Fetches ALL modules: Rooms, Reservations, Housekeeping, Maintenance,
 * Inventory, Finance, Laundry, Team — for maximum AI intelligence
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
      reservationsSnap,
      housekeepingSnap,
      invoicesSnap,
      expensesSnap,
      laundryOrdersSnap,
      inventoryStocksSnap,
      supplyPurchasesSnap,
      teamSnap,
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
    // 🫧 LAUNDRY
    // ============================================================
    const laundryOrders = laundryOrdersSnap.docs.map(d => ({
      roomNumber: d.data().roomNumber || null,
      guestName: d.data().guestName || null,
      status: d.data().status || 'unknown',
      hotelTotal: d.data().hotelTotal || 0,
      createdAt: d.data().createdAt || null,
    }));

    const pendingLaundry = laundryOrders.filter(l => l.status === 'sent' || l.status === 'pending');
    const laundryRevenue = laundryOrders.reduce((acc, l) => acc + l.hotelTotal, 0);

    // ============================================================
    // 📦 INVENTORY
    // ============================================================
    const stocks = inventoryStocksSnap.docs.map(d => ({
      itemName: d.data().itemName || d.id,
      category: d.data().category || 'General',
      currentStock: d.data().currentStock || 0,
      minStock: d.data().minStock || 5,
      unit: d.data().unit || 'pcs',
    }));

    const lowStockItems = stocks.filter(s => s.currentStock <= s.minStock);
    const recentPurchases = supplyPurchasesSnap.docs.map(d => ({
      itemName: d.data().itemName,
      quantity: d.data().quantity,
      totalCost: d.data().totalCost,
      vendor: d.data().vendor,
      date: d.data().date,
    }));

    // ============================================================
    // 👥 TEAM
    // ============================================================
    const team = teamSnap.docs.map(d => ({
      name: d.data().name || 'Unknown',
      role: d.data().role || 'staff',
      isActive: d.data().isActive || false,
    }));

    const activeStaff = team.filter(t => t.isActive);

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
          lowStockAlerts: lowStockItems.length,
        }
      },

      rooms: {
        total: rooms.length,
        vacant: vacantRooms.length,
        occupied: occupiedRooms.length,
        dirty: dirtyRooms.length,
        underMaintenance: maintenanceRooms.length,
        vacantRooms: vacantRooms.map(r => ({ room: r.roomNumber, floor: r.floor, type: r.type })),
        occupiedRooms: occupiedRooms.map(r => ({ room: r.roomNumber, floor: r.floor, type: r.type })),
        dirtyRooms: dirtyRooms.map(r => ({ room: r.roomNumber, floor: r.floor })),
        maintenanceRooms: maintenanceRooms.map(r => ({ room: r.roomNumber, floor: r.floor })),
        allRooms: rooms,
      },

      reservations: {
        totalEver: reservations.length,
        currentlyCheckedIn: checkedInGuests.length,
        arrivalsToday: arrivalsToday,
        checkoutsToday: checkoutsToday,
        upcomingArrivals: upcomingArrivals.slice(0, 10),
        currentGuests: checkedInGuests,
        recentHistory: reservations.slice(0, 15),
      },

      housekeeping: {
        pending: housekeepingTasks.filter(t => t.status === 'pending').length,
        inProgress: housekeepingTasks.filter(t => t.status === 'in_progress').length,
        completed: housekeepingTasks.filter(t => t.status === 'completed').length,
        pendingTasks: housekeepingTasks.filter(t => t.status === 'pending'),
        inProgressTasks: housekeepingTasks.filter(t => t.status === 'in_progress'),
      },

      maintenance: {
        totalOpen: maintenanceTasks.filter(t => t.status !== 'completed').length,
        highPriority: maintenanceTasks.filter(t => t.priority === 'high' && t.status !== 'completed').length,
        openRequests: maintenanceTasks.filter(t => t.status !== 'completed'),
        recentlyResolved: maintenanceTasks.filter(t => t.status === 'completed').slice(0, 5),
      },

      finance: {
        allTime: {
          totalRevenue,
          paidRevenue,
          pendingRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,
        },
        thisMonth: {
          revenue: monthRevenue,
          expenses: monthExpenses,
          netProfit: monthRevenue - monthExpenses,
          invoiceCount: monthInvoices.length,
        },
        laundryRevenue,
        totalCombinedRevenue: totalRevenue + laundryRevenue,
        pendingInvoices: invoices.filter(i => i.status === 'pending'),
        recentInvoices: invoices.slice(0, 10),
        recentExpenses: expenses.slice(0, 10),
        ayursihaAccounts: {
          total: ayursihaInvoices.length,
          totalAmount: ayursihaInvoices.reduce((acc, i) => acc + i.totalAmount, 0),
          pendingAmount: ayursihaInvoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.totalAmount, 0),
          pending: ayursihaInvoices.filter(i => i.status === 'pending'),
          paid: ayursihaInvoices.filter(i => i.status === 'paid'),
        },
      },

      laundry: {
        totalOrders: laundryOrders.length,
        pendingCount: pendingLaundry.length,
        pendingAmount: pendingLaundry.reduce((acc, l) => acc + l.hotelTotal, 0),
        totalRevenue: laundryRevenue,
        pendingOrders: pendingLaundry,
        recentOrders: laundryOrders.slice(0, 10),
      },

      inventory: {
        totalItems: stocks.length,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems,
        allStocks: stocks,
        recentPurchases,
      },

      team: {
        totalStaff: team.length,
        activeStaff: activeStaff.length,
        byRole: {
          admins: team.filter(t => t.role === 'admin').length,
          managers: team.filter(t => t.role === 'manager').length,
          staff: team.filter(t => t.role === 'staff').length,
          owners: team.filter(t => t.role === 'owner').length,
        },
        members: activeStaff,
      },

    };

  } catch (error) {
    console.error('❌ Full context fetch failed:', error);
    return 'Data temporarily unavailable. Please try again.';
  }
}