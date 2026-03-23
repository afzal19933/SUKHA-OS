import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { getReceptionistResponse } from '@/ai/flows/whatsapp-receptionist-flow';
import { getOpsAssistantResponse } from '@/ai/flows/whatsapp-ops-assistant-flow';
import { sendRealWhatsAppMessage } from '@/services/whatsapp-api-client';
import { getPropertyContext } from '@/services/property-context-service';

const VERIFY_TOKEN = 'sukha_os_verify';

// ─────────────────────────────────────────────
// GET → Meta Verification
// ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Normalize phone: strip leading + so both formats match */
function normalizePhone(phone: string) {
  return phone.replace(/^\+/, '');
}

/** Search for a contact across ALL properties */
async function findContactAcrossProperties(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  const withPlus = `+${normalized}`;

  const propertiesSnap = await db.collection('hotel_properties').get();
  const results: Array<{ property: any; propertyId: string; contact: any }> = [];

  for (const propDoc of propertiesSnap.docs) {
    const propertyId = propDoc.id;
    const property = propDoc.data();

    // Try without + first
    let contactSnap = await db
      .collection('hotel_properties')
      .doc(propertyId)
      .collection('whatsapp_contacts')
      .where('phoneNumber', '==', normalized)
      .limit(1)
      .get();

    // Try with + if not found
    if (contactSnap.empty) {
      contactSnap = await db
        .collection('hotel_properties')
        .doc(propertyId)
        .collection('whatsapp_contacts')
        .where('phoneNumber', '==', withPlus)
        .limit(1)
        .get();
    }

    if (!contactSnap.empty) {
      results.push({
        property,
        propertyId,
        contact: contactSnap.docs[0].data(),
      });
    }
  }

  return results;
}

/** Get or create conversation session for a phone number */
async function getSession(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  const sessionRef = db.collection('whatsapp_sessions').doc(normalized);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    return { selectedPropertyId: null, awaitingPropertySelection: false };
  }
  return sessionSnap.data() as {
    selectedPropertyId: string | null;
    awaitingPropertySelection: boolean;
  };
}

/** Save conversation session */
async function saveSession(phoneNumber: string, data: {
  selectedPropertyId: string | null;
  awaitingPropertySelection: boolean;
}) {
  const normalized = normalizePhone(phoneNumber);
  await db.collection('whatsapp_sessions').doc(normalized).set({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

/** Log message to a property's whatsapp_logs */
function logMessage(propertyId: string, data: object) {
  db.collection('hotel_properties')
    .doc(propertyId)
    .collection('whatsapp_logs')
    .add({ ...data, createdAt: new Date().toISOString() })
    .catch(err => console.error('Log error:', err));
}

// ─────────────────────────────────────────────
// POST → Handle Incoming Messages
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const entry = body.entry?.[0];
    const value = entry?.changes?.[0]?.value;
    const messageObj = value?.messages?.[0];

    if (!messageObj) return NextResponse.json({ status: 'ignored' });

    const from = messageObj.from;
    const text = messageObj.text?.body?.trim();
    const phoneNumberId = value.metadata.phone_number_id;
    const guestName = value.contacts?.[0]?.profile?.name;

    // Ignore non-text messages
    if (!text) {
      console.log('⚠️ Non-text message, ignoring.');
      return NextResponse.json({ status: 'ignored' });
    }

    console.log(`📩 From: ${from} | Text: ${text}`);

    // ── Find the WhatsApp number's own property (for guests) ──
    const ownPropertySnap = await db.collection('hotel_properties')
      .where('whatsappPhoneNumberId', '==', phoneNumberId)
      .limit(1)
      .get();

    const ownProperty = ownPropertySnap.empty ? null : ownPropertySnap.docs[0].data();
    const ownPropertyId = ownPropertySnap.empty ? null : ownPropertySnap.docs[0].id;

    // ── Find contact across ALL properties ──
    const contactMatches = await findContactAcrossProperties(from);
    console.log(`🔍 Contact matches found: ${contactMatches.length}`);

    // Helper to send reply
    const sendReply = async (replyText: string, targetPropertyId?: string) => {
      const targetProp = targetPropertyId
        ? (await db.collection('hotel_properties').doc(targetPropertyId).get()).data()
        : ownProperty;

      if (!targetProp?.whatsappAccessToken) {
        console.warn('⚠️ No access token found');
        return;
      }

      await sendRealWhatsAppMessage(
        targetProp.whatsappPhoneNumberId || phoneNumberId,
        targetProp.whatsappAccessToken,
        from,
        replyText
      );
      console.log('✅ Reply sent!');
    };

    // ════════════════════════════════════════
    // CASE 1: MANAGEMENT (found in contacts)
    // ════════════════════════════════════════
    if (contactMatches.length > 0) {
      const isManagement = contactMatches.some(m =>
        ['owner', 'admin', 'manager'].includes(m.contact.role?.toLowerCase())
      );

      if (isManagement) {

        // ── ADMIN in multiple properties → property selection flow ──
        if (contactMatches.length > 1) {
          const session = await getSession(from);

          // Check if user is selecting a property
          const propertyOptions = contactMatches.map((m, i) => ({
            index: i + 1,
            propertyId: m.propertyId,
            name: m.property.name,
          }));

          // If awaiting selection and user sent a number
          if (session.awaitingPropertySelection) {
            const choice = parseInt(text);
            const selected = propertyOptions.find(p => p.index === choice);

            if (selected) {
              // Save selection
              await saveSession(from, {
                selectedPropertyId: selected.propertyId,
                awaitingPropertySelection: false,
              });

              console.log(`✅ Admin selected: ${selected.name}`);

              // Now fetch data for selected property
              const dataContext = await getPropertyContext(selected.propertyId);
              const replyText = await getOpsAssistantResponse({
                propertyName: selected.name,
                dataContext,
                query: text,
              });

              await sendReply(replyText, selected.propertyId);
              logMessage(selected.propertyId, {
                phoneNumber: from, role: 'Admin',
                direction: 'outgoing', message: replyText, status: 'sent',
              });

              return NextResponse.json({ status: 'success' });
            } else {
              // Invalid choice
              const optionsList = propertyOptions.map(p => `*${p.index}.* ${p.name}`).join('\n');
              const replyText = `Please reply with a number:\n\n${optionsList}`;
              await sendReply(replyText);
              return NextResponse.json({ status: 'success' });
            }
          }

          // Check if there's already a selected property in session
          if (session.selectedPropertyId) {
            const savedMatch = contactMatches.find(m => m.propertyId === session.selectedPropertyId);

            if (savedMatch) {
              // Use saved property — but allow switching with "switch" or "change"
              if (['switch', 'change', 'change property', 'switch property'].includes(text.toLowerCase())) {
                await saveSession(from, { selectedPropertyId: null, awaitingPropertySelection: true });
                const optionsList = propertyOptions.map(p => `*${p.index}.* ${p.name}`).join('\n');
                const replyText = `Which property would you like?\n\n${optionsList}\n\nReply with the number.`;
                await sendReply(replyText);
                return NextResponse.json({ status: 'success' });
              }

              console.log(`🏨 Using saved property: ${savedMatch.property.name}`);
              const dataContext = await getPropertyContext(savedMatch.propertyId);
              const replyText = await getOpsAssistantResponse({
                propertyName: savedMatch.property.name,
                dataContext,
                query: text,
              });

              await sendReply(replyText, savedMatch.propertyId);
              logMessage(savedMatch.propertyId, {
                phoneNumber: from, role: 'Admin',
                direction: 'outgoing', message: replyText, status: 'sent',
              });

              return NextResponse.json({ status: 'success' });
            }
          }

          // No saved property yet → ask which one
          await saveSession(from, { selectedPropertyId: null, awaitingPropertySelection: true });
          const optionsList = propertyOptions.map(p => `*${p.index}.* ${p.name}`).join('\n');
          const replyText = `Hello! You have access to multiple properties. Which one would you like?\n\n${optionsList}\n\nReply with the number.`;
          await sendReply(replyText);

          logMessage(ownPropertyId || contactMatches[0].propertyId, {
            phoneNumber: from, role: 'Admin',
            direction: 'outgoing', message: replyText, status: 'sent',
          });

          return NextResponse.json({ status: 'success' });
        }

        // ── Single property owner/manager ──
        const match = contactMatches[0];
        console.log(`🏨 Single property: ${match.property.name} | Role: ${match.contact.role}`);

        logMessage(match.propertyId, {
          phoneNumber: from, role: match.contact.role,
          direction: 'incoming', message: text, status: 'received',
        });

        const dataContext = await getPropertyContext(match.propertyId);
        const replyText = await getOpsAssistantResponse({
          propertyName: match.property.name,
          dataContext,
          query: text,
        });

        await sendReply(replyText, match.propertyId);

        logMessage(match.propertyId, {
          phoneNumber: from, role: 'AI Assistant',
          direction: 'outgoing', message: replyText,
          status: 'sent', isAiQuery: true, intent: 'OperationalReport',
        });

        return NextResponse.json({ status: 'success' });
      }
    }

    // ════════════════════════════════════════
    // CASE 2: GUEST (not found in any contacts)
    // ════════════════════════════════════════
    console.log('👤 Guest detected — Smart routing...');

    if (!ownPropertyId) {
      console.warn('⚠️ No property found for this WhatsApp number');
      return NextResponse.json({ status: 'no_property' });
    }

    logMessage(ownPropertyId, {
      phoneNumber: from, role: 'Guest',
      direction: 'incoming', message: text, status: 'received',
    });

    // ── Fetch context from BOTH properties for smart guest replies ──
    const allPropertiesSnap = await db.collection('hotel_properties').get();
    let retreatsContext: any = null;
    let paradiseContext: any = null;
    let retreatsName = 'Sukha Retreats';
    let paradiseName = 'Sukha Paradise Apartments';

    for (const propDoc of allPropertiesSnap.docs) {
      const name = propDoc.data().name?.toLowerCase() || '';
      if (name.includes('retreat')) {
        retreatsContext = await getPropertyContext(propDoc.id);
        retreatsName = propDoc.data().name;
      } else if (name.includes('paradise') || name.includes('apartment')) {
        paradiseContext = await getPropertyContext(propDoc.id);
        paradiseName = propDoc.data().name;
      }
    }

    // ── Smart guest receptionist with combined context ──
    const replyText = await getReceptionistResponse({
      message: text,
      guestName,
      retreatsContext,
      paradiseContext,
      retreatsName,
      paradiseName,
    });

    await sendReply(replyText, ownPropertyId);

    logMessage(ownPropertyId, {
      phoneNumber: from, role: 'Guest',
      direction: 'outgoing', message: replyText,
      status: 'sent', isAiQuery: true, intent: 'GuestEnquiry',
    });

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('❌ CRITICAL WEBHOOK ERROR:', error);
    return NextResponse.json({ error: 'Internal processing error' }, { status: 200 });
  }
}