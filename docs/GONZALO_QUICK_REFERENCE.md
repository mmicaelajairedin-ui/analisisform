# Quick Reference for Gonzalo — Durante la Mac Phase

**Imprime esto o ten abierto en tu segundo monitor.**

---

## 🚀 Start Here (Day 1 Morning)

```bash
# Terminal commands
cd ~/Developer
git clone https://github.com/mmicaelajairedin-ui/analisisform.git
cd analisisform
git checkout feature/capgo-iap-integration
npm install
npx cap open ios   # Opens Xcode
```

**Verify:**
```bash
npm list @capgo/native-purchases  # Should be v8.7.0
git log --oneline -1               # Should be 3cb87b7
```

---

## ☑️ Xcode Checklist (Before Build)

| Item | Expected Value | Status |
|---|---|---|
| Bundle ID | `com.pathwaycareercoach.twa` | ☐ |
| Team | Your Apple Developer Team | ☐ |
| In-App Purchase | Enabled in Signing & Capabilities | ☐ |
| Device Selected | Your iPhone/iPad (not Simulator) | ☐ |
| Console Message | `[PW_STOREKIT] ✅ Bootstrap complete` | ☐ |

---

## 🛍️ App Store Connect (Exact Product IDs)

Copy-paste these to avoid typos:

```
Product 1:
coach.plan.basic.monthly
$29/month
Basic Plan

Product 2:
coach.plan.pro.monthly
$59/month
Pro Plan
```

**When both are "Ready to Submit" or "Approved":**
- Get Shared Secret (copy full string, no truncation)
- Create sandbox tester: `test-coach-1@example.com`

---

## 📱 Device Testing Flow

### Sandbox Tester Credentials
```
Email:    test-coach-1@example.com
Password: [From App Store Connect]
```

### Testing Steps
1. Open app → Login works? ✓
2. Go to Plans → See both plans? ✓
3. Tap "Buy Basic" → Apple sheet appears? ✓
4. Approve with Face ID/password → "This is a test" banner? ✓
5. Success screen appears? ✓
6. Check Supabase for subscription data ✓

### Check Supabase (SQL)
```sql
SELECT email, configuracion 
FROM usuarios 
WHERE email LIKE 'test-coach%';
```

Look for:
```
configuracion → iap_subscriptions → [
  { productId: "coach.plan.basic.monthly", status: "ACTIVE" }
]
```

---

## 🔧 Console Log Cheatsheet

Look for these in Xcode Console output:

| Log | Means |
|---|---|
| `[PW_STOREKIT] Initializing StoreKit 2...` | Bootstrap starting |
| `[PW_STOREKIT] ✅ Initialized` | Capacitor plugin loaded |
| `[PW_STOREKIT] ✅ Bootstrap complete` | Ready for purchases |
| `[PW_CAPGO_IAP] Starting purchase: coach...` | Purchase initiated |
| `[PW_STOREKIT] Receipt verified: { hasAccess: true }` | ✅ Purchase successful |
| ❌ `[PW_STOREKIT] Init error:` | Capacitor plugin failed |
| ❌ `[PW_CAPGO_IAP] Purchase error:` | Purchase validation failed |

---

## 🚨 Quick Fixes

### "Product not found" when tapping Buy
1. Check Product IDs in App Store Connect (exact match)
2. Wait 15+ minutes after creating products (Apple propagates slowly)
3. Verify Bundle ID matches App Store Connect

### App crashes on launch
```bash
npx cap sync ios
Cmd+B  # Clean build
```

### "In-App Purchase capability not enabled"
1. Xcode → Targets → Signing & Capabilities
2. Click **+** → "In-App Purchase"
3. Build again

### Sandbox purchase hangs at Apple sheet
1. Check network (wifi/cellular)
2. Sign out of App Store, sign back in
3. Retry purchase

---

## 📦 Build Release Flow

**When sandbox testing is DONE:**

```bash
# 1. Increment version
Xcode → General → Version: 1.0.1
Xcode → General → Build: 6 (or next number)

# 2. Select device
Toolbar dropdown → Any iOS Device (arm64)

# 3. Archive
Cmd+Shift+K       # Clean
Cmd+B             # Build
Cmd+Shift+B       # Archive

# 4. Upload to TestFlight (from Organizer window)
Click "Distribute App" → "App Store Connect" → "Upload"

# 5. Verify in App Store Connect
Apps → TestFlight → iOS Builds → Look for Build 6
```

---

## 📞 Tell Micaela (When TestFlight Ready)

```
✅ Build 6 ready for TestFlight

Build #: 6
App Version: 1.0.1
Bundle ID: com.pathwaycareercoach.twa
Shared Secret: [PASTE FROM APP STORE CONNECT]

Sandbox testing: PASS ✅
- Login works
- Plans visible
- Purchase completes
- Supabase gets subscription data

Next:
You activate Edge Functions (change if: false → if: true)
Then I do final testing
```

---

## 📚 Documentation Files (for reference)

| File | Use When |
|---|---|
| `IAP_XCODE_GONZALO_GUIDE.md` | Understand IAP architecture |
| `CAPGO_SETUP_GUIDE.md` | Deep dive on @capgo setup |
| `APP_TSX_INTEGRATION.md` | Understand how app boots StoreKit 2 |
| `GONZALO_MACOS_STEPS.md` | Step-by-step walkthrough (this reference is shorter) |

---

## ⏱️ Time Estimates

| Task | Time | Blocker |
|---|---|---|
| Clone + setup | 15 min | Internet |
| Xcode config | 10 min | None |
| App Store Connect | 20 min | Apple account |
| First build + device | 30 min | iPhone + cable |
| Sandbox purchase test | 20 min | Sandbox tester |
| Build release | 15 min | Disk space |
| TestFlight upload | 10 min | Internet |

**Total: ~2 hours if smooth, 3-4 if debugging**

---

## 🎯 Success Criteria

Before telling Micaela:

- [ ] Build 6 in TestFlight (shows "Ready to Test")
- [ ] Sandbox purchase tested on real device
- [ ] Supabase has subscription data
- [ ] No crashes in console
- [ ] App signs with correct Team ID
- [ ] Shared Secret copied and ready

---

## 🆘 Emergency Contacts

| Issue | Check |
|---|---|
| Xcode won't compile | `xcode-select --install` |
| Pods error | `cd ios && rm -rf Pods Podfile.lock && pod install && cd ..` |
| Device not recognized | Try different USB cable, restart Xcode |
| Apple ID issues | developer.apple.com → Certificates → regenerate if needed |
| Supabase empty after purchase | Verify `check-entitlement` function deployed |

---

## 🔐 Keep Safe

DO NOT COMMIT:
- Sandbox tester password ❌
- Shared Secret ❌
- Certificates/provisioning profiles ❌

Give to Micaela via private message/email.

---

**Shortcuts:**
- `Cmd+B` = Build
- `Cmd+R` = Build & Run
- `Cmd+Shift+K` = Clean
- `Cmd+Shift+B` = Archive
- `Cmd+Shift+,` = Preferences

---

**You got this! 🚀**
