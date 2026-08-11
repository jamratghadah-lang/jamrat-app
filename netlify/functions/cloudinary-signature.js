const crypto = require('crypto');
const { requireAdmin } = require('./lib/admin-auth');
const { getIntegration } = require('./lib/integration-settings');

const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return json(405,{ok:false,message:'Method Not Allowed'});
  try{
    await requireAdmin(event);
    const cloudName=await getIntegration('cloudinaryCloudName')||process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey=await getIntegration('cloudinaryApiKey')||process.env.CLOUDINARY_API_KEY;
    const apiSecret=await getIntegration('cloudinaryApiSecret')||process.env.CLOUDINARY_API_SECRET;
    if(!cloudName||!apiKey||!apiSecret) return json(500,{ok:false,message:'إعدادات Cloudinary ناقصة'});
    let body={}; try{body=JSON.parse(event.body||'{}')}catch{}
    const timestamp=Math.floor(Date.now()/1000);
    const resourceType=String(body.resourceType||'video')==='image'?'image':'video';
    const folder=String(body.folder||'jamrat/invitations').replace(/[^a-zA-Z0-9_\/-]/g,'').slice(0,120)||'jamrat/invitations';
    const params=`folder=${folder}&timestamp=${timestamp}`;
    const signature=crypto.createHash('sha1').update(params+apiSecret).digest('hex');
    return json(200,{ok:true,cloudName,apiKey,timestamp,folder,signature,resourceType});
  }catch(err){
    const code=err.message==='AUTH_REQUIRED'?401:err.message==='ADMIN_REQUIRED'?403:500;
    return json(code,{ok:false,message:err.message||'تعذر إنشاء توقيع Cloudinary'});
  }
};
