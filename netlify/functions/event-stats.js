const { requireAdmin } = require('./lib/admin-auth');
const { getFirestore } = require('./lib/firestore-admin');
exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return{statusCode:405,body:'Method Not Allowed'};
 try{await requireAdmin(event);const id=String(event.queryStringParameters?.eventId||'');if(!id)return{statusCode:400,body:JSON.stringify({ok:false,message:'eventId مطلوب'})};
 const db=getFirestore();const snap=await db.collection('events').doc(id).collection('guests').get();let total=0,confirmed=0,checkedIn=0,declined=0,pending=0,companions=0;
 snap.forEach(d=>{const g=d.data()||{};total++;const s=String(g.status||'').toLowerCase();if(s==='confirmed'||s==='yes')confirmed++;else if(s==='declined'||s==='no')declined++;else pending++;if(g.checkedIn||g.arrivedAt)checkedIn++;companions+=Number(g.companions||g.guests||0)||0;});
 return{statusCode:200,body:JSON.stringify({ok:true,stats:{total,confirmed,declined,pending,checkedIn,companions}})};
 }catch(err){return{statusCode:err.message?.startsWith('AUTH_')?401:500,body:JSON.stringify({ok:false,message:err.message||'تعذر قراءة الإحصائيات'})}}
};
