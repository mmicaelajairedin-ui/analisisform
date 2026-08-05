# Configuración de Google OAuth para iOS

**Fecha de creación**: 2026-08-05

## Credenciales de Google Cloud

- **Client ID**: `496232899827-0j8vj9s1e17etnc981m20i9eh7rquikc.apps.googleusercontent.com`
- **iOS URL Scheme**: `com.googleusercontent.apps.496232899827-0j8vj9s1e17etnc981m20i9eh7rquikc`
- **Bundle ID**: `com.pathwaycareercoach.twa`
- **ID de App Store**: `6794303994`
- **ID de Equipo Apple**: `R9947N4M9S`

## Configuración en Xcode (Info.plist)

Agregar en `Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>com.googleusercontent.apps.496232899827-0j8vj9s1e17etnc981m20i9eh7rquikc</string>
    </array>
  </dict>
</array>
```

## Configuración en capacitor.config.json

En la sección `plugins.GoogleAuth`:

```json
{
  "plugins": {
    "GoogleAuth": {
      "scopes": ["profile", "email"],
      "serverClientId": "496232899827-0j8vj9s1e17etnc981m20i9eh7rquikc.apps.googleusercontent.com",
      "forceRefreshToken": true
    }
  }
}
```

## Notas

- El código en `login.html` ya está preparado para usar el plugin GoogleAuth nativo
- La función `signInWithGoogle()` detecta iOS y usa el plugin nativo en lugar de abrir Safari
- Los datos se almacenan en localStorage y se pasan a `auth-callback.html?google_native=1`
- En `auth-callback.html`, el flujo `google_native` usa `sb.auth.signInWithIdToken()` para crear la sesión autenticada

## Referencias

- Google Cloud Console: https://console.cloud.google.com/apis/credentials?project=pathway-career-coach
- Plugin Capacitor GoogleAuth: https://github.com/codetrixdev/capacitor-google-auth
