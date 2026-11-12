// FICTIONAL DATA ONLY. No production authentication or persistent storage.
export const institutions=['IDR','PRI','STI'];
export const staff={
 'demo-idr-educator':{id:'demo-idr-educator',institution:'IDR',role:'educator'},
 'demo-idr-director':{id:'demo-idr-director',institution:'IDR',role:'director'},
 'demo-idr-admin':{id:'demo-idr-admin',institution:'IDR',role:'institution_admin'},
 'demo-pri-educator':{id:'demo-pri-educator',institution:'PRI',role:'educator'},
 'demo-sti-educator':{id:'demo-sti-educator',institution:'STI',role:'educator'}
};
const seed=[
 {id:'DEMO-IDR-001',institution:'IDR',category:'request',subject:'Измислена молба',status:'received',confidential:false,assignedTo:null,forwarded:false},
 {id:'DEMO-IDR-002',institution:'IDR',category:'question',subject:'Измислено прашање',status:'forwarded',confidential:false,assignedTo:'demo-idr-educator',forwarded:true},
 {id:'DEMO-PRI-001',institution:'PRI',category:'petition',subject:'Измислено барање',status:'received',confidential:false,assignedTo:null,forwarded:false},
 {id:'DEMO-IDR-003',institution:'IDR',category:'complaint',subject:'Доверлива тест претставка',status:'triage',confidential:true,assignedTo:null,forwarded:false}
];
export function createSandbox(){
 const cases=structuredClone(seed),events=[];
 function canRead(user,item){
  if(!user||!item||user.institution!==item.institution||user.role==='institution_admin'||item.confidential)return false;
  if(user.role==='director')return item.forwarded;
  return user.role==='educator'&&(item.assignedTo===null||item.assignedTo===user.id);
 }
 function list(user){return cases.filter(c=>canRead(user,c)).map(c=>({...c}));}
 function get(user,id){const item=cases.find(c=>c.id===id);return canRead(user,item)?{...item}:null;}
 function transition(user,id,action){
  const item=cases.find(c=>c.id===id);
  if(!canRead(user,item))return {ok:false,code:403};
  if(action==='assign'&&user.role==='educator'&&item.status==='received'&&!item.assignedTo){item.assignedTo=user.id;item.status='assigned';}
  else if(action==='forward'&&user.role==='educator'&&item.assignedTo===user.id&&item.status==='assigned'){item.forwarded=true;item.status='forwarded';}
  else if(action==='answer'&&user.role==='director'&&item.forwarded&&item.status==='forwarded'){item.status='answered';}
  else return {ok:false,code:409};
  events.push({caseId:id,actor:user.id,action});
  return {ok:true,item:{...item}};
 }
 return {list,get,transition,events};
}
