const { getFirestore, FieldValue } = require('./firestore-admin');
const { getIntegration } = require('./integration-settings');

function daysBetween(a,b){const MS=86400000;const da=new Date(a.getFullYear(),a.getMonth(),a.getDate());const db=new Date(b.getFullYear(),b.getMonth(),b.getDate());return Math.round((db-da)/MS)}
function withinMinutes(current,target,tolerance){const [ch,cm]=String(current).split(':').map(Number),[th,tm]=String(target||'00:00').split(':').map(Number);if(!Number.isFinite(ch)||!Number.isFinite(cm)||!Number.isFinite(th)||!Number.isFinite(tm))return false;const a=ch*60+cm,b=th*60+tm,d=Math.abs(a-b);return Math.min(d,1440-d)<=tolerance}
function localParts(date,timeZone='Asia/Riyadh'){
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
  const out={}; for(const p of parts) if(p.type==='hour'||p.type==='minute') out[p.type]=p.value; return out;
}
async function sendWhatsapp(to,message,videoUrl){
  const token=await getIntegration('whatsappToken').catch(()=> '')||process.env.WHATSAPP_TOKEN; const phoneId=await getIntegration('whatsappPhoneId').catch(()=> '')||process.env.WHATSAPP_PHONE_ID;
  if(!token||!phoneId||!to)return {ok:false,message:'إعدادات واتساب ناقصة'}; const digits=String(to).replace(/[^0-9]/g,''); if(digits.length<8)return {ok:false,message:'رقم واتساب غير صالح'};
  try{let any=false,last='';const base={messaging_product:'whatsapp',to:digits};
    if(videoUrl){const r=await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...base,type:'video',video:{link:videoUrl}})});const d=await r.json().catch(()=>({}));if(r.ok)any=true;else last=d?.error?.message||'فشل الفيديو';}
    if(message){const r=await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({...base,type:'text',text:{body:message}})});const d=await r.json().catch(()=>({}));if(r.ok)any=true;else last=d?.error?.message||last||'فشل النص';}
    return {ok:any,message:any?'تم الإرسال':'فشل الإرسال',error:any?'':last};
  }catch{return {ok:false,message:'تعذر الاتصال بواتساب'}}
}
async function sendEmail(to,subject,text,videoUrl){
  const apiKey=await getIntegration('resendApiKey').catch(()=> '')||process.env.RESEND_API_KEY;const from=await getIntegration('sendFrom').catch(()=> '')||process.env.SEND_FROM;if(!apiKey||!from||!to||!String(to).includes('@'))return {ok:false,message:'إعدادات البريد أو البريد غير صالح'};
  try{const attachments=videoUrl?[{filename:'jamrat-video.mp4',path:videoUrl}]:undefined;const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text,attachments})});const d=await r.json().catch(()=>({}));return r.ok?{ok:true,messageId:d?.id||'',message:'تم إرسال البريد'}:{ok:false,message:d?.message||'فشل إرسال البريد'};}catch{return {ok:false,message:'تعذر الاتصال بخادم الإيميل'}}
}
function buildMessage(kind,guestName,clientName,rsvpLink){if(kind==='reminder')return `هلا ${guestName} 💛\n\nتذكير بسيط إن موعد "${clientName}" قرب!\n${rsvpLink||''}\n\nبانتظارك 🤍`;return `هلا ${guestName} 💛\n\nشكراً من قلبنا إنك شرّفتينا بـ"${clientName}"! سعدنا فعلاً بوجودك معنا.\n\nبكل حب 🤍`}
async function getEventMedia(db,eventId){try{const snap=await db.collection('jamratEventMedia').doc(String(eventId)).get();return snap.exists?(snap.data()||{}):{}}catch{return{}}}

async function runDailyMessages(){
  const db=getFirestore(); const snap=await db.collection('events').where('status','==','active').get(); const now=new Date(); let sentCount=0,checkedEvents=0,updated=0;
  for(const eventDoc of snap.docs){const ev={id:eventDoc.id,...eventDoc.data()};if(!ev.eventDate)continue;checkedEvents++;const date=new Date(ev.eventDate);if(isNaN(date.getTime()))continue;
    const reminderCfg=ev.reminder||{}; const thankCfg=ev.thankyou||{}; const tz=ev.timeZone||'Asia/Riyadh';
    const diff=daysBetween(now,date); const local=localParts(now,tz); const currentHHMM=`${local.hour}:${local.minute}`;
    const reminder=!!reminderCfg.enabled && diff===Math.max(0,Number(reminderCfg.daysBefore||0)) && (!reminderCfg.time||withinMinutes(currentHHMM,reminderCfg.time,7)) && !ev.reminderSent;
    const thank=!!thankCfg.enabled && diff===-Math.max(0,Number(thankCfg.daysAfter||0)) && (!thankCfg.time||withinMinutes(currentHHMM,thankCfg.time,7)) && !ev.thankyouSent;
    if(!reminder&&!thank)continue;
    const guestsSnap=await eventDoc.ref.collection('guests').get(); const guests=guestsSnap.docs.map(d=>({id:d.id,...d.data()})); const kind=reminder?'reminder':'thankyou'; const media=await getEventMedia(db,ev.id);
    for(const guest of guests){
      if(thank&&!(guest.checkedIn||guest.arrivedAt||guest.status==='attended'))continue;
      const msg=buildMessage(kind,guest.name||'',ev.clientName||ev.title||'',guest.rsvpLink);const video=reminder?(guest.reminderVideoUrl||media.reminderVideoUrl||''):(guest.thankyouVideoUrl||media.thankyouVideoUrl||'');
      const [wa,email]=await Promise.all([sendWhatsapp(guest.phone,msg,video),sendEmail(guest.email,kind==='reminder'?'تذكير بموعد دعوتك ✨':'شكراً لحضورك 🤍',msg,video)]);
      if(wa.ok||email.ok)sentCount++;
      await eventDoc.ref.collection('sendLogs').add({guestId:guest.id,channel:'daily',kind,whatsapp:wa,email,createdAt:FieldValue.serverTimestamp()});
    }
    const patch=reminder?{reminderSent:true,reminderSentAt:FieldValue.serverTimestamp()}:{thankyouSent:true,thankyouSentAt:FieldValue.serverTimestamp()};await eventDoc.ref.set(patch,{merge:true});updated++;
  }
  return{ok:true,sentCount,checkedEvents,updated};
}
module.exports={runDailyMessages};
