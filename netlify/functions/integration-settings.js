const { requireAdmin } = require('./lib/admin-auth');
const { getAllIntegrationKeys, setIntegration, deleteIntegration } = require('./lib/integration-settings');
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
exports.handler=async(event)=>{
  if(!['GET','POST','DELETE'].includes(event.httpMethod))return json(405,{ok:false,message:'Method Not Allowed'});
  try{await requireAdmin(event);
    if(event.httpMethod==='GET')return json(200,{ok:true,configured:await getAllIntegrationKeys()});
    const key=event.queryStringParameters?.key;
    if(event.httpMethod==='DELETE'){if(!key)return json(400,{ok:false,message:'المفتاح مطلوب'});await deleteIntegration(key);return json(200,{ok:true});}
    let body;try{body=JSON.parse(event.body||'{}')}catch{return json(400,{ok:false,message:'بيانات غير صالحة'})}
    if(!body.key||typeof body.value!=='string'||!body.value.trim())return json(400,{ok:false,message:'المفتاح والقيمة مطلوبان'});
    await setIntegration(body.key,body.value.trim());return json(200,{ok:true});
  }catch(err){const code=['AUTH_REQUIRED','AUTH_INVALID','AUTH_EXPIRED'].includes(err.message)?401:500;return json(code,{ok:false,message:err.message||'تعذر تنفيذ العملية'})}
};
