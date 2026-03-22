/**
 * @fileOverview Real WhatsApp Cloud API Client.
 * Handles outbound communication with Meta Graph API.
 */

const WHATSAPP_VERSION = 'v20.0';

/**
 * Sends a message via Meta Cloud API using property-specific credentials.
 * Returns the Meta API response or throws a descriptive error.
 */
export async function sendRealWhatsAppMessage(
  phoneNumberId: string, 
  accessToken: string, 
  to: string, 
  text: string
) {
  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp API credentials (Phone ID or Token) missing for this property.");
  }

  const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to,
        type: "text",
        text: {
          preview_url: false,
          body: text
        }
      }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      const errorMessage = result.error?.message || "Unknown Meta API Error";
      const errorCode = result.error?.code || "No Code";
      throw new Error(`Meta API Error [${errorCode}]: ${errorMessage}`);
    }

    return result;
  } catch (error: any) {
    console.error("❌ WhatsApp Outbound Failure:", error.message);
    throw error;
  }
}
