// Pure validation only: no account provisioning, no password storage, no writes.
const roles=new Set(['educator','director','service_head','institution_admin']);
export function planStaffChange({admin,target,action,role}){
 if(!admin||admin.role!=='institution_admin'||!admin.mfaVerified)return {ok:false,reason:'not-admin'};
 if(!target||target.institutionId!==admin.institutionId)return {ok:false,reason:'cross-institution'};
 if(target.id===admin.id&&action==='disable')return {ok:false,reason:'self-lockout'};
 if(action==='change-role'&&!roles.has(role))return {ok:false,reason:'invalid-role'};
 if(!['disable','change-role'].includes(action))return {ok:false,reason:'unsupported'};
 return {ok:true,requiresAudit:true,requiresReauthentication:true,action};
}
