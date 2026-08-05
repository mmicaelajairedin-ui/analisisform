# Action Bus Architecture v3.0

**Status:** CONGELADO  
**Version:** 3.0 (con Feature, Plan, Niche)  
**Horizonte:** 12+ meses  
**Objetivo:** Puerta única para TODAS las acciones del producto

---

## Los 3 Pilares

### Pilar 1: PATHWAY-ROADMAP.md (Maestro)
Define QUÉ construir y cuándo.
- ✅ Core (congelado)
- ⏳ Billing, Branding, Dominios
- ⏳ Agenda, Programas
- ⏳ Analytics, Comunidad, IA, Automatizaciones

### Pilar 2: action-inventory.csv (Contrato)
Define CÓMO construirlo y qué reglas aplican.
- 42 acciones documentadas (Core + futuro)
- Cada acción: Feature, Plan, Niche, Permission, Handler, Before, After
- Inventario = especificación técnica + negocio

### Pilar 3: ACTION BUS (Ejecución)
Valida y ejecuta cada acción.
- Tipado 100% (constantes, no strings)
- Valida: Permiso + Plan + Niche
- Desacoplado: UI ↔ Bus ↔ Handler

---

## Arquitectura Técnica

### Constantes Tipadas

```javascript
const Modules = Object.freeze({
  TEAM: 'team',
  CLIENTS: 'clients',
  SCHEDULE: 'schedule',
  PROGRAMS: 'programs',
  BILLING: 'billing',
  BRANDING: 'branding',
  AUTOMATION: 'automation',
  ANALYTICS: 'analytics',
  COMMUNITY: 'community',
  AI: 'ai',
});

const Scopes = Object.freeze({
  ORGANIZATION: 'organization',
  GLOBAL: 'global',
  SELF: 'self',
});

const Actions = Object.freeze({
  TEAM_INVITE: 'team.invite',
  TEAM_EDIT: 'team.edit',
  TEAM_REMOVE: 'team.remove',
  CLIENT_CREATE: 'client.create',
  PROGRAM_CREATE: 'program.create',
  DOMAIN_CUSTOM: 'domain.custom',
  // ... 42 acciones totales
});

const Permissions = Object.freeze({
  TEAM_INVITE: 'team.invite',
  TEAM_EDIT: 'team.edit',
  TEAM_REMOVE: 'team.remove',
  CLIENT_CREATE: 'client.create',
  // ... corresponden a Actions
});
```

### Context Type

```javascript
class ActionContext {
  constructor(params, user, orgId, actionKey) {
    this.params = params;           // Entrada
    this.user = user;               // ME (tipado)
    this.orgId = orgId;             // currentOrgId
    this.action = actionKey;        // Actions.TEAM_INVITE
    this.timestamp = Date.now();
  }
}
```

### Result Type

```javascript
class ActionResult {
  constructor(ok, data = {}, error = null, message = '') {
    this.ok = ok;
    this.data = data;              // Retorno del handler
    this.error = error;            // { code, details }
    this.message = message;        // User-facing
    this.timestamp = Date.now();
  }

  static success(data = {}, message = '') { ... }
  static failure(error, message = '') { ... }
  static permission(message = '') { ... }
  static cancelled() { ... }
}
```

### Action Bus

```javascript
class ActionBus {
  static async dispatch(actionKey, params = {}) {
    // 1. Validar acción existe
    const config = ACTION_BUS[actionKey];
    if (!config) return ActionResult.failure(...);

    // 2. Validar permiso
    if (!canAction(ME, config.permission)) {
      return ActionResult.permission(...);
    }

    // 3. Validar PLAN (NUEVO)
    if (!this._isAllowedByPlan(ME, config.plan)) {
      return ActionResult.failure(
        { code: 'PLAN_LIMIT' },
        `Requiere plan ${config.plan}`
      );
    }

    // 4. Validar NICHE (NUEVO)
    if (!this._isAllowedByNiche(ME, config.niche)) {
      return ActionResult.failure(
        { code: 'NICHE_NOT_SUPPORTED' },
        `No disponible en tu nicho`
      );
    }

    // 5. Pedir confirmación (si aplica)
    if (config.confirmation) {
      const confirmed = await this._promptConfirmation(...);
      if (!confirmed) return ActionResult.cancelled();
    }

    // 6. Crear contexto
    const ctx = new ActionContext(params, ME, currentOrgId, actionKey);

    // 7. Before hook
    if (config.before) {
      try {
        await config.before(ctx);
      } catch (e) {
        return ActionResult.failure(
          { code: 'VALIDATION_ERROR' },
          e.message
        );
      }
    }

    // 8. Handler
    const data = await config.handler(ctx);

    // 9. After hook
    if (config.after) {
      await config.after(ctx);
    }

    // 10. Auditoría
    if (config.audit) {
      Audit.record({
        userId: ME.id,
        orgId: currentOrgId,
        action: actionKey,
        module: config.module,
        scope: config.scope,
        params: params,
        result: 'success'
      });
    }

    // 11. Analítica
    if (config.analytics?.track) {
      Analytics.track({
        category: config.analytics.category,
        event: config.analytics.event,
        module: config.module
      });
    }

    return ActionResult.success(data, config.label + ' completada');
  }

  static _isAllowedByPlan(user, plan) {
    const allowed = this._parsePlans(plan);
    return allowed.includes(user.plan);
  }

  static _isAllowedByNiche(user, niche) {
    const allowed = this._parseNiches(niche);
    return allowed.includes('All') || allowed.includes(user.niche);
  }

  static _parsePlans(planString) {
    // "Pro+" → ["Pro", "Boutique", "Enterprise"]
    const mapping = {
      'Free+': ['Free', 'Pro', 'Boutique', 'Enterprise'],
      'Pro+': ['Pro', 'Boutique', 'Enterprise'],
      'All': ['Free', 'Pro', 'Boutique', 'Enterprise'],
    };
    return mapping[planString] || [planString];
  }

  static _parseNiches(nicheString) {
    return nicheString.split('/'); // "Career/Fitness" → ["Career", "Fitness"]
  }
}
```

### Registry

```javascript
const ACTION_BUS = Object.freeze({
  [Actions.TEAM_INVITE]: {
    feature: Features.TEAM,
    plan: 'Pro+',
    niche: 'All',
    module: Modules.TEAM,
    scope: Scopes.ORGANIZATION,
    label: 'Invitar miembro al equipo',
    permission: Permissions.TEAM_INVITE,
    confirmation: true,
    confirmationText: '¿Invitar a {email}?',
    before: null,
    handler: handleTeamInvite,
    after: refreshTeamAndStats,
    audit: true,
    analytics: { track: true, category: 'team', event: 'member_invited' }
  },

  [Actions.PROGRAM_CREATE]: {
    feature: Features.PROGRAMS,
    plan: 'Pro+',
    niche: 'Career/Fitness/Finance',
    module: Modules.PROGRAMS,
    scope: Scopes.ORGANIZATION,
    label: 'Crear programa',
    permission: Permissions.PROGRAM_CREATE,
    confirmation: false,
    before: null,
    handler: handleProgramCreate,
    after: refreshProgramsList,
    audit: true,
    analytics: { track: true, category: 'programs', event: 'program_created' }
  },

  [Actions.DOMAIN_CUSTOM]: {
    feature: Features.BRANDING,
    plan: 'Enterprise',
    niche: 'All',
    module: Modules.BRANDING,
    scope: Scopes.ORGANIZATION,
    label: 'Configurar dominio custom',
    permission: Permissions.DOMAIN_ADD,
    confirmation: false,
    before: validateDomain,
    handler: handleDomainSetup,
    after: refreshDomains,
    audit: true,
    analytics: { track: true, category: 'branding', event: 'domain_added' }
  },
  // ... 42 acciones totales
});
```

---

## Reglas de Negocio

### Plan Enforcement

```javascript
// Coach en plan Free NO puede:
dispatch(Actions.TEAM_INVITE)      // Pro+ required
dispatch(Actions.CLIENT_ASSIGN_COACH)  // Pro+ required
dispatch(Actions.PROGRAM_CREATE)   // Pro+ required

// Coach en plan Enterprise PUEDE:
dispatch(Actions.COLLABORATOR_INVITE)  // Enterprise only
dispatch(Actions.BRAND_CHANGE_LOGO)    // Enterprise only
dispatch(Actions.DOMAIN_CUSTOM)        // Enterprise only
```

### Niche Enforcement

```javascript
// Coach en nicho Career PUEDE:
dispatch(Actions.PROGRAM_CREATE)  // niche: Career/Fitness/Finance ✓

// Coach en nicho Healthcare NO PUEDE:
dispatch(Actions.PROGRAM_CREATE)  // niche: Career/Fitness/Finance ✗
// Result { ok: false, error: 'NICHE_NOT_SUPPORTED' }
```

---

## IDs Estables para Auditoría

```javascript
// NUNCA cambiar el valor interno (IDs históricas)
Actions.TEAM_INVITE = 'team.invite'  // Locked forever

// SÍ puede cambiar el label (label no es histórico)
ACTION_BUS[Actions.TEAM_INVITE].label = 'Invitar coach al equipo'  // ✓
```

**Por qué:** Auditoría histórica debe ser coherente.
```sql
SELECT COUNT(*) FROM audit_logs WHERE action = 'team.invite'
// Funciona siempre, desde el inicio de los tiempos
```

---

## Guía de Desarrollo

### Para agregar una nueva acción:

1. Actualizar `action-inventory.csv`:
   - Agregar fila con Action, Feature, Plan, Niche, Permission, etc.

2. Actualizar `const Actions`:
   - `PROGRAM_CREATE: 'program.create'` (ID inmutable)

3. Actualizar `const Permissions`:
   - `PROGRAM_CREATE: 'program.create'` (corresponde a Action)

4. Registrar en `ACTION_BUS`:
   - Todos los fields: module, scope, label, permission, plan, niche, handler, before, after, audit, analytics

5. Implementar handler:
   ```javascript
   async function handleProgramCreate(ctx) {
     // ctx = { params, user, orgId, action, timestamp }
     // No acceder a ME, currentOrgId globales
     const { programName, niche } = ctx.params;
     const { user, orgId } = ctx;
     
     return await createProgram({ programName, niche, org_id: orgId, created_by: user.id });
   }
   ```

6. Implementar before/after (si aplica):
   ```javascript
   async function validateProgramCapacity(ctx) {
     // Validación: ¿hay lugar para más programas?
     // Si falla, throw error
   }

   async function refreshProgramsList(ctx) {
     // Post: recargar lista
     await loadPrograms();
     renderPrograms();
   }
   ```

---

## Guardrail: Prohibir Strings

```javascript
// check-guardrails.js
// ❌ dispatchAction('team.invite')
// ✅ dispatchAction(Actions.TEAM_INVITE)

const dispatchRegex = /dispatchAction\(\s*["'`](.+?)["'`]\s*\)/g;
if (multicoachHtml.match(dispatchRegex)) {
  throw new Error('[guardrail] String directo en dispatchAction. Usa Actions.XXX');
}
```

---

## Checklist Implementación

### Día 0 ✅
- [x] Generar action-inventory.csv (17 Core + preview)
- [x] Crear PATHWAY-ROADMAP.md (11 features)
- [x] Crear esta doc (ACTION-BUS-ARCHITECTURE.md)

### Día 1 (próximo)
- [ ] Crear constantes tipadas (Actions, Modules, Scopes, Permissions, Features)
- [ ] Crear tipos (ActionContext, ActionResult)
- [ ] Crear Action Bus v3.0
- [ ] Crear Audit y Analytics classes
- [ ] Crear guardrail de strings
- [ ] Encapsular 3 handlers de prueba

### Día 2-4
- [ ] Migración Equipo (6 acciones)
- [ ] Migración Clientes (6 acciones)
- [ ] Validación automática
- [ ] Documentación
- [ ] Commit final

---

**CONGELADO — Listo para implementación Día 1**
