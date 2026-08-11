const { requireAdmin } = require('./lib/admin-auth');
const { getFirestore } = require('./lib/firestore-admin');
exports.handler=async(event)=>{if(event.httpMethod!=='GET')return{statusCode:405,body:'Method Not Allowed'};try{await requireAdmin(event);const snap=await getFirestore().collection('events').get();return{statusCode:200,body:JSON.stringify({ok:true,events:snap.docs.map(d=>({id:d.id,...d.data()}))})}}catch(err){console.error('events-list',err);return{statusCode:err.message?.startsWith('AUTH_')?401:500,body:JSON.stringify({ok:false,message:err.message||'تعذر قراءة المناسبات'})}}};
