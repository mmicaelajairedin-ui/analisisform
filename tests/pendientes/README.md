# tests/pendientes — cobertura que NO se ejecuta

Lo que hay aquí **no está resuelto ni descartado**: son tests que no se pueden
ejecutar todavía. Hay **dos motivos distintos** para estar aquí, y conviene no
mezclarlos.

**Motivo 1 · rompían la batería entera.** Playwright carga todos los ficheros de
test antes de correr ninguno. Si **uno solo** falla al cargarse, aborta el
descubrimiento completo y devuelve `Total: 0 tests in 0 files`. No se salta el
fichero malo: no arranca nada. Desde el **2026-08-10** y durante once días el
testing diario no ejecutó ni un test, y el correo siguió llegando en
`✅ SALUDABLE`, porque con cero tests `failed === 0`. Es **INC-026**.

**Motivo 2 · no pueden pasar en CI y ensucian el informe.** Cargan bien, pero
fallan todos los días por algo que en CI no existe. Un rojo permanente que nadie
puede arreglar enseña a ignorar el informe — que es la misma enfermedad de
INC-026 por el otro lado.

| Fichero | Motivo | Por qué no se ejecuta | Qué le falta |
|---|---|---|---|
| `test-err-app-004-apple-signin.manual.js` | 1 | Sintaxis TypeScript (`window as any`) en un `.js` → `SyntaxError` | Quitar el TS o pasar a `.spec.ts`, **y** dejar de apuntar a `localhost:5173` |
| `backend-phase-2a-staging.manual.js` | 1 | `describe`/`it` de Jest sin ningún import → `ReferenceError: describe is not defined` | Portarlo a `test.describe`/`test`, **y** un `TEST_OWNER_JWT` en los secrets |
| `e2e-sprint-equipo.manual.js` | 2 | Apunta a `http://127.0.0.1:8000/multicoach.html`; en CI no hay servidor ahí → 8× `ERR_CONNECTION_REFUSED` | Un servidor en el 8000, **y** actualizar sus anclas —`data-section="equipo"`, `data-member-row` y `submitAddPerson` ya no existen en `multicoach.html`—, **y** decidir si puede pegarle a la API real 8 veces al día |

> **`e2e-sprint-equipo` nunca ha pasado en CI**, ni una vez: entró el 2026-08-05
> (`2fb7011e`) y el workflow no ha tenido nunca un paso que sirva el puerto 8000
> — `git log -S"8000"` sobre `daily-testing-agent.yml` sale vacío. La cobertura
> que promete —alta de miembros, roles, reasignación de clientes, aislamiento
> por organización— **hoy no existe**, y por eso el fichero se conserva entero
> en vez de borrarse.

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
