function normalizeIndianPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  const nationalNumber =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;

  return /^[6-9]\d{9}$/.test(nationalNumber) ? nationalNumber : null;
}

function getWhatsAppConfig() {
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const templateName = (process.env.WHATSAPP_TEMPLATE_NAME || '').trim();
  if (!accessToken || !phoneNumberId || !templateName) return null;

  return {
    accessToken,
    phoneNumberId,
    templateName,
    language: (process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en').trim(),
    apiVersion: (process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0').trim()
  };
}

function isConfigured() {
  return Boolean(getWhatsAppConfig());
}

async function sendOrderConfirmation(order) {
  if (!order.whatsappOptIn) return { status: 'not_requested' };

  const config = getWhatsAppConfig();
  if (!config) return { status: 'not_configured' };

  const customerNumber = normalizeIndianPhone(order.user?.phone);
  if (!customerNumber) {
    throw new Error('WhatsApp order confirmation requires a valid Indian mobile number.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${encodeURIComponent(config.phoneNumberId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: `91${customerNumber}`,
          type: 'template',
          template: {
            name: config.templateName,
            language: { code: config.language },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: String(order.user?.name || 'Customer') },
                  { type: 'text', text: String(order.orderNumber) },
                  { type: 'text', text: `₹${Number(order.totalAmount).toFixed(2)}` },
                  { type: 'text', text: String(order.paymentMethod || 'Pending') },
                  { type: 'text', text: String(order.deliveryAgentPhone || 'Not assigned') }
                ]
              }
            ]
          }
        }),
        signal: controller.signal
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || 'WhatsApp Cloud API rejected the order confirmation.');
    }

    return {
      status: 'sent',
      messageId: result.messages?.[0]?.id || ''
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { isConfigured, normalizeIndianPhone, sendOrderConfirmation };
