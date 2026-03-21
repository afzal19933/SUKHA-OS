'use client';

import { collection, query, where, getDocs, Firestore } from "firebase/firestore";
import { addDocumentNonBlocking } from "./non-blocking-updates";

export type NotificationType = 'checkin' | 'checkout' | 'housekeeping' | 'maintenance' | 'purchase' | 'info' | 'alert';

interface NotificationData {
  title: string;
  message: string;
  type: NotificationType;
  entityId: string;
  propertyName?: string; // Explicit property name for voice context
}

/**
 * Broadcasts a notification to relevant users based on their roles and access levels.
 * Enforces strict financial isolation for non-admin roles.
 */
export async function broadcastNotification(db: Firestore, data: NotificationData) {
  const { entityId, type, propertyName = "Property" } = data;

  try {
    // 1. Fetch all users associated with this entity or 'all'
    const usersRef = collection(db, "user_profiles");
    const q = query(usersRef, where("isActive", "==", true));
    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const profile = docSnap.data();
      const userId = docSnap.id;

      // Access Check: User must have access to this entity or global access
      const hasEntityAccess = profile.entityId === entityId || profile.entityId === 'all';
      if (!hasEntityAccess) return;

      // Role-Based Filtering Logic
      const isAdminOrOwner = ['admin', 'owner'].includes(profile.role);
      const isManager = profile.role === 'manager';
      const isOpsStaff = ['supervisor', 'frontdesk', 'staff'].includes(profile.role);

      // Category Checks
      const isFinancial = ['purchase'].includes(type);
      const isOperational = ['checkin', 'checkout', 'housekeeping', 'maintenance'].includes(type);

      let shouldNotify = false;

      if (isAdminOrOwner || isManager) {
        // Management/Admins get ALL alerts including financial
        shouldNotify = true;
      } else if (isOpsStaff) {
        // Supervisors/Front Desk get operational alerts ONLY (No financial alerts)
        shouldNotify = isOperational;
      }

      if (shouldNotify) {
        const userNotifRef = collection(db, "user_profiles", userId, "notifications");
        
        // Prepare the clinical voice-friendly message
        const voiceMessage = data.message.includes(propertyName) 
          ? data.message 
          : `${data.title} at ${propertyName}: ${data.message}`;

        addDocumentNonBlocking(userNotifRef, {
          ...data,
          message: voiceMessage,
          status: "unread",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    console.warn("Notification broadcast failed:", error);
  }
}
