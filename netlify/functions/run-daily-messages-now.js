const { requireAdmin } = require('./lib/admin-auth');
const { runDailyMessages } = require('./lib/messages-core');
exports.handler=async(event)=>{if(event.httpMethod!=='POST')return{statusCode:405,body:'Method Not Allowed'};try{await requireAdmin(event);const result=await runDailyMessages();return{statusCode:200,body:JSON.stringify(result)}}catch(err){return{statusCode:err.message?.startsWith('AUTH_')?401:500,body:JSON.stringify({ok:false,message:err.message||'تعذر التنفيذ'})}}};
