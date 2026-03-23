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

function normalizePhone(phone: string) {
  return phone.replace(/^\+/, '');
}

async function findContactAcrossProperties(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  const withPlus = `+${normalized}`;

  const propertiesSnap = await db.collection('hotel_properties').get();
  const results: Array<{ property: any; propertyId: string; contact: any }> = [];

  for (const propDoc of propertiesSnap.docs) {
    const propertyId = propDoc.id;
    const property = propDoc.data();

    let contactSnap = await db
      .collection('hotel_properties')
      .doc(propertyId)
      .collection('whatsapp_contacts')
      .where('phoneNumber', '==', normalized)
      .limit(1)
      .get();

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

async function getSession(phoneNumber: string) {
  const normalized = normalizePhone(phoneNumber);
  const sessionRef = db.collection('whatsapp_sessions').doc(normalized);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    return { selectedPropertyId: null, awaitingPropertySelection: false, pendingQuery: null };
  }
  return sessionSnap.data();
}

async function saveSession(phoneNumber: string, data: any) {
  const normalized = normalizePhone(phoneNumber);
  await db.collection('whatsapp_sessions').doc(normalized).set({
    ...data,
    updatedAt: new Date().toISOString(),
  });
}

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

    if (!text) {
      console.log('⚠️ Non-text message, ignoring.');
      return NextResponse.json({ status: 'ignored' });
    }

    console.log(`📩 From: ${from} | Text: ${text}`);

    const ownPropertySnap = await db.collection('hotel_properties')
      .where('whatsappPhoneNumberId', '==', phoneNumberId)
      .limit(1)
      .get();

    const ownProperty = ownPropertySnap.empty ? null : ownPropertySnap.docs[0].data();
    const ownPropertyId = ownPropertySnap.empty ? null : ownPropertySnap.docs[0].id;

    const contactMatches = await findContactAcrossProperties(from);
    console.log(`🔍 Contact matches found: ${contactMatches.length}`);

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
    // CASE 1: MANAGEMENT
    // ════════════════════════════════════════
    if (contactMatches.length > 0) {
      const isManagement = contactMatches.some(m =>
        ['owner', 'admin', 'manager'].includes(m.contact.role?.toLowerCase())
      );

      if (isManagement) {

        // 🔥 UPDATED MULTI-PROPERTY LOGIC
        if (contactMatches.length > 1) {
          const session = await getSession(from);

          const propertyOptions = contactMatches.map((m, i) => ({
            index: i + 1,
            propertyId: m.propertyId,
            name: m.property.name,
          }));

          const greetings = ['hi', 'hello', 'hey', 'start'];

          // STEP 1: Greeting
          if (greetings.includes(text.toLowerCase())) {
            await saveSession(from, {
              selectedPropertyId: null,
              awaitingPropertySelection: false,
              pendingQuery: null,
            });

            await sendReply("Hello! 👋\nHow can I assist you today?");
            return NextResponse.json({ status: 'success' });
          }

          // STEP 2: Auto detect property
          const lower = text.toLowerCase();
          const detected = contactMatches.find(m => {
            const name = m.property.name.toLowerCase();
            return (
              lower.includes(name) ||
              (lower.includes('retreat') && name.includes('retreat')) ||
              (lower.includes('paradise') && name.includes('paradise'))
            );
          });

          if (detected) {
            const dataContext = await getPropertyContext(detected.propertyId);

            const replyText = await getOpsAssistantResponse({
              propertyName: detected.property.name,
              dataContext,
              query: text,
            });

            await sendReply(replyText, detected.propertyId);

            logMessage(detected.propertyId, {
              phoneNumber: from,
              role: 'Admin',
              direction: 'outgoing',
              message: replyText,
              status: 'sent',
            });

            return NextResponse.json({ status: 'success' });
          }

          // STEP 3: Handle selection
          if (session.awaitingPropertySelection) {
            const choice = parseInt(text);
            const selected = propertyOptions.find(p => p.index === choice);

            if (selected) {
              const query = session.pendingQuery;

              await saveSession(from, {
                selectedPropertyId: selected.propertyId,
                awaitingPropertySelection: false,
                pendingQuery: null,
              });

              const dataContext = await getPropertyContext(selected.propertyId);

              const replyText = await getOpsAssistantResponse({
                propertyName: selected.name,
                dataContext,
                query,
              });

              await sendReply(replyText, selected.propertyId);

              logMessage(selected.propertyId, {
                phoneNumber: from,
                role: 'Admin',
                direction: 'outgoing',
                message: replyText,
                status: 'sent',
              });

              return NextResponse.json({ status: 'success' });
            }

            const optionsList = propertyOptions.map(p => `*${p.index}.* ${p.name}`).join('\n');
            await sendReply(`Please reply with a valid number:\n\n${optionsList}`);
            return NextResponse.json({ status: 'success' });
          }

          // STEP 4: Ask property
          await saveSession(from, {
            selectedPropertyId: null,
            awaitingPropertySelection: true,
            pendingQuery: text,
          });

          const optionsList = propertyOptions.map(p => `*${p.index}.* ${p.name}`).join('\n');

          const replyText = `You have access to multiple properties.

Which one would you like?

${optionsList}

Reply with the number.`;

          await sendReply(replyText);

          logMessage(ownPropertyId || contactMatches[0].propertyId, {
            phoneNumber: from,
            role: 'Admin',
            direction: 'outgoing',
            message: replyText,
            status: 'sent',
          });

          return NextResponse.json({ status: 'success' });
        }

        // ── Single property ──
        const match = contactMatches[0];

        logMessage(match.propertyId, {
          phoneNumber: from,
          role: match.contact.role,
          direction: 'incoming',
          message: text,
          status: 'received',
        });

        const dataContext = await getPropertyContext(match.propertyId);
        const replyText = await getOpsAssistantResponse({
          propertyName: match.property.name,
          dataContext,
          query: text,
        });

        await sendReply(replyText, match.propertyId);

        logMessage(match.propertyId, {
          phoneNumber: from,
          role: 'AI Assistant',
          direction: 'outgoing',
          message: replyText,
          status: 'sent',
        });

        return NextResponse.json({ status: 'success' });
      }
    }

    // ════════════════════════════════════════
    // GUEST FLOW (UNCHANGED)
    // ════════════════════════════════════════

    const replyText = await getReceptionistResponse({
      message: text,
      guestName,
    });

    await sendReply(replyText, ownPropertyId);

    return NextResponse.json({ status: 'success' });

  } catch (error: any) {
    console.error('❌ CRITICAL WEBHOOK ERROR:', error);
    return NextResponse.json({ error: 'Internal processing error' }, { status: 200 });
  }
}