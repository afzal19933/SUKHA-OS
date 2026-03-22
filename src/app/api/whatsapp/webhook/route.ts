import { NextRequest, NextResponse } from 'next/server';
import { getReceptionistResponse } from '@/ai/flows/whatsapp-receptionist-flow';
import { sendRealWhatsAppMessage } from '@/services/whatsapp-api-client';
import { initializeFirebase } from '@/firebase/init';
import { collection, query, where, getDocs, limit, addDoc } from 'firebase/firestore';

/**
 * WhatsApp Webhook Route Handler for SUKHA OS
 * 
 * GET: Handles Meta Cloud API Verification (Handshake)
 * POST: Processes incoming messages, logs traffic, and triggers AI responses
 */

const VERIFY_TOKEN = 'sukha_os_verify';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('--- WHATSAPP WEBHOOK VERIFICATION ATTEMPT ---');
  console.log('Mode:', mode);
  console.log('Token:', token);

  // 1. Validate Verification Request
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WEBHOOK_VERIFIED: Verification successful.');
    
    // 2. Return the challenge as PLAIN TEXT (Critical for Meta)
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  
  console.error('WEBHOOK_VERIFICATION_FAILED: Tokens do not match.');
  return new Response('Verification failed', { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firestore } = initializeFirebase();

    // 1. Fast Logging for Debugging
    console.log('--- INCOMING WHATSAPP PAYLOAD ---');
    console.log(JSON.stringify(body, null, 2));

    // 2. Identify the specific message event
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messageObj = value?.messages?.[0];
    const metadata = value?.metadata;

    if (!messageObj) {
      return NextResponse.json({ status: 'ignored', reason: 'No message found in payload' });
    }

    const from = messageObj.from; // Sender phone number
    const text = messageObj.text?.body; // Message content
    const phone_number_id = metadata?.phone_number_id;

    if (!text || !phone_number_id) {
      return NextResponse.json({ status: 'ignored', reason: 'Missing text or phone_number_id' });
    }

    console.log(`Received message from ${from}: "${text}"`);

    // 3. Resolve Property Context from Firestore
    // We match the incoming phone_number_id to the property settings
    const propsRef = collection(firestore, "hotel_properties");
    const q = query(propsRef, where("whatsappPhoneNumberId", "==", phone_number_id), limit(1));
    const propSnap = await getDocs(q);

    if (propSnap.empty) {
      console.error(`ERROR: Received message for UNREGISTERED phone_number_id: ${phone_number_id}`);
      return NextResponse.json({ status: 'property_not_found' });
    }

    const property = propSnap.docs[0].data();
    const entityId = propSnap.docs[0].id;
    const accessToken = property.whatsappAccessToken;

    // 4. Log Incoming Message to Property Audit Trail
    await addDoc(collection(firestore, "hotel_properties", entityId, "whatsapp_logs"), {
      entityId,
      phoneNumber: from,
      role: 'Guest',
      direction: 'incoming',
      message: text,
      status: 'received',
      createdAt: new Date().toISOString()
    });

    // 5. Generate AI Receptionist Response
    // We check for simple greetings first, then fall back to Gemini
    const lowerText = text.toLowerCase().trim();
    const greetings = ['hi', 'hello', 'hey', 'namaste', 'morning', 'evening'];
    
    let replyText = "";
    if (greetings.some(g => lowerText.startsWith(g))) {
      replyText = `Welcome to ${property.name} 🌿 How can I assist you today?`;
    } else {
      // Use specialized Genkit flow for natural language processing
      replyText = await getReceptionistResponse({ 
        message: text,
        guestName: value?.contacts?.[0]?.profile?.name
      });
    }

    // 6. Dispatch Outbound Reply via Meta API
    if (accessToken) {
      await sendRealWhatsAppMessage(phone_number_id, accessToken, from, replyText);

      // 7. Log Outgoing AI Response
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
    } else {
      console.warn(`WARNING: Property ${property.name} has no WhatsApp Access Token configured.`);
    }

    // Always respond with 200 OK promptly to Meta
    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error("WEBHOOK_POST_ERROR:", error);
    // Even on error, we return 200 to prevent Meta from retrying indefinitely 
    // and potentially flooding the system if the error is data-specific.
    return NextResponse.json({ error: "Internal processing error" }, { status: 200 });
  }
}
