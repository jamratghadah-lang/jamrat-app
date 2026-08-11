const { requireAdmin } = require('./lib/admin-auth');
const { getFirestore, FieldValue } = require('./lib/firestore-admin');
exports.handler = async (event) => {
  if (!['POST','GET'].includes(event.httpMethod)) return {statusCode:405,body:'Method Not Allowed'};
  try {
    await requireAdmin(event);
    const db=getFirestore();
    if(event.httpMethod==='GET'){
      const snap=await db.collection('events').where('archived','==',true).get();
      return {statusCode:200,body:JSON.stringify({ok:true,events:snap.docs.map(d=>({id:d.id,...d.data()}))})};
    }
    const p=JSON.parse(event.body||'{}'); const id=String(p.eventCode||''); const archived=!!p.archived;
    if(!id) return {statusCode:400,body:JSON.stringify({ok:false,message:'eventCode مطلوب'})};
    const ref=db.collection('events').doc(id); const snap=await ref.get(); if(!snap.exists)return {statusCode:404,body:JSON.stringify({ok:false,message:'المناسبة غير موجودة'})};
    await ref.set({archived, archivedAt:archived?FieldValue.serverTimestamp():null, status:archived?'archived':'active', updatedAt:FieldValue.serverTimestamp()},{merge:true});
    return {statusCode:200,body:JSON.stringify({ok:true,archived})};
  } catch(err){return {statusCode:err.message?.startsWith('AUTH_')?401:500,body:JSON.stringify({ok:false,message:err.message||'تعذر أرشفة المناسبة'})};}
};
