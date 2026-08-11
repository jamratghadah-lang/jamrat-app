const { requireAdmin } = require('./lib/admin-auth');
const { getFirestore, FieldValue } = require('./lib/firestore-admin');
const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)});
const norm=s=>String(s||'').toLowerCase().replace(/[؟?!.,،؛:]/g,' ').replace(/\s+/g,' ').trim();
exports.handler=async(event)=>{
  try{await requireAdmin(event);const db=getFirestore();
    if(event.httpMethod==='GET'){
      const q=norm(event.queryStringParameters?.q||'');
      if(!q)return json(200,{ok:true,faqs:[]});
      const snap=await db.collection('faqs').where('active','==',true).limit(100).get();
      const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
      const words=q.split(' ').filter(Boolean); let best=null,bestScore=0;
      for(const r of rows){const text=norm(r.question);let score=words.reduce((n,w)=>n+(text.includes(w)?1:0),0)/(words.length||1);if(score>bestScore){bestScore=score;best=r}}
      if(best&&bestScore>=0.4)return json(200,{ok:true,answer:best.answer,faq:best,score:bestScore});
      await db.collection('unknownQuestions').add({question:q,createdAt:FieldValue.serverTimestamp(),status:'open'});
      return json(200,{ok:true,answer:'',unknown:true});
    }
    if(event.httpMethod==='POST'){
      const p=JSON.parse(event.body||'{}'); if(!p.question||!p.answer)return json(400,{ok:false,message:'السؤال والإجابة مطلوبان'});
      const ref=await db.collection('faqs').add({question:String(p.question).trim(),answer:String(p.answer).trim(),active:true,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      return json(200,{ok:true,id:ref.id});
    }
    if(event.httpMethod==='DELETE'){
      const id=event.queryStringParameters?.id;if(!id)return json(400,{ok:false,message:'id مطلوب'});await db.collection('faqs').doc(id).delete();return json(200,{ok:true});
    }
    return json(405,{ok:false,message:'Method Not Allowed'});
  }catch(e){const code=['AUTH_REQUIRED','AUTH_INVALID','AUTH_EXPIRED'].includes(e.message)?401:500;return json(code,{ok:false,message:e.message||'تعذر تنفيذ FAQ'})}
};
