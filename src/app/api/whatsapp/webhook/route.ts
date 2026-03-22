import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/init';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { getReceptionistResponse } from '@/ai/flows/whatsapp-receptionist-flow';
import { getOpsAssistantResponse } from '@/ai/flows/whatsapp-ops-assistant-flow';
import { sendRealWhatsAppMessage } from '@/services/whatsapp-api-client';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { getPropertyContext } from '@/services/property-context-service';

/**
 * WhatsApp Webhook Route Handler
 */

const VERIFY_TOKEN = 'sukha_os_verify';

// ✅ GET → Verification
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Verification failed', { status: 403 });
}

// ✅ POST → Receive messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = body.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj) return NextResponse.json({ status: 'ignored' });

    const from = messageObj.from;
    const text = messageObj.text?.body;
    const phoneNumberId = value.metadata.phone_number_id;

    const { firestore } = initializeFirebase();

    // 1. Identify Property by Phone Number ID
    const propertiesRef = collection(firestore, "hotel_properties");
    const q = query(propertiesRef, where("whatsappPhoneNumberId", "==", phoneNumberId), limit(1));
    const propSnap = await getDocs(q);

    if (propSnap.empty) {
      console.warn(`[Webhook] Unrecognized phone number ID: ${phoneNumberId}`);
      return NextResponse.json({ status: 'property_not_found' });
    }

    const property = propSnap.docs[0].data();
    const propertyId = propSnap.docs[0].id;

    // 2. Identify Sender Role (Guest vs Management)
    const contactsRef = collection(firestore, "hotel_properties", propertyId, "whatsapp_contacts");
    const contactQ = query(contactsRef, where("phoneNumber", "==", from), limit(1));
    const contactSnap = await getDocs(contactQ);
    const contact = contactSnap.empty ? null : contactSnap.docs[0].data();

    // 3. Log Incoming Message
    addDocumentNonBlocking(collection(firestore, "hotel_properties", propertyId, "whatsapp_logs"), {
      entityId: propertyId,
      phoneNumber: from,
      role: contact?.role || 'Guest',
      direction: 'incoming',
      message: text,
      status: 'received',
      createdAt: new Date().toISOString()
    });

    // 4. Generate AI Response based on Role
    let replyText = "";
    let isAiQuery = false;
    let intent = "GeneralQuery";

    if (contact && ["Owner", "Admin", "Manager"].includes(contact.role)) {
      // Management Request -> Use Ops Assistant with REAL DATA
      const dataContext = await getPropertyContext(firestore, propertyId);
      replyText = await getOpsAssistantResponse({
        propertyName: property.name,
        dataContext,
        query: text
      });
      isAiQuery = true;
      intent = "OperationalReport";
    } else {
      // Guest Request -> Use Premium Receptionist
      replyText = await getReceptionistResponse({ 
        message: text,
        guestName: value.contacts?.[0]?.profile?.name
      });
    }

    // 5. Send Response via WhatsApp Cloud API
    if (replyText && property.whatsappAccessToken) {
      await sendRealWhatsAppMessage(
        property.whatsappPhoneNumberId,
        property.whatsappAccessToken,
        from,
        replyText
      );

      // 6. Log Outgoing Reply
      addDocumentNonBlocking(collection(firestore, "hotel_properties", propertyId, "whatsapp_logs"), {
        entityId: propertyId,
        phoneNumber: from,
        role: 'AI Receptionist',
        direction: 'outgoing',
        message: replyText,
        status: 'sent',
        isAiQuery,
        intent,
        response: replyText,
        createdAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error("❌ WEBHOOK ERROR:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 200 });
  }
}
