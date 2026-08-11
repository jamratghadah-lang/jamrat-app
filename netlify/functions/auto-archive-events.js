const { getFirestore, FieldValue } = require('./lib/firestore-admin');
const { requireAdmin } = require('./lib/admin-auth');
exports.handler=async(event)=>{
 try{await requireAdmin(event);}catch(err){return{statusCode:401,body:JSON.stringify({ok:false,message:'المصادقة مطلوبة'})}}
 try{const db=getFirestore();const snap=await db.collection('events').where('archived','!=',true).get();const now=Date.now();let count=0;
 for(const d of snap.docs){const e=d.data()||{};if(e.archived)continue;const raw=e.eventDate||e.date;if(!raw)continue;const t=new Date(raw).getTime();if(!Number.isFinite(t))continue;if(now>=t+24*60*60*1000){await d.ref.set({archived:true,archivedAt:FieldValue.serverTimestamp(),status:'archived',updatedAt:FieldValue.serverTimestamp()},{merge:true});count++;}}
 return{statusCode:200,body:JSON.stringify({ok:true,count})};}catch(err){console.error(err);return{statusCode:500,body:JSON.stringify({ok:false,message:err.message||'تعذر الأرشفة التلقائية'})}}
};
exports.config={schedule:'0 3 * * *'};
