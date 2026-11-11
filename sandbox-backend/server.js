import http from 'node:http';
import {createSandbox,staff} from './core.js';
const db=createSandbox();
const port=Number(process.env.PORT||8789);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
 if(url.pathname==='/health'&&req.method==='GET')return send(200,{status:'demo-only'});
 const user=staff[req.headers['x-demo-user']];
 if(!user)return send(401,{error:'demo identity required; no production authentication'});
 if(url.pathname==='/api/me'&&req.method==='GET')return send(200,user);
 if(url.pathname==='/api/cases'&&req.method==='GET')return send(200,db.list(user));
 const match=url.pathname.match(/^\/api\/cases\/(DEMO-[A-Z]+-\d+)(?:\/actions)?$/);
 if(!match)return send(404,{error:'not found'});
 if(req.method==='GET'&&!url.pathname.endsWith('/actions')){
  const item=db.get(user,match[1]);return item?send(200,item):send(404,{error:'not found'});
 }
 if(req.method==='POST'&&url.pathname.endsWith('/actions')){
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return send(413,{error:'too large'});}
  let payload;try{payload=JSON.parse(raw)}catch{return send(400,{error:'invalid json'})}
  if(!['assign','forward','answer'].includes(payload.action))return send(400,{error:'invalid action'});
  const result=db.transition(user,match[1],payload.action);
  return send(result.ok?200:result.code,result.ok?result.item:{error:'not permitted or invalid transition'});
 }
 send(405,{error:'method not allowed'});
});
server.listen(port,'127.0.0.1',()=>console.log('ZDNP fictional sandbox at http://127.0.0.1:'+port+' (LOCAL ONLY)'));
