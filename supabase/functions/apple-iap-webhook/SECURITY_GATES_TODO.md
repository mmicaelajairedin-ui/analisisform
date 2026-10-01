# Security Gates Implementation Guide

**Status:** Gates 1-2 ✅ implemented, Gates 3-4 ⏳ blocked on @peculiar/x509

## Current Implementation (Commit 45bd06f)

### Gate 1: Root CA Pinning ✅
- Checks last certificate in x5c chain matches pinned Apple Root CA G3 (byte-for-byte DER)
- Rejects immediately if root is spoofed
- **Cannot pass:** Attacker cannot substitute a different root

### Gate 2: Apple Identity ✅
- Verifies all certificates contain Apple identifiers ("Apple Inc" or Apple OID 1.2.840.113635.*)
- Rejects if any certificate lacks Apple markers
- **Cannot pass:** Attacker cannot use certificates from other CAs

### Gate 3: Cryptographic Chain Verification ❌ BLOCKER
- **What it does:** Verifies that each certificate in the chain is actually signed by the previous one
- **Why it's needed:** Without it, attacker could submit: [fake_leaf] + [real_intermediate] + [pinned_root]
  - Gate 2 passes: all have Apple markers
  - Gate 1 passes: root is pinned
  - But leaf is not signed by intermediate → signature verification will fail
- **Implementation requirement:**
  ```
  For i = 0 to len(certs)-2:
    issuerKey = extractPublicKey(certs[i+1])  // Get next cert's issuer public key
    signature = certs[i].signature  // Get this cert's signature bytes
    tbsCertificate = certs[i].tbsCertificate  // What was signed
    verify(ECDSA, issuerKey, signature, tbsCertificate)  // Must pass
  ```
- **Current blocker:** Requires parsing DER structure to extract:
  - Certificate signature bytes (in DER, this is in the last field of Certificate ::= SEQUENCE)
  - TBS (To-Be-Signed) certificate data (needs to be extracted before signature)
  - Issuer public key from next certificate
- **Recommended solution:** Use @peculiar/x509 library
  ```typescript
  import { X509Certificate } from "npm:@peculiar/x509";
  
  // Parse certificate
  const cert = new X509Certificate(certDER);
  
  // Check issuer/subject matching
  console.log(cert.issuer, cert.subject, cert.publicKey);
  
  // Verify signature (if library provides it)
  const isValid = cert.verify(issuerPublicKey);
  ```

### Gate 4: Temporal Validity ❌ BLOCKER
- **What it does:** Verifies each certificate is within its validity period
- **Why it's needed:** Prevents expired or revoked certificates from being used
- **Dates to check:**
  - Apple Root CA G3: valid 2024-05-08 to 2029-05-08
  - Each intermediate: check notBefore <= now <= notAfter
  - Leaf certificate: check notBefore <= now <= notAfter
- **Implementation requirement:**
  ```
  For each certificate:
    validity = parse(cert.validity)  // Validity ::= SEQUENCE { notBefore, notAfter }
    notBefore = parseTime(validity.notBefore)  // UTCTime or GeneralizedTime
    notAfter = parseTime(validity.notAfter)
    if now < notBefore or now > notAfter:
      reject()  // Certificate is not yet valid or has expired
  ```
- **Current blocker:** DER parsing is complex because:
  - Times can be UTCTime (13 bytes) or GeneralizedTime (15 bytes)
  - Need to find the Validity SEQUENCE in the TBSCertificate
  - Must handle both formats correctly
- **Recommended solution:** Use @peculiar/x509 library
  ```typescript
  import { X509Certificate } from "npm:@peculiar/x509";
  
  const cert = new X509Certificate(certDER);
  const now = new Date();
  
  if (now < cert.notBefore || now > cert.notAfter) {
    console.error("Certificate outside validity period");
    return false;  // REJECT
  }
  ```

## Why @peculiar/x509 is the Right Choice

1. **Correctness:** Handles all X.509 edge cases (multiple time formats, extensions, etc.)
2. **Crypto-safe:** Properly extracts data for signature verification
3. **Industry standard:** Used by many Node.js projects for certificate validation
4. **License:** MIT (compatible)
5. **Availability:** Available on JSR and npm (Deno supports both)

## Implementation Steps (Next Iteration)

### Step 1: Add dependency
Create `supabase/functions/apple-iap-webhook/deno.json`:
```json
{
  "imports": {
    "@peculiar/x509": "npm:@peculiar/x509@4.0.0"
  }
}
```

### Step 2: Implement Gate 3 (Cryptographic chain)
```typescript
async function verifyChainSignatures(x5c: string[]): Promise<boolean> {
  const certs = x5c.map(cert => new X509Certificate(Buffer.from(cert, "base64")));
  
  // Verify each certificate is signed by the previous
  for (let i = 0; i < certs.length - 1; i++) {
    const childCert = certs[i];
    const issuerCert = certs[i + 1];
    
    // Get issuer public key
    const issuerKey = await issuerCert.publicKey.export("spki");
    const issuerCryptoKey = await crypto.subtle.importKey(
      "spki",
      issuerKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    
    // Verify child signature
    // X509Certificate has methods to help with this
    // May need to extract signature + tbs certificate manually
    const isValid = await crypto.subtle.verify(
      "ECDSA",
      issuerCryptoKey,
      childCert.signature,  // Get from cert object
      childCert.tbsCertificate  // Get TBS data
    );
    
    if (!isValid) {
      console.error(`[JWS] Certificate ${i} not signed by ${i+1}: REJECT`);
      return false;
    }
  }
  
  return true;
}
```

### Step 3: Implement Gate 4 (Temporal validity)
```typescript
function checkTemporalValidity(x5c: string[]): boolean {
  const certs = x5c.map(cert => new X509Certificate(Buffer.from(cert, "base64")));
  const now = new Date();
  
  for (let i = 0; i < certs.length; i++) {
    const cert = certs[i];
    
    if (now < cert.notBefore) {
      console.error(`[JWS] Certificate ${i} not yet valid: REJECT`);
      return false;
    }
    
    if (now > cert.notAfter) {
      console.error(`[JWS] Certificate ${i} has expired: REJECT`);
      return false;
    }
  }
  
  console.log("[JWS] ✓ All certificates within validity period");
  return true;
}
```

### Step 4: Integrate into validateCertificateChain()
Replace the TODO comments with actual calls to `verifyChainSignatures()` and `checkTemporalValidity()`.

### Step 5: Test
- Test 9 should fail (self-signed cert rejected by chain verification)
- Test 10 should fail (missing x5c rejected)
- Add test with expired certificate (temporal check)
- Add test with valid Apple chain (all gates pass)

## Security Impact

**Without Gates 3-4:** The signature verification in `validateJWS()` can still pass because:
- The leaf certificate has a valid ES256 public key
- The signature could be valid (attacker crafted)
- Expiration is not checked

**With Gates 3-4:** Full chain validation ensures:
- Signature comes from Apple (verified by root pinning + chain verification)
- Certificate has not expired
- Complete defense against spoofing

## Deployment Note

Do NOT deploy to production until all 4 gates are implemented and tested.
Current code is in "partial security" state suitable only for development.
