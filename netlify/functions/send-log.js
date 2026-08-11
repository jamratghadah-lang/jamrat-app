const { requireAdmin } = require('./lib/admin-auth');
const { getFirestore, FieldValue } = require('./lib/firestore-admin');
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async(event)=>{
  try{await requireAdmin(event);const db=getFirestore();const ref=db.collection('sendLogs');
    if(event.httpMethod==='GET'){const snap=await ref.orderBy('createdAt','desc').limit(300).get();return json(200,{ok:true,logs:snap.docs.map(d=>({id:d.id,...d.data()}))});}
    if(event.httpMethod==='POST'){const p=JSON.parse(event.body||'{}');const x={eventId:String(p.eventId||''),guestId:String(p.guestId||''),channel:String(p.channel||''),to:String(p.to||''),ok:!!p.ok,message:String(p.message||''),createdAt:FieldValue.serverTimestamp()};const d=await ref.add(x);return json(200,{ok:true,id:d.id});}
    if(event.httpMethod==='DELETE'){const id=event.queryStringParameters?.id;if(id){await ref.doc(id).delete()}else{const snap=await ref.limit(300).get();const b=db.batch();snap.docs.forEach(d=>b.delete(d.ref));await b.commit()}return json(200,{ok:true});}
    return json(405,{ok:false,message:'Method Not Allowed'});
  }catch(e){const code=['AUTH_REQUIRED','AUTH_INVALID','AUTH_EXPIRED'].includes(e.message)?401:500;return json(code,{ok:false,message:e.message||'تعذر حفظ سجل الإرسال'})}
};
