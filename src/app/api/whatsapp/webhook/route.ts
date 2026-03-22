import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin'; // ✅ Firebase Admin SDK
import { collection, query, where, getDocs, limit } from 'firebase-admin/firestore';
import { getReceptionistResponse } from '@/ai/flows/whatsapp-receptionist-flow';
import { getOpsAssistantResponse } from '@/ai/flows/whatsapp-ops-assistant-flow';
import { sendRealWhatsAppMessage } from '@/services/whatsapp-api-client';
import { getPropertyContext } from '@/services/property-context-service';

/**
 * WhatsApp Webhook Route Handler
 * Updated to use Firebase Admin SDK (server-safe)
 */

const VERIFY_TOKEN = 'sukha_os_verify';

// ✅ GET → Meta Verification Handshake
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

// ✅ POST → Receive and Auto-Reply to Messages
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = body.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    const messageObj = value?.messages?.[0];

    // Ignore non-message events (like delivery statuses)
    if (!messageObj) return NextResponse.json({ status: 'ignored' });

    const from = messageObj.from;
    const text = messageObj.text?.body;
    const phoneNumberId = value.metadata.phone_number_id;

    console.log(`📩 Message from: ${from} | PhoneNumberId: ${phoneNumberId} | Text: ${text}`);

    // 1. Identify Property by Phone Number ID
    const propertiesRef = db.collection('hotel_properties');
    const propSnap = await propertiesRef
      .where('whatsappPhoneNumberId', '==', phoneNumberId)
      .limit(1)
      .get();

    if (propSnap.empty) {
      console.warn(`[Webhook] ❌ Property not found for Phone ID: ${phoneNumberId}`);
      return NextResponse.json({ status: 'property_not_found' });
    }

    const property = propSnap.docs[0].data();
    const propertyId = propSnap.docs[0].id;
    console.log(`🏨 Property found: ${property.name} (${propertyId})`);

    // 2. Identify Sender Role (Guest vs Management)
    const contactSnap = await db
      .collection('hotel_properties')
      .doc(propertyId)
      .collection('whatsapp_contacts')
      .where('phoneNumber', '==', from)
      .limit(1)
      .get();

    const contact = contactSnap.empty ? null : contactSnap.docs[0].data();
    const role = contact?.role || 'Guest';
    console.log(`👤 Sender role: ${role}`);

    // 3. Log Incoming Message
    db.collection('hotel_properties')
      .doc(propertyId)
      .collection('whatsapp_logs')
      .add({
        entityId: propertyId,
        phoneNumber: from,
        role,
        direction: 'incoming',
        message: text,
        status: 'received',
        createdAt: new Date().toISOString()
      })
      .catch(err => console.error('Log error (incoming):', err));

    // 4. Generate AI Response
    let replyText = '';
    let isAiQuery = false;
    let intent = 'GeneralQuery';

    if (contact && ['Owner', 'Admin', 'Manager'].includes(contact.role)) {
      // Management → Operations Assistant
      console.log('🧑‍💼 Routing to Ops Assistant...');
      const dataContext = await getPropertyContext(db, propertyId);
      replyText = await getOpsAssistantResponse({
        propertyName: property.name,
        dataContext,
        query: text
      });
      isAiQuery = true;
      intent = 'OperationalReport';
    } else {
      // Guest → AI Receptionist
      console.log('👤 Routing to Receptionist AI...');
      replyText = await getReceptionistResponse({
        message: text,
        guestName: value.contacts?.[0]?.profile?.name
      });
    }

    console.log(`🤖 AI Reply generated: ${replyText?.slice(0, 80)}...`);

    // 5. Send WhatsApp Reply
    if (replyText && property.whatsappAccessToken) {
      try {
        console.log('📡 Sending WhatsApp message...');
        await sendRealWhatsAppMessage(
          property.whatsappPhoneNumberId,
          property.whatsappAccessToken,
          from,
          replyText
        );
        console.log('✅ WhatsApp message sent successfully!');

        // Log Success
        db.collection('hotel_properties')
          .doc(propertyId)
          .collection('whatsapp_logs')
          .add({
            entityId: propertyId,
            phoneNumber: from,
            role: 'AI Assistant',
            direction: 'outgoing',
            message: replyText,
            status: 'sent',
            isAiQuery,
            intent,
            createdAt: new Date().toISOString()
          })
          .catch(err => console.error('Log error (outgoing success):', err));

      } catch (apiError: any) {
        console.error('❌ WhatsApp send failed:', apiError.message);

        // Log Failure
        db.collection('hotel_properties')
          .doc(propertyId)
          .collection('whatsapp_logs')
          .add({
            entityId: propertyId,
            phoneNumber: from,
            role: 'AI Assistant',
            direction: 'outgoing',
            message: replyText,
            status: 'failed',
            isAiQuery,
            intent,
            error: apiError.message,
            createdAt: new Date().toISOString()
          })
          .catch(err => console.error('Log error (outgoing fail):', err));
      }
    } else {
      console.warn('⚠️ No reply text or missing whatsappAccessToken in property config');
    }

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('❌ CRITICAL WEBHOOK ERROR:', error);
    return NextResponse.json({ error: 'Internal processing error' }, { status: 200 });
  }
}