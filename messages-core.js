// netlify/functions/lib/messages-core.js
//
// المنطق الفعلي لفحص كل المناسبات النشطة وإرسال تذكير/شكر لمن حان وقتها.
// يُستخدم من مكانين:
//   - daily-messages.js (يشتغل تلقائي كل يوم بجدول)
//   - run-daily-messages-now.js (تشغيل يدوي فوري من زر "افحصي الآن")

const { getStore } = require("@netlify/blobs");

const PERSONAL_OFFSET = 2; // أيام - زفاف/مولود/تخرج/غيرها
const CORPORATE_OFFSET = 7; // أيام - مؤتمر/شركات

function daysBetween(a, b) {
  const MS = 1000 * 60 * 60 * 24;
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / MS);
}

async function sendWhatsappText(to, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId || !to) return false;
  const digits = String(to).replace(/[^0-9]/g, "");
  if (digits.length < 8) return false;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: digits,
        type: "text",
        text: { body: message },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendEmailText(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SEND_FROM;
  if (!apiKey || !from || !to || !to.includes("@")) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildMessage(kind, guestName, clientName, rsvpLink) {
  if (kind === "reminder") {
    return (
      `هلا ${guestName} 💛\n\n` +
      `تذكير بسيط إن موعد "${clientName}" قرب! لو ما أكدتي حضورك بعد، ياليت تأكدينه من هنا:\n` +
      `${rsvpLink || ""}\n\n` +
      `بانتظارك 🤍`
    );
  }
  return (
    `هلا ${guestName} 💛\n\n` +
    `شكراً من قلبنا إنك شرّفتينا بـ"${clientName}"! سعدنا فعلاً بوجودك معنا.\n\n` +
    `بكل حب 🤍`
  );
}

// يرجع {ok, sentCount, checkedEvents}
async function runDailyMessages() {
  const registryStore = getStore({ name: "jamrat-events-registry", consistency: "strong" });
  const eventsStore = getStore({ name: "jamrat-events", consistency: "strong" });

  const registry = (await registryStore.get("index", { type: "json" })) || { events: [] };
  const events = registry.events || [];
  const today = new Date();
  let changed = false;
  let sentCount = 0;
  let checkedEvents = 0;

  for (const ev of events) {
    if (ev.status !== "active" || !ev.eventDate) continue;
    checkedEvents++;

    const eventDate = new Date(ev.eventDate);
    if (isNaN(eventDate.getTime())) continue;

    const offset = ev.eventType === "مؤتمر" ? CORPORATE_OFFSET : PERSONAL_OFFSET;
    const diffDays = daysBetween(today, eventDate); // موجب = الحفل قدام، سالب = الحفل فات

    const shouldSendReminder = diffDays > 0 && diffDays <= offset && !ev.reminderSent;
    const shouldSendThankyou = diffDays < 0 && diffDays >= -offset && !ev.thankyouSent;

    if (!shouldSendReminder && !shouldSendThankyou) continue;

    let eventData;
    try {
      eventData = await eventsStore.get(ev.eventCode, { type: "json" });
    } catch {
      eventData = null;
    }
    if (!eventData || !Array.isArray(eventData.guests)) continue;

    const kind = shouldSendReminder ? "reminder" : "thankyou";
    const subject = kind === "reminder" ? "تذكير بموعد دعوتك ✨" : "شكراً لحضورك 🤍";

    for (const guest of eventData.guests) {
      const message = buildMessage(kind, guest.name || "", ev.clientName || "", guest.rsvpLink);
      const waOk = await sendWhatsappText(guest.phone, message);
      const emailOk = await sendEmailText(guest.email, subject, message);
      if (waOk || emailOk) sentCount++;
    }

    if (shouldSendReminder) ev.reminderSent = true;
    if (shouldSendThankyou) ev.thankyouSent = true;
    changed = true;
  }

  if (changed) {
    await registryStore.setJSON("index", { events });
  }

  return { ok: true, sentCount, checkedEvents };
}

module.exports = { runDailyMessages };
