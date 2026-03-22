import { NextRequest, NextResponse } from 'next/server';
import { getReceptionistResponse } from '@/ai/flows/whatsapp-receptionist-flow';
import { sendRealWhatsAppMessage } from '@/services/whatsapp-api-client';
import { initializeFirebase } from '@/firebase/init';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';

/**
 * WhatsApp Webhook Route Handler
 * Supports Meta Verification (GET) and Message Events (POST)
 * Dynamically resolves property context and AI responses.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verify against the token set in Meta Dashboard (Fallback to 'sukha_os_verify' if not in env)
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'sukha_os_verify';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WEBHOOK_VERIFIED');
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  
  return new Response('Verification failed', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firestore } = initializeFirebase();

    // 1. Identify the message event
    if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
      const messageObj = body.entry[0].changes[0].value.messages[0];
      const metadata = body.entry[0].changes[0].value.metadata;
      const from = messageObj.from; // Sender phone number
      const text = messageObj.text?.body; // Message text
      const phone_number_id = metadata.phone_number_id;

      if (!text || typeof text !== 'string') {
        return NextResponse.json({ status: 'ignored' });
      }

      // 2. Resolve Property Context from Firestore using the phone_number_id
      const propsRef = collection(firestore, "hotel_properties");
      const q = query(propsRef, where("whatsappPhoneNumberId", "==", phone_number_id), limit(1));
      const propSnap = await getDocs(q);

      if (propSnap.empty) {
        console.error(`Webhook received for unregistered phone_number_id: ${phone_number_id}`);
        return NextResponse.json({ status: 'property_not_found' });
      }

      const property = propSnap.docs[0].data();
      const entityId = propSnap.docs[0].id;
      const accessToken = property.whatsappAccessToken;

      // 3. Log Incoming Message to the property's audit trail
      await addDoc(collection(firestore, "hotel_properties", entityId, "whatsapp_logs"), {
        entityId,
        phoneNumber: from,
        role: 'Guest',
        direction: 'incoming',
        message: text,
        status: 'received',
        createdAt: new Date().toISOString()
      });

      // 4. Generate AI Response
      // Logic: If it's a basic greeting, be friendly. Otherwise, use Gemini.
      const lowerText = text.toLowerCase().trim();
      const greetings = ['hi', 'hello', 'hey', 'namaste'];
      
      let replyText = "";
      if (greetings.some(g => lowerText.startsWith(g))) {
        replyText = `Welcome to ${property.name} 🌿 How can I assist you today?`;
      } else {
        replyText = await getReceptionistResponse({ message: text });
      }

      // 5. Send Outbound Reply via WhatsApp API
      await sendRealWhatsAppMessage(phone_number_id, accessToken, from, replyText);

      // 6. Log Outgoing AI Response
      await addDoc(collection(firestore, "hotel_properties", entityId, "whatsapp_logs"), {
        entityId,
        phoneNumber: from,
        role: 'Assistant',
        direction: 'outgoing',
        message: replyText,
        status: 'sent',
        isAiQuery: true,
        intent: 'GuestSupport',
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({ status: 'success' });
    }

    return NextResponse.json({ status: 'not_a_message' });
  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
