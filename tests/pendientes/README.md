# tests/pendientes — cobertura que NO se ejecuta

Lo que hay aquí **no está resuelto ni descartado**: son tests que no se pueden
ejecutar todavía y que estaban **rompiendo la batería entera**.

Playwright carga todos los ficheros de test antes de correr ninguno. Si **uno
solo** falla al cargarse, aborta el descubrimiento completo y devuelve
`Total: 0 tests in 0 files`. No se salta el fichero malo: no arranca nada.

Eso es lo que pasó aquí. Desde el **2026-08-10** y durante once días el testing
diario no ejecutó ni un test, y el correo siguió llegando en `✅ SALUDABLE`,
porque con cero tests `failed === 0`. Está registrado como **INC-026**.

| Fichero | Por qué no carga | Qué le falta |
|---|---|---|
| `test-err-app-004-apple-signin.manual.js` | Sintaxis TypeScript (`window as any`) en un `.js` → `SyntaxError` | Quitar el TS o pasar a `.spec.ts`, **y** dejar de apuntar a `localhost:5173` |
| `backend-phase-2a-staging.manual.js` | `describe`/`it` de Jest sin ningún import → `ReferenceError: describe is not defined` | Portarlo a `test.describe`/`test`, **y** un `TEST_OWNER_JWT` en los secrets |

## Reglas de esta carpeta

1. **La extensión es lo que los aparta, no la carpeta.** `testDir: './tests'`
   recorre subdirectorios: un `.spec.js` aquí dentro volvería a romper todo.
   Se quedan en `.manual.js`.
2. **Un fichero vuelve a la batería solo cuando puede pasar en CI**, no cuando
   compila. Que cargue no es que funcione.
3. **Antes de añadir un `.spec.js` nuevo**, comprobar que descubre:
   `npx playwright test --list` tiene que seguir diciendo el mismo número de
   ficheros más el tuyo. Si dice `0 tests in 0 files`, lo has roto entero.

## Ejecutarlos a mano

Renombrar a `.spec.js` en una copia local, cumplir lo que les falta según la
tabla, y `npx playwright test <ruta>`. **No** dejarlos renombrados en `main`.
