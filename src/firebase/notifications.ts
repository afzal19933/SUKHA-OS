'use client';

import { collection, Firestore } from "firebase/firestore";
import { addDocumentNonBlocking } from "./non-blocking-updates";

/**
 * Utility to send a notification to a specific user.
 */
export function sendNotification(
  db: Firestore, 
  userId: string, 
  entityId: string, 
  data: { title: string; message: string; type: 'alert' | 'info' | 'task_assigned' | 'approval_request' }
) {
  if (!userId || !entityId) return;

  const notificationsRef = collection(db, "user_profiles", userId, "notifications");
  addDocumentNonBlocking(notificationsRef, {
    ...data,
    entityId,
    userId,
    status: "unread",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
