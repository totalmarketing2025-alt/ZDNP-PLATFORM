import {createRemoteJWKSet,jwtVerify} from 'jose';
import {hasMfa} from './policy.js';
let jwks;
export function configured(){
 const {OIDC_ISSUER,OIDC_AUDIENCE,OIDC_JWKS_URL}=process.env;
 if(!OIDC_ISSUER||!OIDC_AUDIENCE||!OIDC_JWKS_URL)throw new Error('OIDC is not configured');
 const url=new URL(OIDC_JWKS_URL);
 if(url.protocol!=='https:')throw new Error('OIDC JWKS must use HTTPS');
 return {issuer:OIDC_ISSUER,audience:OIDC_AUDIENCE,url};
}
export async function verifyBearer(header){
 const match=/^Bearer ([A-Za-z0-9._~+\/-]+=*)$/.exec(header||'');
 if(!match)throw new Error('Bearer token required');
 const cfg=configured();
 jwks??=createRemoteJWKSet(cfg.url);
 const {payload}=await jwtVerify(match[1],jwks,{issuer:cfg.issuer,audience:cfg.audience,algorithms:['RS256','ES256'],clockTolerance:5,maxTokenAge:'15m'});
 if(!payload.sub||!hasMfa(payload))throw new Error('Verified MFA required');
 return payload.sub;
}
