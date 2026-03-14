
'use client';

import { collection, addDoc, Firestore, query, where, getDocs, limit } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';

/**
 * WhatsApp Gateway Service for SUKHA OS
 * Handles simulation of WhatsApp Cloud API interactions and logging.
 */

export type WhatsAppTriggerEvent = 
  | 'booking_created' 
  | 'guest_checkin' 
  | 'guest_checkout' 
  | 'payment_pending' 
  | 'maintenance_issue' 
  | 'housekeeping_delay';

export interface WhatsAppMessagePayload {
  entityId: string;
  phoneNumber: string;
  guestName?: string;
  templateName?: string;
  variables?: Record<string, string>;
  messageBody?: string;
  role?: string;
}

/**
 * Sends a WhatsApp message (Simulated via logs for this prototype)
 */
export async function sendWhatsAppMessage(db: Firestore, payload: WhatsAppMessagePayload) {
  const { entityId, phoneNumber, messageBody, guestName, role = 'Guest' } = payload;

  if (!entityId || !phoneNumber) return;

  // Log the outgoing message
  addDocumentNonBlocking(collection(db, "hotel_properties", entityId, "whatsapp_logs"), {
    entityId,
    phoneNumber,
    role,
    direction: 'outgoing',
    message: messageBody || `Template: ${payload.templateName}`,
    status: 'sent',
    createdAt: new Date().toISOString()
  });

  // In a real implementation, this would call the Meta Cloud API
  console.log(`[WhatsApp API] Sending to ${phoneNumber}: ${messageBody}`);
}

/**
 * Trigger an automated message based on a system event
 */
export async function triggerWhatsAppAutomation(db: Firestore, event: WhatsAppTriggerEvent, data: any) {
  const { entityId, guestName, phoneNumber, roomNumber, checkIn, checkOut, rate } = data;

  if (!entityId || !phoneNumber) return;

  let message = "";

  switch (event) {
    case 'booking_created':
      message = `Welcome to Sukha Retreats.\n\nYour booking has been confirmed.\n\nGuest Name: ${guestName || 'Valued Guest'}\nRoom: ${roomNumber || 'TBD'}\nCheck-in: ${checkIn || 'N/A'}\nCheck-out: ${checkOut || 'N/A'}\n\nIf you need assistance, reply to this message.`;
      break;
    case 'guest_checkin':
      message = `Welcome to Sukha Retreats ${guestName || ''}.\n\nWe hope you have a pleasant stay.\n\nFacilities available:\n• Swimming Pool\n• Gym\n• Garden\n• Prayer Room\n\nFor any help please message us here.`;
      break;
    case 'guest_checkout':
      message = `Thank you for staying with Sukha Retreats.\n\nWe hope you had a pleasant stay.\n\nPlease share your feedback here.`;
      break;
    case 'maintenance_issue':
      message = `Alert: Room ${roomNumber || 'N/A'} reported ${data.issue || 'an issue'}.`;
      break;
  }

  if (message) {
    await sendWhatsAppMessage(db, {
      entityId,
      phoneNumber,
      guestName,
      messageBody: message,
      role: event.includes('issue') ? 'Manager' : 'Guest'
    });
  }
}

/**
 * Sends a management alert
 */
export async function sendManagementAlert(db: Firestore, entityId: string, alertData: any) {
  if (!entityId) return;

  // Find management contacts
  const contactsRef = collection(db, "hotel_properties", entityId, "whatsapp_contacts");
  const q = query(contactsRef, where("role", "in", ["Admin", "Owner", "Manager"]));
  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const contact = doc.data();
    sendWhatsAppMessage(db, {
      entityId,
      phoneNumber: contact.phoneNumber,
      messageBody: `[ALERT] ${alertData.title}: ${alertData.message}`,
      role: contact.role
    });
  });
}
