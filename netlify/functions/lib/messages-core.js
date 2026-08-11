const { getFirestore, FieldValue } = require('./firestore-admin');
const { getIntegration } = require('./integration-settings');

function daysBetween(a,b){const MS=86400000;const da=new Date(a.getFullYear(),a.getMonth(),a.getDate());const db=new Date(b.getFullYear(),b.getMonth(),b.getDate());return Math.round((db-da)/MS)}
async function sendWhatsapp(to,message,videoUrl){
  const token=await getIntegration('whatsappToken').catch(()=> '')||process.env.WHATSAPP_TOKEN; const phoneId=await getIntegration('whatsappPhoneId').catch(()=> '')||process.env.WHATSAPP_PHONE_ID;
  if(!token||!phoneId||!to)return false; const digits=String(to).replace(/[^0-9]/g,''); if(digits.length<8)return false;
  try{let ok=false;const base={messaging_product:'whatsapp',to:digits};if(videoUrl){const r=await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...base,type:'video',video:{link:videoUrl}})});ok=r.ok}if(message){const r=await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...base,type:'text',text:{body:message}})});ok=r.ok||ok}return ok}catch{return false}
}
async function sendEmail(to,subject,text,videoUrl){const apiKey=await getIntegration('resendApiKey').catch(()=> '')||process.env.RESEND_API_KEY;const from=await getIntegration('sendFrom').catch(()=> '')||process.env.SEND_FROM;if(!apiKey||!from||!to||!String(to).includes('@'))return false;try{const attachments=videoUrl?[{filename:'jamrat-video.mp4',path:videoUrl}]:undefined;const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text,attachments})});return r.ok}catch{return false}}
function buildMessage(kind,guestName,clientName,rsvpLink){if(kind==='reminder')return `هلا ${guestName} 💛\n\nتذكير بسيط إن موعد "${clientName}" قرب!\n${rsvpLink||''}\n\nبانتظارك 🤍`;return `هلا ${guestName} 💛\n\nشكراً من قلبنا إنك شرّفتينا بـ"${clientName}"! سعدنا فعلاً بوجودك معنا.\n\nبكل حب 🤍`}

async function getEventMedia(db,eventId){
  // فيديوهات المناسبة تُحفظ من event-media.js بمجموعة jamratEventMedia،
  // مو كحقول على مستند events مباشرة — لازم نقرأ من نفس المكان اللي يُكتب فيه.
  try{const snap=await db.collection('jamratEventMedia').doc(String(eventId)).get();return snap.exists?(snap.data()||{}):{}}catch{return{}}
}

async function runDailyMessages(){
  const db=getFirestore(); const snap=await db.collection('events').where('status','==','active').get(); const today=new Date(); let sentCount=0,checkedEvents=0,updated=0;
  for(const eventDoc of snap.docs){const ev={id:eventDoc.id,...eventDoc.data()};if(!ev.eventDate)continue;checkedEvents++;const date=new Date(ev.eventDate);if(isNaN(date.getTime()))continue;
    const reminderOffset=Math.max(0,Number(ev.reminderOffsetDays ?? (ev.eventType==='مؤتمر'?7:2))); const diff=daysBetween(today,date);
    const reminder=diff===reminderOffset && !ev.reminderSent; const thankDelay=Math.max(0,Number(ev.thankyouDelayDays ?? 1)); const thank=diff===-thankDelay && !ev.thankyouSent; if(!reminder&&!thank)continue;
    const guestsSnap=await eventDoc.ref.collection('guests').get(); const guests=guestsSnap.docs.map(d=>({id:d.id,...d.data()})); const kind=reminder?'reminder':'thankyou';
    const media=await getEventMedia(db,ev.id);
    for(const guest of guests){if(thank&&!(guest.checkedIn||guest.arrivedAt||guest.status==='attended'))continue;const msg=buildMessage(kind,guest.name||'',ev.clientName||ev.title||'',guest.rsvpLink);const video=reminder?(guest.reminderVideoUrl||media.reminderVideoUrl||ev.reminderVideoUrl):(guest.thankyouVideoUrl||media.thankyouVideoUrl||ev.thankyouVideoUrl);const [wa,email]=await Promise.all([sendWhatsapp(guest.phone,msg,video),sendEmail(guest.email,reminder?'تذكير بموعد دعوتك ✨':'شكراً لحضورك 🤍',msg,video)]);if(wa||email)sentCount++;}
    const patch=reminder?{reminderSent:true,reminderSentAt:FieldValue.serverTimestamp()}:{thankyouSent:true,thankyouSentAt:FieldValue.serverTimestamp()};await eventDoc.ref.set(patch,{merge:true});updated++;
  }
  return{ok:true,sentCount,checkedEvents,updated};
}
module.exports={runDailyMessages};
