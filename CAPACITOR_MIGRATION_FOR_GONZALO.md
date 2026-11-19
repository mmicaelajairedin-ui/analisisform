# Capacitor 8.5+ Migration — Instrucciones para Gonzalo

**Rama:** `claude/investigate-capacitor-uiscene`  
**Base:** Commit `3913ccb`  
**Cambios:** package.json actualizado + AppDelegate.swift y SceneDelegate.swift nuevos

## El Problema

Con Xcode 27 e iOS SDK 27, la app se cierra al abrir con:
```
EXC_BREAKPOINT NoSceneLifecycleAdoption
```

**Causa:** Capacitor 6.2.1 no soporta UIScene. iOS 15+ exige UIScene nativo.

**Solución:** Migrar a Capacitor 8.5+ que tiene UIScene built-in.

## Qué Cambió en la Rama

### 1. package.json
- Agregado: `@capacitor/core@^8.5.0`
- Agregado: `@capacitor/ios@^8.5.0`
- Actualizado: `@capgo/native-purchases` de `6.0.42` a `^7.0.0`
- Agregado: `@capacitor/cli@^8.5.0` (devDependencies)

### 2. iOS AppDelegate (nuevo)
- **Archivo:** `ios/App/App/AppDelegate.swift`
- **Cambio:** Ahora usa `@main` decorator (Capacitor 8.5+)
- **Cambio:** Incluye `UISceneConfiguration` y `didDiscardSceneSessions`
- **Resultado:** Capacitor 8.5+ maneja el ciclo de vida

### 3. iOS SceneDelegate (nuevo)
- **Archivo:** `ios/App/App/SceneDelegate.swift` (NUEVO)
- **Propósito:** Maneja `UIWindowScene` lifecycle
- **Setup:** `webView` + `ViewController` + `UIWindow`
- **Resultado:** UIScene adoption completo

### 4. Info.plist (necesario pero NO preparado aún)
- Será necesario agregar UIApplicationSceneManifest
- Verás la configuración en Xcode cuando sincronices

## Pasos para Compilar

### Paso 1: Sincronizar rama
```bash
git checkout claude/investigate-capacitor-uiscene
git pull origin claude/investigate-capacitor-uiscene
```

### Paso 2: Instalar dependencias (npm)
```bash
npm install
```
⚠️ **Esto puede fallar sin CocoaPods.** Si falla, verifica:
```bash
pod --version
```

### Paso 3: Sincronizar Capacitor
```bash
npx cap sync ios
```
⚠️ **Esto actualiza ios/App/Podfile** y puede sobrescribir cambios.

### Paso 4: Abrir Xcode
```bash
npx cap open ios
# O manualmente:
open ios/App/App.xcworkspace
```

### Paso 5: Compilar
1. En Xcode: Product → Build (⌘B)
2. Si hay errores de Swift: Xcode puede pedir actualizar syntax
3. Si falla CocoaPods: `pod install` en `ios/App/`

### Paso 6: Verificar que el problema desapareció
1. Run en simulador (Cmd+R)
2. App debe abrir sin `EXC_BREAKPOINT`
3. Verificar que no haya other errors en la consola

### Paso 7: Validar StoreKit 2
1. En simulador, ir a CoachPlans screen
2. Intentar una compra: debe mostrar StoreKit dialog
3. Validar que `appAccountToken` se envía
4. Validar que `check-entitlement` responde

## Qué Puede Ir Mal

### Error 1: CocoaPods no instala
```
[!] The dependency target `Capacitor` does not contain the source files for the architecture(s) `arm64`
```

**Solución:**
```bash
cd ios/App
rm -rf Pods
pod repo update
pod install
```

### Error 2: Swift Syntax Error
```
Swift compiler error: Type 'CapacitorWebView' cannot be found
```

**Causa:** Capacitor 8.5+ cambió nomenclatura. Es `CAPWebView` ahora.

**Solución:** Busca `CapacitorWebView` en SceneDelegate.swift y reemplaza por `CAPWebView`.

### Error 3: Info.plist no tiene UIApplicationSceneManifest
```
App will be terminated because the app delegate did not return a view controller from the window
```

**Causa:** `npx cap sync` debe haber agregado esto. Si no, ágrégalo a mano:

En Xcode:
1. Info.plist → Click derecho → Open as Source Code
2. Agrega antes de `</dict>`:
```xml
<key>UIApplicationSceneManifest</key>
<dict>
    <key>UIApplicationSupportsMultipleScenes</key>
    <false/>
    <key>UISceneConfigurations</key>
    <dict>
        <key>UIWindowSceneSessionRoleApplication</key>
        <array>
            <dict>
                <key>UISceneConfigurationName</key>
                <string>Default Configuration</string>
                <key>UISceneDelegateClassName</key>
                <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
            </dict>
        </array>
    </dict>
</key>
```

### Error 4: CoachPlansViewModel.swift conflictea
```
Compilation error: Multiple definitions of class 'CoachPlansViewModel'
```

**Causa:** Handoff v2 incluyó un CoachPlansViewModel.swift antiguo. Tienes archivos duplicados.

**Solución:** 
1. Verifica qué CoachPlansViewModel.swift tienes en Xcode
2. Mantén el de tu Build 6 (el más reciente)
3. Elimina el antiguo del Handoff v2
4. Product → Clean Build Folder (⇧⌘K)
5. Rebuil (⌘B)

## Proceso de Testing

Una vez que compile sin errores:

1. **Funciona la App?** (no crash)
   - [ ] App abre sin `EXC_BREAKPOINT`
   - [ ] Dashboard se ve normal
   - [ ] No hay logs de error en Xcode

2. **Funciona StoreKit 2?**
   - [ ] IR a CoachPlans screen
   - [ ] Intentar comprar Basic ($29.99)
   - [ ] StoreKit dialog aparece
   - [ ] Puedo tap "Purchase"

3. **Se registra la compra?**
   - [ ] Después de purchase, ir a backend logs
   - [ ] `apple-iap-webhook` debe recibir `notification.signedPayload`
   - [ ] `usuarios_suscripciones_iap` debe tener una fila new

4. **Funciona `check-entitlement`?**
   - [ ] En la app, llamar `window.checkCurrentEntitlement()`
   - [ ] Debe responder con `{hasAccess: true, ...}`

## Datos para Reportar

Cuando termines, necesito:

1. **¿Compiló sin errores?**
   - [ ] Sí
   - [ ] No, error: _______________

2. **¿La app abre?**
   - [ ] Sí, sin `EXC_BREAKPOINT`
   - [ ] No, error: _______________

3. **¿StoreKit funciona?**
   - [ ] Sí, dialog apareció
   - [ ] No, error: _______________

4. **¿Logs de Xcode?**
   - [ ] Limpios (ningún error)
   - [ ] Con warnings (OK)
   - [ ] Con errors: _______________

5. **¿iap-webhook recibió evento?**
   - [ ] Sí, en Supabase logs
   - [ ] No, check si endpoint es reachable

6. **¿users_suscripciones_iap tiene fila?**
   - [ ] Sí
   - [ ] No

## Siguiente Paso

Una vez que todo funcione:
1. Haz push a esta rama
2. Mándame el output de:
   - Build log (Product → Perform Action → Build For → Testing)
   - Console logs de test run
3. Yo mergeo a main y hacemos PR

---

**Preguntas?** Mándame un Slack si encuentras algo que no coincida con estas instrucciones.

