// Phase 6: identity validation contract. Deliberately fail closed.
// Production OIDC validation needs configured issuer, audience, JWKS and MFA policy.
export class AuthenticationUnavailableError extends Error {
 constructor(){super('Verified institutional identity provider is not configured');this.name='AuthenticationUnavailableError';}
}
export async function verifyStaffSession(_request){
 throw new AuthenticationUnavailableError();
}
export function assertVerifiedPrincipal(principal){
 if(!principal||principal.verified!==true||principal.mfaVerified!==true||
 !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(principal.institutionId||'')||
 !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(principal.staffId||'')){
 throw new AuthenticationUnavailableError();
 }
 return {institutionId:principal.institutionId,staffId:principal.staffId};
}
