export const transitions=Object.freeze({
 received:{assign:{to:'assigned',roles:['educator']}},
 assigned:{forward:{to:'forwarded',roles:['educator']},request_info:{to:'needs_info',roles:['educator']}},
 needs_info:{resume:{to:'assigned',roles:['educator']}},
 forwarded:{answer:{to:'answered',roles:['director']},request_info:{to:'needs_info',roles:['director']}},
 answered:{close:{to:'closed',roles:['director']}}
});
export function planTransition({caseRecord,actor,action}){
 if(!caseRecord||!actor||!caseRecord.institutionId||actor.institutionId!==caseRecord.institutionId)return {ok:false,reason:'institution'};
 if(caseRecord.confidential)return {ok:false,reason:'confidential-independent-route-required'};
 const rule=transitions[caseRecord.status]?.[action];
 if(!rule||!rule.roles.includes(actor.role))return {ok:false,reason:'role-or-state'};
 if(actor.role==='educator'&&caseRecord.assignedTo!==actor.id&&!(action==='assign'&&!caseRecord.assignedTo))return {ok:false,reason:'assignment'};
 if(actor.role==='director'&&!caseRecord.forwarded)return {ok:false,reason:'not-forwarded'};
 return {ok:true,nextStatus:rule.to,event:{action,actorId:actor.id,caseId:caseRecord.id}};
}
