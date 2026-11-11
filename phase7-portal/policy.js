export function hasMfa(claims){
 return Array.isArray(claims?.amr)&&claims.amr.some(x=>['mfa','otp','webauthn','hwk'].includes(x));
}
export function allowedRole(role){return ['educator','director','institution_admin','service_head'].includes(role)}
export function allowedToReadCases(role){return role==='educator'||role==='director'}
