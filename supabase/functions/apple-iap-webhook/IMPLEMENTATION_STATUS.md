# Apple IAP Backend Implementation Status

**Date:** 2026-10-01  
**Status:** 🔄 In Progress (Security validation framework in place)

## What's Implemented ✅

### webhook (apple-iap-webhook)
- ✅ JWS payload parsing and structure validation
- ✅ Idempotency via `notificationUUID` (not transaction ID + type)
- ✅ Notification type to state mapping
- ✅ Subscription state updates in `usuarios_suscripciones_iap`
- ✅ User plan projection updates
- ✅ Error handling and logging
- ✅ Integration with jws-validator module

### check-entitlement
- ✅ Apple credentials validation (fail closed if missing)
- ✅ Framework for Apple App Store Server API calls
- ✅ User authentication verification
- ✅ Subscription creation/update in database
- ✅ Access determination based on Apple state
- ✅ Error handling with closed-failure mode

### Infrastructure
- ✅ Migration `20261001_iap_subscriptions.sql` created
- ✅ RLS policies for security
- ✅ GitHub workflow updated with deploy steps (blocked)
- ✅ JWS validator module (jws-validator.ts) created

## What Needs Full Implementation 🔴

### JWS Signature Verification (CRITICAL)
**Location:** `supabase/functions/apple-iap-webhook/jws-validator.ts`

Must implement:
1. **x5c Certificate Chain Validation**
   - Parse DER-encoded certificates from x5c header
   - Validate certificate chain up to Apple Root CA G3
   - Check certificate validity dates (not before/not after)
   - Validate certificate constraints and purposes

2. **ES256 Signature Verification**
   - Extract public key from leaf certificate (x5c[0])
   - Use `crypto.subtle.verify()` with ES256 algorithm
   - Verify signature of `header.payload` (JWS format)
   - Signature must be base64url-decoded before verification

3. **Nested JWS Parsing**
   - Parse `signedTransactionInfo` as nested JWS
   - Parse `signedRenewalInfo` as nested JWS  
   - Apply same x5c + ES256 verification to nested payloads
   - Extract actual transaction/renewal data from verified payloads

### Apple App Store Server API Integration (CRITICAL)
**Location:** `supabase/functions/check-entitlement/index.ts`

Must implement:
1. **JWT Signing with Private Key**
   - Sign JWT with ES256 using APPLE_PRIVATE_KEY_P8
   - Use `crypto.subtle.sign()` with the private key
   - Set claims: iss, iat, exp, aud

2. **API Call to getTransactionInfo**
   - Endpoint: `https://api.storekit.itunes.apple.com/inapp/v1/subscriptions/{originalTransactionId}`
   - Use signed JWT in Authorization header
   - Handle HTTP errors (401, 404, 5xx)
   - Parse response and extract actual subscription state

3. **Error Handling**
   - Fail closed (deny access) if Apple API unavailable
   - Fail closed if JWT signing fails
   - Fail closed if credentials missing (already implemented)
   - Never grant access without verification from Apple

## Environment Variables Required

Must be set in Supabase Edge Functions Secrets:
```
APPLE_ISSUER_ID=<your-issuer-id-from-app-store-connect>
APPLE_KEY_ID=<your-key-id>
APPLE_PRIVATE_KEY_P8=<full-content-of-.p8-file>
APPLE_BUNDLE_ID=com.pathway.coach
```

Without these, both functions fail closed (deny all access).

## Certificate Information

**Apple Root CA G3** (already in code):
- Serial: 58D1C300EBFB0EB2B76C2184051E4012264404A2
- Validity: 2024-05-08 to 2029-05-08
- Used to validate x5c certificate chains

## Testing

Basic structure tests exist in `test.ts`:
- JWS format validation
- Missing x5c detection
- Algorithm validation
- Payload extraction

**Production testing needs:**
- JWS signature verification with real Apple certificate
- Apple App Store Server API integration
- End-to-end webhook processing
- Idempotency verification
- Nested JWS validation

## Security Checklist

- [ ] x5c certificate chain validation implemented
- [ ] ES256 signature verification implemented
- [ ] Apple JWT signing with P8 private key working
- [ ] Apple App Store Server API integration tested
- [ ] Fail-closed behavior verified (no access without verification)
- [ ] Credentials validation tested (missing env vars = error)
- [ ] Idempotency tested (duplicate notifications ignored)
- [ ] Error logging configured (no sensitive data logged)

## Deployment Notes

1. Do NOT apply migration to production yet
2. Deploy steps in GitHub workflow are blocked with `if: false`
3. Must complete all CRITICAL implementations before enabling
4. Test in sandbox environment first
5. Only enable production deployment after full verification

## Dependencies

- `jsr:@supabase/supabase-js@2` - Supabase client
- `jsr:@std/encoding` - Buffer utilities (for JWT signing)
- Built-in Web Crypto API for ES256 operations

## References

- [Apple App Store Server Notifications V2](https://developer.apple.com/documentation/appstoreservernotifications)
- [Apple App Store Server API](https://developer.apple.com/documentation/appstoreserverapi)
- [JWS Specification (RFC 7515)](https://tools.ietf.org/html/rfc7515)
- [ECDSA Signature Verification](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify)
