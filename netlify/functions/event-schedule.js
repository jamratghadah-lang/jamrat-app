const { requireAdmin } = require('./lib/admin-auth');
const { getFirestore, FieldValue } = require('./lib/firestore-admin');
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST') return {statusCode:405,body:JSON.stringify({ok:false,message:'Method Not Allowed'})};
 try{await requireAdmin(event);const p=JSON.parse(event.body||'{}');const id=String(p.eventId||'');if(!id)return {statusCode:400,body:JSON.stringify({ok:false,message:'eventId مطلوب'})};
 const db=getFirestore();const ref=db.collection('events').doc(id);const snap=await ref.get();if(!snap.exists)return {statusCode:404,body:JSON.stringify({ok:false,message:'المناسبة غير موجودة'})};
 const update={updatedAt:FieldValue.serverTimestamp(),timeZone:String(p.timeZone||'Asia/Riyadh')};if(p.reminder)update.reminder={enabled:!!p.reminder.enabled,daysBefore:Math.max(0,Number(p.reminder.daysBefore||0)),time:String(p.reminder.time||'19:00'),videoUrl:String(p.reminder.videoUrl||'')};if(p.thankyou)update.thankyou={enabled:!!p.thankyou.enabled,daysAfter:Math.max(0,Number(p.thankyou.daysAfter||0)),time:String(p.thankyou.time||'12:00'),videoUrl:String(p.thankyou.videoUrl||'')};await ref.set(update,{merge:true});return {statusCode:200,body:JSON.stringify({ok:true})};
 }catch(e){return {statusCode:e.message?.startsWith('AUTH_')?401:500,body:JSON.stringify({ok:false,message:e.message||'تعذر حفظ الجدولة'})}}
};
