import crypto from "node:crypto";

export default async (request) => {
  if (request.method !== "POST") return new Response("Method Not Allowed", {status:405});
  const secret = process.env.JAMRAT_RSVP_SIGNING_SECRET;
  if (!secret) return Response.json({valid:false,error:"SERVER_SIGNING_SECRET_NOT_CONFIGURED"},{status:500});
  try {
    const {eventId, templateId, personalCode, timestamp, sig} = await request.json();
    const age = Math.abs(Date.now() - Number(timestamp));
    if (!eventId || !templateId || !personalCode || !timestamp || !sig || !Number.isFinite(Number(timestamp)) || age > 24*60*60*1000) {
      return Response.json({valid:false,error:"INVALID_OR_EXPIRED_SIGNATURE"},{status:401});
    }
    const payload = `${eventId}:${templateId}:${personalCode}:${timestamp}`;
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const valid = expected.length === sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
    return Response.json({valid});
  } catch {
    return Response.json({valid:false,error:"INVALID_REQUEST"},{status:400});
  }
};
