const crypto=require('crypto');
const {requireAdmin}=require('./lib/admin-auth');
const {getFirestore,FieldValue}=require('./lib/firestore-admin');
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
const code=()=>crypto.randomBytes(5).toString('base64url').replace(/[-_]/g,'').slice(0,8).toLowerCase();
exports.handler=async(event)=>{
 try{
  await requireAdmin(event); const db=getFirestore(); const eventId=String(event.queryStringParameters?.eventId||'');
  if(event.httpMethod==='GET'){
   if(!eventId)return json(400,{ok:false,message:'eventId مطلوب'});
   const snap=await db.collection('events').doc(eventId).collection('guests').orderBy('createdAt','asc').get();
   return json(200,{ok:true,guests:snap.docs.map(d=>({id:d.id,...d.data()}))});
  }
  if(event.httpMethod==='POST'){
   const p=JSON.parse(event.body||'{}'); const eid=String(p.eventId||eventId); const rows=Array.isArray(p.guests)?p.guests:[];
   if(!eid||!rows.length)return json(400,{ok:false,message:'eventId وقائمة الضيوف مطلوبان'});
   const ref=db.collection('events').doc(eid); if(!(await ref.get()).exists)return json(404,{ok:false,message:'المناسبة غير موجودة'});
   const batch=db.batch(); const created=[];
   for(const r of rows){const name=String(r.name||'').trim(); if(!name)continue; const guestRef=ref.collection('guests').doc(); const personalCode=String(r.personalCode||code()); const entryCode=String(r.entryCode||personalCode); const data={name,phone:String(r.phone||'').trim(),email:String(r.email||'').trim(),companions:Math.max(0,Number(r.companions||0)),personalCode,entryCode,confirmed:!!r.confirmed,checkedIn:!!r.checkedIn,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};batch.set(guestRef,data,{merge:true});created.push({id:guestRef.id,...data});}
   await batch.commit(); return json(200,{ok:true,count:created.length,guests:created});
  }
  if(event.httpMethod==='DELETE'){
   const id=String(event.queryStringParameters?.id||''); if(!eventId||!id)return json(400,{ok:false,message:'eventId و id مطلوبان'}); await db.collection('events').doc(eventId).collection('guests').doc(id).delete(); return json(200,{ok:true});
  }
  return json(405,{ok:false,message:'Method Not Allowed'});
 }catch(e){const c=['AUTH_REQUIRED','AUTH_INVALID','AUTH_EXPIRED'].includes(e.message)?401:500;return json(c,{ok:false,message:e.message||'تعذر إدارة الضيوف'});}
};
