// ============================================================================
// Shared Permission Validation Helper — Phase 2 Backend Security
// ============================================================================
// Centralized permission checking for edge functions.
// Pattern: validatePermission(org_id, user_id, action, sbUrl, service_key)
//   → {allowed: true} | {allowed: false, reason: string}
//
// Actions supported:
// - LIST_ORG_DATA: list all coaches/clients/sessions (owner > coach > none)
// - CREATE_CITA: create appointment (owner unrestricted, coach/collab with permission)
// - ASSIGN_CLIENT: reassign client (owner only currently)
// - MANAGE_CHANNEL: create/edit channels (owner only)
// - SEND_MESSAGE: post to chat (org member with membership)
// ============================================================================

export type PermissionAction =
  | "LIST_ORG_DATA"
  | "CREATE_CITA"
  | "ASSIGN_CLIENT"
  | "MANAGE_CHANNEL"
  | "SEND_MESSAGE"
  | "MANAGE_COACHES"
  | "MANAGE_COLLABORATORS";

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  role?: string;
}

/**
 * Validate if a user can perform an action.
 * @param orgId The org_id to verify access to
 * @param userId The user's auth.uid() from JWT
 * @param action The action name (e.g., "LIST_ORG_DATA")
 * @param sbUrl Supabase URL
 * @param serviceKey Service role API key
 * @returns {allowed, reason?}
 */
export async function validatePermission(
  orgId: string,
  userId: string,
  action: PermissionAction,
  sbUrl: string,
  serviceKey: string,
): Promise<PermissionResult> {
  if (!orgId || !userId || !sbUrl || !serviceKey) {
    return { allowed: false, reason: "missing_params" };
  }

  try {
    // 1. Fetch the user and verify org membership
    const userResp = await fetch(
      `${sbUrl}/rest/v1/usuarios?id=eq.${encodeURIComponent(userId)}&org_id=eq.${encodeURIComponent(
        orgId,
      )}&select=id,rol,configuracion`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );

    if (!userResp.ok) {
      return { allowed: false, reason: "user_lookup_failed" };
    }

    const users = await userResp.json();
    if (!Array.isArray(users) || users.length === 0) {
      return { allowed: false, reason: "user_not_in_org" };
    }

    const user = users[0];
    const role = user.rol || "unknown";
    const config = user.configuracion || {};

    // 2. Check permission based on role and action
    switch (action) {
      case "LIST_ORG_DATA":
        // Owner: unrestricted
        if (role === "owner") {
          return { allowed: true, role };
        }
        // Coach: can list (filtered by own sessions/clients via RLS)
        if (role === "coach") {
          return { allowed: true, role };
        }
        // Collaborator: can list only if they have LIST_CLIENTS or similar
        if (
          role === "coach" &&
          config.member_role === "colaborador" &&
          config.permisos &&
          (config.permisos.CLIENT_VIEW || config.permisos.LIST_CLIENTS)
        ) {
          return { allowed: true, role };
        }
        return { allowed: false, reason: "insufficient_role", role };

      case "CREATE_CITA":
        // Owner: unrestricted
        if (role === "owner") {
          return { allowed: true, role };
        }
        // Coach: can create (RLS will enforce only their own)
        if (role === "coach") {
          return { allowed: true, role };
        }
        // Collaborator: only if they have CITA_CREATE permission
        if (
          role === "coach" &&
          config.member_role === "colaborador" &&
          config.permisos &&
          config.permisos.CITA_CREATE
        ) {
          return { allowed: true, role };
        }
        return { allowed: false, reason: "insufficient_role", role };

      case "ASSIGN_CLIENT":
        // Currently: owner only
        // Future: coach can assign their own clients if COLLAB_EDIT
        if (role === "owner") {
          return { allowed: true, role };
        }
        return { allowed: false, reason: "owner_only", role };

      case "MANAGE_CHANNEL":
        // Owner: unrestricted
        if (role === "owner") {
          return { allowed: true, role };
        }
        // Collaborator: only if they have CHANNEL_MANAGE
        if (
          role === "coach" &&
          config.member_role === "colaborador" &&
          config.permisos &&
          config.permisos.CHANNEL_MANAGE
        ) {
          return { allowed: true, role };
        }
        return { allowed: false, reason: "insufficient_role", role };

      case "SEND_MESSAGE":
        // Owner: unrestricted
        if (role === "owner") {
          return { allowed: true, role };
        }
        // Coach: can send (org member)
        if (role === "coach") {
          return { allowed: true, role };
        }
        // Collaborator: can send if org member
        if (role === "coach" && config.member_role === "colaborador") {
          return { allowed: true, role };
        }
        return { allowed: false, reason: "insufficient_role", role };

      case "MANAGE_COACHES":
        // Owner only
        if (role === "owner") {
          return { allowed: true, role };
        }
        return { allowed: false, reason: "owner_only", role };

      case "MANAGE_COLLABORATORS":
        // Owner only
        if (role === "owner") {
          return { allowed: true, role };
        }
        return { allowed: false, reason: "owner_only", role };

      default:
        return { allowed: false, reason: "unknown_action", role };
    }
  } catch (err) {
    console.error("[validatePermission] Error:", err);
    return { allowed: false, reason: "validation_error" };
  }
}

/**
 * Extract user ID from JWT token.
 * @param token JWT token (without "Bearer " prefix)
 * @param sbUrl Supabase URL
 * @param anonKey Anon API key
 * @returns user_id or null
 */
export async function getUserIdFromToken(
  token: string,
  sbUrl: string,
  anonKey: string,
): Promise<string | null> {
  if (!token || !sbUrl || !anonKey) return null;
  try {
    const r = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return (u && u.id ? String(u.id) : null) || null;
  } catch {
    return null;
  }
}

/**
 * Extract email from JWT token.
 * @param token JWT token (without "Bearer " prefix)
 * @param sbUrl Supabase URL
 * @param anonKey Anon API key
 * @returns email or null
 */
export async function getEmailFromToken(
  token: string,
  sbUrl: string,
  anonKey: string,
): Promise<string | null> {
  if (!token || !sbUrl || !anonKey) return null;
  try {
    const r = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!r.ok) return null;
    const u = await r.json();
    const em = (u && u.email ? String(u.email) : "").trim().toLowerCase();
    const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    return EMAIL_RE.test(em) ? em : null;
  } catch {
    return null;
  }
}

/**
 * Get user's org_id by email (convenience for existing callers).
 * @param email User email
 * @param sbUrl Supabase URL
 * @param serviceKey Service role key
 * @returns org_id or null
 */
export async function getOrgIdByEmail(
  email: string,
  sbUrl: string,
  serviceKey: string,
): Promise<string | null> {
  if (!email || !sbUrl || !serviceKey) return null;
  try {
    const r = await fetch(
      `${sbUrl}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}&select=org_id&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] ? rows[0].org_id : null) || null;
  } catch {
    return null;
  }
}
