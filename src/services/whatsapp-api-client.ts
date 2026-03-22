/**
 * @fileOverview Real WhatsApp Cloud API Client.
 * Handles outbound communication with Meta Graph API.
 */

const WHATSAPP_VERSION = 'v20.0';

/**
 * Sends a message via Meta Cloud API using property-specific credentials.
 * Includes FULL DEBUG LOGGING for troubleshooting.
 */
export async function sendRealWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
) {
  try {
    // 🚨 VALIDATION
    if (!phoneNumberId || !accessToken) {
      throw new Error(
        "WhatsApp API credentials (Phone Number ID or Access Token) missing."
      );
    }

    // 🔧 NORMALIZE PHONE NUMBER (remove + if present)
    const formattedTo = to.replace("+", "");

    const url = `https://graph.facebook.com/${WHATSAPP_VERSION}/${phoneNumberId}/messages`;

    // 🔥 DEBUG: INPUT DATA
    console.log("📤 WHATSAPP SEND REQUEST:");
    console.log({
      phoneNumberId,
      to: formattedTo,
      message: text,
      tokenPreview: accessToken?.slice(0, 25) + "...",
      url,
    });

    // 🚀 API CALL
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedTo,
        type: "text",
        text: {
          preview_url: false,
          body: text,
        },
      }),
    });

    // 📡 PARSE RESPONSE
    const result = await response.json();

    // 🔥 DEBUG: META RESPONSE
    console.log("📡 META STATUS:", response.status);
    console.log("📡 META RESPONSE:", JSON.stringify(result, null, 2));

    // ❌ HANDLE ERRORS
    if (!response.ok) {
      const errorMessage = result?.error?.message || "Unknown Meta API Error";
      const errorCode = result?.error?.code || "No Code";
      const errorType = result?.error?.type || "Unknown Type";

      console.error("❌ META API ERROR DETAILS:");
      console.error({
        status: response.status,
        code: errorCode,
        type: errorType,
        message: errorMessage,
        fullError: result,
      });

      throw new Error(
        `Meta API Error [${errorCode}]: ${errorMessage}`
      );
    }

    // ✅ SUCCESS
    console.log("✅ WhatsApp message sent successfully");

    return result;

  } catch (error: any) {
    console.error("❌ WHATSAPP OUTBOUND FAILURE:", error.message);

    // 🔥 EXTRA DEBUG CONTEXT
    console.error("❌ STACK TRACE:", error.stack);

    throw error;
  }
}