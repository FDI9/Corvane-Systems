const crypto = require('crypto');

const PIXEL_ID = '2150680348828660';
const FORM_NAME = 'corvane-inquiry';

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

exports.handler = async (event) => {
  try {
    const payload = (JSON.parse(event.body || '{}').payload) || {};
    const data = payload.data || {};

    if (payload.form_name && payload.form_name !== FORM_NAME) {
      return { statusCode: 200, body: 'Skipped: different form' };
    }

    const token = process.env.META_CAPI_TOKEN;
    if (!token) {
      console.log('META_CAPI_TOKEN is not set');
      return { statusCode: 200, body: 'Missing token' };
    }

    const userData = { country: [hash('us')] };

    const email = (data.email || '').trim().toLowerCase();
    if (email) userData.em = [hash(email)];

    let phone = (data.phone || '').replace(/\D/g, '');
    if (phone.length === 10) phone = '1' + phone;
    if (phone.length >= 11) userData.ph = [hash(phone)];

    const nameParts = (data.name || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (nameParts.length > 0) userData.fn = [hash(nameParts[0])];
    if (nameParts.length > 1) userData.ln = [hash(nameParts[nameParts.length - 1])];

    userData.client_user_agent = data.user_agent || 'unknown';
    if (data.ip) userData.client_ip_address = data.ip;
    if (data.fbp) userData.fbp = data.fbp;
    if (data.fbc) userData.fbc = data.fbc;

    const created = payload.created_at ? new Date(payload.created_at).getTime() : Date.now();

    const metaEvent = {
      event_name: 'Lead',
      event_time: Math.floor(created / 1000),
      event_id: data.event_id || payload.id || String(created),
      action_source: 'website',
      event_source_url: 'https://corvanesystems.com/',
      user_data: userData
    };

    const response = await fetch(
      'https://graph.facebook.com/' + PIXEL_ID + '/events?access_token=' + encodeURIComponent(token),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [metaEvent] })
      }
    );

    const result = await response.text();
    console.log('Meta response', response.status, result);
    return { statusCode: 200, body: 'Sent' };
  } catch (err) {
    console.log('Lead event failed', err.message);
    return { statusCode: 200, body: 'Error' };
  }
};
