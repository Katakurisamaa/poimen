"use server";

if (typeof process !== "undefined" && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { SUPER_ADMIN_EMAIL, inferContextType, normalizeFamilyRole } from "@/lib/auth-contexts";
import { isUuid, isFamilyLeader, validTeamInput, validObservationMemberInput } from "@/lib/security-validation";
import { DEFAULT_DISCIPLE_FAMILIES } from "@/lib/default-disciple-families";

type ResolvedAccess = {
  role: string;
  churchId: string;
  bergerieId: string;
  displayName: string;
  churchData: any;
  familyData: any;
};

function isDuplicateAuthUserError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists");
}

async function upsertUserContext(supabase: any, userId: string, email: string, access: ResolvedAccess, allowReactivation = false) {
  const contextType = inferContextType(access.role, access.bergerieId);

  let query = supabase
    .from("user_contexts")
    .select("*")
    .eq("user_id", userId)
    .eq("context_type", contextType)
    .eq("role", access.role);

  query = access.churchId ? query.eq("church_id", access.churchId) : query.is("church_id", null);
  query = access.bergerieId ? query.eq("bergerie_id", access.bergerieId) : query.is("bergerie_id", null);

  const { data: existing, error: lookupError } = await query.maybeSingle();
  if (lookupError) return { data: null, error: lookupError };
  if (existing?.active === false && !allowReactivation) {
    return { data: null, error: { message: "Cet accès a été désactivé. Contactez un responsable." } };
  }
  const payload = {
    user_id: userId,
    email,
    context_type: contextType,
    role: access.role,
    church_id: access.churchId || null,
    bergerie_id: access.bergerieId || null,
    display_name: access.displayName,
    active: true
  };

  if (existing?.id) {
    return supabase.from("user_contexts").update(payload).eq("id", existing.id).select().single();
  }

  return supabase.from("user_contexts").insert(payload).select().single();
}

async function createOrPreserveProfile(supabase: any, userId: string, email: string, access: ResolvedAccess) {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!existingProfile) {
    return supabase.from("profiles").insert({
      id: userId,
      email,
      display_name: access.displayName,
      role: access.role,
      church_id: access.churchId || null,
      bergerie_id: access.bergerieId || null,
      active: true
    });
  }

  return supabase
    .from("profiles")
    .update({
      email,
      display_name: existingProfile.display_name || access.displayName,
      church_id: existingProfile.church_id || access.churchId || null,
      bergerie_id: existingProfile.bergerie_id || access.bergerieId || null,
      active: existingProfile.active
    })
    .eq("id", userId);
}

async function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Configuration Supabase manquante sur le serveur.");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function findAuthUserByEmail(supabase: any, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;

    const found = data?.users?.find((u: any) => u.email?.toLowerCase().trim() === email);
    if (found) return found;
    if (!data?.users?.length || data.users.length < 100) break;
  }

  return null;
}

async function assertCanManageIntegrationTeam(churchId: string) {
  if (!isUuid(churchId)) return { ok: false, error: "Église invalide." };
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

  if (authErr || !user) {
    return { ok: false, error: "Non authentifie." };
  }

  const cleanEmail = user.email?.toLowerCase().trim();
  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    return { ok: true, user };
  }

  // Contexts are authoritative, including revocations and demotions.
  const { data: memberships, error: membershipError } = await serverSupabase.from("user_contexts")
    .select("role, active").eq("user_id", user.id).eq("church_id", churchId).eq("context_type", "integration");
  if (membershipError) return { ok: false, error: "Vérification des droits impossible." };
  if (memberships?.length) {
    return memberships.some(m => m.active && ["integration_responsable", "integration_second"].includes(m.role))
      ? { ok: true, user }
      : { ok: false, error: "Accès de gestion désactivé ou insuffisant." };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role, church_id")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  const role = profile?.role?.toLowerCase().trim();
  if ((role === "integration_responsable" || role === "integration_second") && profile?.church_id === churchId) {
    return { ok: true, user };
  }

  const { data: context } = await serverSupabase
    .from("user_contexts")
    .select("role, church_id")
    .eq("user_id", user.id)
    .eq("church_id", churchId)
    .eq("context_type", "integration")
    .eq("active", true)
    .in("role", ["integration_responsable", "integration_second"])
    .maybeSingle();

  if (context) {
    return { ok: true, user };
  }

  return { ok: false, error: "Non autorise. Gestion reservee aux responsables integration." };
}

async function assertCanReadIntegrationTeam(churchId: string) {
  if (!isUuid(churchId)) return { ok: false, error: "Église invalide." };
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

  if (authErr || !user) {
    return { ok: false, error: "Non authentifie." };
  }

  const cleanEmail = user.email?.toLowerCase().trim();
  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    return { ok: true, user };
  }

  const { data: memberships, error: membershipError } = await serverSupabase.from("user_contexts")
    .select("role, active").eq("user_id", user.id).eq("church_id", churchId).eq("context_type", "integration");
  if (membershipError) return { ok: false, error: "Vérification des droits impossible." };
  if (memberships?.length) {
    return memberships.some(m => m.active && ["integration_responsable", "integration_second", "integration_conseiller"].includes(m.role))
      ? { ok: true, user }
      : { ok: false, error: "Accès désactivé." };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role, church_id")
    .eq("id", user.id)
    .eq("active", true)
    .maybeSingle();

  const role = profile?.role?.toLowerCase().trim();
  if (role && (role.startsWith("integration_") || role === "conseiller") && profile?.church_id === churchId) {
    return { ok: true, user };
  }

  const { data: context } = await serverSupabase
    .from("user_contexts")
    .select("role, church_id")
    .eq("user_id", user.id)
    .eq("church_id", churchId)
    .eq("context_type", "integration")
    .eq("active", true)
    .maybeSingle();

  if (context) {
    return { ok: true, user };
  }

  return { ok: false, error: "Non autorise." };
}

export async function listIntegrationTeam(churchId: string) {
  const permission = await assertCanReadIntegrationTeam(churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();

  const { data: contexts, error: contextsError } = await supabase
    .from("user_contexts")
    .select("*")
    .eq("church_id", churchId)
    .eq("context_type", "integration")
    .eq("active", true)
    .in("role", ["integration_conseiller", "integration_second", "integration_responsable"]);

  if (contextsError) {
    return { success: false, error: contextsError.message };
  }

  const userIds = [...new Set((contexts || []).map((c: any) => c.user_id).filter(Boolean))];
  const userEmails = new Set((contexts || []).map((c: any) => c.email?.toLowerCase().trim()).filter(Boolean));

  // Query inactive contexts to never show deactivated members
  const { data: inactiveContexts } = await supabase
    .from("user_contexts")
    .select("user_id, email")
    .eq("church_id", churchId)
    .eq("context_type", "integration")
    .eq("active", false);

  const inactiveUserIds = new Set((inactiveContexts || []).map(c => c.user_id).filter(Boolean));
  const inactiveEmails = new Set((inactiveContexts || []).map(c => c.email?.toLowerCase().trim()).filter(Boolean));

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, email, display_name, created_at, role")
    .eq("church_id", churchId)
    .eq("active", true);

  const profileMap = new Map((allProfiles || []).map((p: any) => [p.id, p]));

  const { data: invites } = await supabase
    .from("invites")
    .select("assigned_to, bergerie_id")
    .eq("church_id", churchId);

  const workloadMap: Record<string, number> = {};
  (invites || []).forEach((inv: any) => {
    if (inv.assigned_to && !inv.bergerie_id) {
      workloadMap[inv.assigned_to] = (workloadMap[inv.assigned_to] || 0) + 1;
    }
  });

  // Query observation counselors (dedicated table or fallback storage)
  let obsMembers: any[] = [];
  try {
    const { data: obsData, error: obsErr } = await supabase
      .from("integration_observation_members")
      .select("*")
      .eq("church_id", churchId)
      .eq("active", true);

    if (!obsErr && obsData) {
      obsMembers = obsData;
    }
  } catch (e) {
    // Ignore schema cache errors before migration
  }

  // Also query observation counselors stored in pending_counselors (pre-migration fallback)
  try {
    const { data: pendingObs } = await supabase
      .from("pending_counselors")
      .select("*")
      .eq("church_id", churchId)
      .eq("role", "integration_observation");

    if (pendingObs && pendingObs.length > 0) {
      const existingIds = new Set(obsMembers.map((m: any) => m.id));
      pendingObs.forEach((p: any) => {
        if (!existingIds.has(p.id)) {
          obsMembers.push({
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email?.includes("@poimen.local") ? "" : p.email,
            role: "integration_observation",
            created_at: p.created_at,
            isPendingStorage: true
          });
        }
      });
    }
  } catch (e) {
    // Ignore error
  }

  const regularTeam = (contexts || []).map((context: any) => {
    const profile = profileMap.get(context.user_id);
    return {
      id: context.user_id,
      contextId: context.id,
      email: context.email || profile?.email || "",
      name: context.display_name || profile?.display_name || context.email,
      role: context.role === "integration_responsable" ? "Responsable" : context.role === "integration_second" ? "Second" : "Conseiller",
      roleKey: context.role,
      canDispatchAll: Boolean(context.metadata?.can_dispatch_all),
      status: "active",
      workload: workloadMap[context.user_id] || 0,
      createdAt: context.created_at || profile?.created_at,
      isObservation: false
    };
  });

  // Include legacy integration accounts from profiles that are not in user_contexts
  for (const prof of allProfiles || []) {
    if (userIds.includes(prof.id)) continue;
    const email = prof.email?.toLowerCase().trim();
    if (email && userEmails.has(email)) continue;
    if (inactiveUserIds.has(prof.id) || (email && inactiveEmails.has(email))) continue;
    const role = (prof.role || "").toLowerCase();
    if (role.startsWith("integration_") || role === "conseiller") {
      regularTeam.push({
        id: prof.id,
        contextId: prof.id,
        email: prof.email || "",
        name: prof.display_name || prof.email || "Conseiller",
        role: role === "integration_responsable" ? "Responsable" : role === "integration_second" ? "Second" : "Conseiller",
        roleKey: role === "conseiller" ? "integration_conseiller" : role,
        canDispatchAll: false,
        status: "active",
        workload: workloadMap[prof.id] || 0,
        createdAt: prof.created_at,
        isObservation: false
      });
    }
  }

  const observationTeam = obsMembers.map((obs: any) => ({
    id: obs.id,
    contextId: obs.id,
    email: obs.email && !obs.email.includes("@poimen.local") ? obs.email : "",
    name: `${obs.first_name || ""} ${obs.last_name || ""}`.trim() || "Conseiller en observation",
    role: "En observation",
    roleKey: "integration_observation",
    canDispatchAll: false,
    status: "active",
    workload: 0,
    createdAt: obs.created_at || new Date().toISOString(),
    isObservation: true,
    isPendingStorage: Boolean(obs.isPendingStorage)
  }));

  return {
    success: true,
    team: [...regularTeam, ...observationTeam]
  };
}

export async function listIntegrationPresenceMembers(churchId: string) {
  const permission = await assertCanReadIntegrationTeam(churchId);
  if (!permission.ok) return { success: false, error: permission.error, members: [] };

  const supabase = await getServiceSupabase();
  const { data: contexts, error } = await supabase
    .from("user_contexts")
    .select("user_id, display_name, role")
    .eq("church_id", churchId)
    .eq("context_type", "integration")
    .eq("active", true)
    .in("role", ["integration_responsable", "integration_second", "integration_conseiller"]);

  if (error) return { success: false, error: error.message, members: [] };

  const memberMap = new Map<string, { id: string; name: string; role: string }>();
  for (const context of contexts || []) {
    if (!context.user_id) continue;
    memberMap.set(context.user_id, {
      id: context.user_id,
      name: context.display_name?.trim() || "Membre de l’équipe",
      role: context.role
    });
  }

  // Get inactive integration contexts to avoid pulling revoked accounts via profiles
  const { data: inactiveContexts } = await supabase
    .from("user_contexts")
    .select("user_id, email")
    .eq("church_id", churchId)
    .eq("context_type", "integration")
    .eq("active", false);

  const inactiveUserIds = new Set((inactiveContexts || []).map(c => c.user_id).filter(Boolean));
  const inactiveEmails = new Set((inactiveContexts || []).map(c => c.email?.toLowerCase().trim()).filter(Boolean));

  // Include legacy integration accounts that predate user_contexts.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, role, email")
    .eq("church_id", churchId)
    .eq("active", true);

  for (const profile of profiles || []) {
    if (!profile.id || memberMap.has(profile.id) || !profile.role?.toLowerCase().startsWith("integration_")) continue;
    const email = profile.email?.toLowerCase().trim();
    if (inactiveUserIds.has(profile.id) || (email && inactiveEmails.has(email))) continue;

    memberMap.set(profile.id, {
      id: profile.id,
      name: profile.display_name?.trim() || profile.email?.split("@")[0] || "Membre de l’équipe",
      role: profile.role
    });
  }

  return { success: true, members: [...memberMap.values()] };
}

export async function createIntegrationTeamMember(params: {
  churchId: string;
  firstName: string;
  lastName: string;
  email?: string;
  accessCode?: string;
  role: string;
}) {
  const permission = await assertCanManageIntegrationTeam(params?.churchId || "");
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();

  // Special handling for counselors in observation phase (no app access, email optional)
  if (params?.role === "integration_observation") {
    if (!params || !validObservationMemberInput(params)) {
      return { success: false, error: "Coordonnées invalides (Prénom et nom requis)." };
    }

    const cleanEmail = params.email && typeof params.email === "string" && params.email.trim()
      ? params.email.toLowerCase().trim()
      : null;
    const firstName = params.firstName.trim();
    const lastName = params.lastName.trim();

    // 1. Try inserting into integration_observation_members
    const { data: obsCreated, error: obsErr } = await supabase
      .from("integration_observation_members")
      .insert({
        church_id: params.churchId,
        first_name: firstName,
        last_name: lastName,
        email: cleanEmail,
        role: "integration_observation",
        active: true
      })
      .select()
      .maybeSingle();

    if (obsErr) {
      // 2. Fallback to pending_counselors if table not yet created via migration
      const fallbackEmail = cleanEmail || `obs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@poimen.local`;
      const { error: fallbackErr } = await supabase
        .from("pending_counselors")
        .insert({
          church_id: params.churchId,
          first_name: firstName,
          last_name: lastName,
          email: fallbackEmail,
          access_code: "OBSERVATION_NO_LOGIN",
          role: "integration_observation"
        });

      if (fallbackErr) {
        return { success: false, error: fallbackErr.message };
      }
    }

    return {
      success: true,
      createdAuthUser: false,
      requiresPrimaryPassword: false,
      isObservation: true
    };
  }

  if (!params || !validTeamInput(params)) return { success: false, error: "Coordonnées invalides." };

  const cleanEmail = (params.email || "").toLowerCase().trim();
  const displayName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
  const role = params.role === "integration_second" ? "integration_second" : "integration_conseiller";
  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    return { success: false, error: "Le compte administrateur central ne peut pas être provisionné par cette action." };
  }

  let targetUser = await findAuthUserByEmail(supabase, cleanEmail);
  let createdAuthUser = false;

  if (!targetUser) {
    if (typeof params.accessCode !== "string" || params.accessCode.length < 12 || params.accessCode.length > 128) {
      return { success: false, error: "Le mot de passe initial doit comporter entre 12 et 128 caractères." };
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: params.accessCode,
      email_confirm: true
    });
    if (error) return { success: false, error: error.message };
    targetUser = data.user;
    createdAuthUser = true;
  }

  if (!targetUser?.id) {
    return { success: false, error: "Compte Auth introuvable ou impossible a creer." };
  }

  const access = {
    role,
    churchId: params.churchId,
    bergerieId: "",
    displayName,
    churchData: null,
    familyData: null
  };

  const { error: contextError } = await upsertUserContext(supabase, targetUser.id, cleanEmail, access, true);
  if (contextError) return { success: false, error: contextError.message };

  const { error: profileError } = await createOrPreserveProfile(supabase, targetUser.id, cleanEmail, access);
  if (profileError) return { success: false, error: profileError.message };

  await supabase
    .from("pending_counselors")
    .delete()
    .eq("church_id", params.churchId)
    .eq("email", cleanEmail);

  return {
    success: true,
    createdAuthUser,
    requiresPrimaryPassword: !createdAuthUser
  };
}

export async function deactivateIntegrationTeamMember(params: { churchId: string; userId: string; contextId?: string | null }) {
  if (!params || !isUuid(params.userId) || (params.contextId && !isUuid(params.contextId))) return { success: false, error: "Membre invalide." };
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();

  // 1. Check if member is in integration_observation_members
  try {
    const { data: obsMember } = await supabase
      .from("integration_observation_members")
      .select("id")
      .eq("id", params.userId)
      .eq("church_id", params.churchId)
      .maybeSingle();

    if (obsMember) {
      const { error: delErr } = await supabase
        .from("integration_observation_members")
        .delete()
        .eq("id", params.userId);
      if (delErr) return { success: false, error: delErr.message };
      return { success: true };
    }
  } catch (e) {
    // Ignore error if table not yet created
  }

  // 2. Check if member is in pending_counselors (observation role)
  try {
    const { data: pendingObsMember } = await supabase
      .from("pending_counselors")
      .select("id, role")
      .eq("id", params.userId)
      .eq("church_id", params.churchId)
      .maybeSingle();

    if (pendingObsMember) {
      const { error: delErr } = await supabase
        .from("pending_counselors")
        .delete()
        .eq("id", params.userId);
      if (delErr) return { success: false, error: delErr.message };
      return { success: true };
    }
  } catch (e) {
    // Ignore error
  }

  // 3. Find target in user_contexts or legacy profile
  const { data: targets, error: targetsError } = await supabase.from("user_contexts")
    .select("id, role, email, user_id").eq("user_id", params.userId).eq("church_id", params.churchId).eq("context_type", "integration");

  const { data: targetProfile } = await supabase.from("profiles")
    .select("id, role, email, church_id, display_name")
    .eq("id", params.userId)
    .eq("church_id", params.churchId)
    .maybeSingle();

  if ((!targets || targets.length === 0) && !targetProfile) {
    return { success: false, error: "Membre introuvable." };
  }

  if (params.contextId && targets?.length && !targets.some(t => t.id === params.contextId) && targetProfile?.id !== params.contextId) {
    return { success: false, error: "Accès introuvable dans cette église." };
  }

  const isResponsable = (targets || []).some(t => t.role === "integration_responsable") || targetProfile?.role === "integration_responsable";
  const targetEmail = (targets?.[0]?.email || targetProfile?.email || "").toLowerCase().trim();
  const isSuperAdminEmail = targetEmail === SUPER_ADMIN_EMAIL;

  if ((isResponsable || isSuperAdminEmail) && permission.user?.email?.toLowerCase().trim() !== SUPER_ADMIN_EMAIL) {
    return { success: false, error: "Seul l'administrateur central peut désactiver ce responsable." };
  }

  // 4. Delete integration context from user_contexts
  let delQuery = supabase
    .from("user_contexts")
    .delete()
    .eq("user_id", params.userId)
    .eq("church_id", params.churchId)
    .eq("context_type", "integration");

  if (params.contextId && targets?.some(t => t.id === params.contextId)) {
    delQuery = delQuery.eq("id", params.contextId);
  }

  const { error: contextDelError } = await delQuery;
  if (contextDelError) return { success: false, error: contextDelError.message };

  // 5. Unassign ONLY integration invites (preserve all family invites where bergerie_id is not null)
  await supabase
    .from("invites")
    .update({ assigned_to: null })
    .eq("church_id", params.churchId)
    .eq("assigned_to", params.userId)
    .is("bergerie_id", null);

  // 6. Clean up pending_counselors for this user
  if (targetEmail) {
    await supabase
      .from("pending_counselors")
      .delete()
      .eq("church_id", params.churchId)
      .eq("email", targetEmail);
  }

  // 7. Strictly preserve discipleship family roles and members:
  // Check if this user has any other active context (e.g. family leader: berger, second du berger, responsable de brebi)
  const { data: otherContexts } = await supabase
    .from("user_contexts")
    .select("role, context_type, active, bergerie_id")
    .eq("user_id", params.userId)
    .eq("active", true);

  const familyContext = otherContexts?.find(c => c.context_type === "family");

  if (familyContext) {
    // If user is a leader in a discipleship family, restore their profile role to that family role
    await supabase
      .from("profiles")
      .update({
        role: familyContext.role,
        bergerie_id: familyContext.bergerie_id || null,
        active: true
      })
      .eq("id", params.userId);
  } else {
    // If user has no other leadership/staff context, mark profile inactive
    // Discipleship family membership lives in the members table and is 100% preserved
    await supabase
      .from("profiles")
      .update({
        active: false
      })
      .eq("id", params.userId);
  }

  return { success: true };
}

export async function adminSignUp(email: string, accessCode: string) {
  if (typeof email !== "string" || typeof accessCode !== "string" || email.length > 254 || accessCode.length > 128 || !accessCode) {
    return { success: false, error: "Informations d'identification invalides." };
  }
  // A shared organisation code is not proof of ownership of an email address.
  // New accounts must be provisioned by an authorised manager.
  const sessionClient = await createServerClient();
  const { data: { user: caller }, error: sessionError } = await sessionClient.auth.getUser();
  if (sessionError || !caller?.email_confirmed_at || caller.email?.toLowerCase().trim() !== email.toLowerCase().trim()) {
    return { success: false, error: "Connectez-vous avec votre mot de passe personnel. Pour un premier accès, contactez votre responsable." };
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: "Configuration manquante sur le serveur." };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const cleanEmail = email.toLowerCase().trim();

  let resolvedRole = "";
  let resolvedChurchId = "";
  let resolvedBergerieId = "";
  let resolvedDisplayName = "";
  let pendingCounselorIdToDelete = "";
  let churchData: any = null;
  let familyData: any = null;

  const { data: church, error: chErr } = await supabase
    .from("churches")
    .select("*")
    .eq("integration_email", cleanEmail)
    .eq("integration_access_code", accessCode)
    .maybeSingle();

  if (!chErr && church && !church.archived) {
    resolvedRole = "integration_responsable";
    resolvedChurchId = church.id;
    resolvedDisplayName = (church.integration_first_name && church.integration_last_name)
      ? `${church.integration_first_name} ${church.integration_last_name}`
      : "Responsable Integration";
    churchData = church;
  } else {
    const { data: pendingCounselor, error: pcErr } = await supabase
      .from("pending_counselors")
      .select("*")
      .eq("email", cleanEmail)
      .eq("access_code", accessCode)
      .maybeSingle();

    if (!pcErr && pendingCounselor && ["integration_conseiller", "integration_second"].includes(pendingCounselor.role)) {
      resolvedRole = pendingCounselor.role;
      resolvedChurchId = pendingCounselor.church_id;
      resolvedDisplayName = `${pendingCounselor.first_name} ${pendingCounselor.last_name}`;
      pendingCounselorIdToDelete = pendingCounselor.id;
    } else {
      const { data: member, error: memErr } = await supabase
        .from("members")
        .select("*, bergeries(*)")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!memErr && member && !member.archived && member.bergeries && !member.bergeries.archived && member.bergeries.status === "active" && isFamilyLeader(member.status)) {
        const familyCode = member.bergeries.access_code;
        if (familyCode && accessCode === familyCode) {
          resolvedRole = normalizeFamilyRole(member.status);
          resolvedBergerieId = member.bergerie_id;
          resolvedChurchId = member.bergeries.church_id;
          resolvedDisplayName = `${member.first_name} ${member.last_name}`;
          familyData = member.bergeries;

          const { data: chForFam } = await supabase
            .from("churches")
            .select("*")
            .eq("id", resolvedChurchId)
            .maybeSingle();
          if (chForFam) {
            churchData = chForFam;
          }
        }
      }
    }
  }

  if (!resolvedRole) {
    return { success: false, error: "Informations d'identification invalides. Veuillez verifier vos acces." };
  }

  const resolvedAccess = {
    role: resolvedRole,
    churchId: resolvedChurchId,
    bergerieId: resolvedBergerieId,
    displayName: resolvedDisplayName,
    churchData,
    familyData
  };

  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password: accessCode,
    email_confirm: true
  });

  let targetUserId = authData?.user?.id || "";
  let targetUser: any = authData?.user || null;
  let requiresPrimaryPassword = false;

  if (authErr) {
    if (!isDuplicateAuthUserError(authErr.message)) {
      return { success: false, error: authErr.message };
    }

    const existingUser = await findAuthUserByEmail(supabase, cleanEmail);
    if (!existingUser) {
      return { success: false, error: "Compte existant introuvable." };
    }

    targetUserId = existingUser.id;
    targetUser = existingUser;
    requiresPrimaryPassword = true;
    const sessionClient = await createServerClient();
    const { data: { user: caller }, error: callerError } = await sessionClient.auth.getUser();
    if (callerError || caller?.id !== targetUserId) {
      return { success: false, error: "Connectez-vous avec votre mot de passe personnel avant d'ajouter un espace." };
    }
  }

  if (!targetUserId || !targetUser) {
    return { success: false, error: "Echec de creation ou recuperation de l'utilisateur." };
  }

  const { data: context, error: contextError } = await upsertUserContext(supabase, targetUserId, cleanEmail, resolvedAccess);
  if (contextError) {
    return { success: false, error: `Creation de la casquette utilisateur echouee: ${contextError.message}` };
  }

  const { error: profError } = await createOrPreserveProfile(supabase, targetUserId, cleanEmail, resolvedAccess);
  if (profError) {
    return { success: false, error: `Creation ou mise a jour du profil echouee: ${profError.message}` };
  }

  if (pendingCounselorIdToDelete) {
    await supabase.from("pending_counselors").delete().eq("id", pendingCounselorIdToDelete);
  }

  return {
    success: true,
    user: { id: targetUserId },
    role: resolvedRole,
    displayName: resolvedDisplayName,
    churchId: resolvedChurchId,
    bergerieId: resolvedBergerieId,
    context,
    requiresPrimaryPassword
  };
}

export async function autoAddLeaderToMembers(params: {
  bergerie_id: string;
  civility?: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  is_conseiller?: boolean;
}) {
  if (!params || !validTeamInput({ churchId: params.bergerie_id, firstName: params.first_name, lastName: params.last_name, email: params.email })) {
    return { success: false, error: "Coordonnées invalides." };
  }
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: "Non authentifie." };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role, bergerie_id, active")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin" || user.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
  const isSelf = user.email?.toLowerCase().trim() === params.email.toLowerCase().trim();

  if (!isSelf && !isSuperAdmin) {
    return { success: false, error: "Non autorise. Vous ne pouvez ajouter que votre propre profil de leader." };
  }
  if (!isSuperAdmin && (!profile?.active || profile.bergerie_id !== params.bergerie_id || !isFamilyLeader(profile.role))) {
    return { success: false, error: "Vous ne disposez pas d'un rôle de leader dans cette famille." };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    return { success: false, error: "Configuration manquante sur le serveur." };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase
    .from("members")
    .insert({
      bergerie_id: params.bergerie_id,
      civility: params.civility || "M.",
      first_name: params.first_name,
      last_name: params.last_name,
      email: params.email.toLowerCase().trim(),
      status: isSuperAdmin ? normalizeFamilyRole(params.status) : normalizeFamilyRole(profile!.role),
      is_conseiller: isSuperAdmin ? !!params.is_conseiller : false,
      attendance: {}
    })
    .select()
    .single();

  if (error) {
    console.error("Error in server-side auto-add:", error);
    return { success: false, error: error.message };
  }

  return { success: true, member: data };
}

export async function getIntegrationDropdownList(churchId: string) {
  try {
    if (!isUuid(churchId)) return { success: false, error: "Église invalide." };
    const supabase = await getServiceSupabase();

    // 1. Fetch church to verify existence
    const { data: church, error: churchErr } = await supabase
      .from("churches")
      .select("id, name, integration_email, integration_first_name, integration_last_name, integration_access_code, archived")
      .eq("id", churchId)
      .maybeSingle();

    if (churchErr || !church || church.archived) {
      return { success: false, error: "Église introuvable ou archivée." };
    }

    const list: any[] = [];
    const addedIds = new Set<string>();
    const addedEmails = new Set<string>();

    // 2. Add department head from church
    if (church.integration_first_name) {
      const headName = `${church.integration_first_name} ${church.integration_last_name || ""}`.trim();
      const headEmail = church.integration_email ? church.integration_email.toLowerCase().trim() : "";
      list.push({
        id: "church_head",
        email: headEmail,
        name: headName,
        displayName: headName,
        role: "integration_responsable",
        isHead: true,
        code: church.integration_access_code
      });
      if (headEmail) addedEmails.add(headEmail);
    }

    // 3. Fetch active integration contexts
    const { data: contexts, error: contextsErr } = await supabase
      .from("user_contexts")
      .select("id, user_id, email, display_name, role")
      .eq("church_id", churchId)
      .eq("context_type", "integration")
      .eq("active", true)
      .in("role", ["integration_responsable", "integration_second", "integration_conseiller", "integration_observation", "conseiller"]);

    const contextUserIds = [...new Set((contexts || []).map((c: any) => c.user_id).filter(Boolean))];
    let contextProfiles: any[] = [];
    if (contextUserIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, display_name, first_name, last_name")
        .in("id", contextUserIds);
      contextProfiles = profs || [];
    }
    const contextProfileMap = new Map(contextProfiles.map((p: any) => [p.id, p]));

    if (!contextsErr && contexts) {
      contexts.forEach((c: any) => {
        const prof = contextProfileMap.get(c.user_id);
        const email = (c.email || prof?.email)?.toLowerCase().trim() || "";
        const profileName = prof?.display_name || (prof?.first_name ? `${prof.first_name} ${prof.last_name || ""}`.trim() : "");
        const name = (c.display_name || profileName || email).trim();
        const id = c.id || c.user_id;
        if (name || email) {
          list.push({
            id,
            email,
            name: name || email,
            displayName: name || email,
            role: c.role === "conseiller" ? "integration_conseiller" : c.role,
            isContext: true
          });
          if (c.user_id) addedIds.add(c.user_id);
          if (c.id) addedIds.add(c.id);
          if (email) addedEmails.add(email);
        }
      });
    }

    // Query inactive integration contexts to ensure revoked members are never pulled via profiles
    const { data: inactiveContexts } = await supabase
      .from("user_contexts")
      .select("user_id, email")
      .eq("church_id", churchId)
      .eq("context_type", "integration")
      .eq("active", false);

    const inactiveUserIds = new Set((inactiveContexts || []).map(c => c.user_id).filter(Boolean));
    const inactiveEmails = new Set((inactiveContexts || []).map(c => c.email?.toLowerCase().trim()).filter(Boolean));

    // 4. Fetch active integration profiles (legacy accounts not in user_contexts)
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, email, display_name, first_name, last_name, role")
      .eq("church_id", churchId)
      .eq("active", true);

    if (!profilesErr && profiles) {
      profiles.forEach((p: any) => {
        const role = (p.role || "").toLowerCase();
        const email = p.email?.toLowerCase().trim() || "";
        if (addedIds.has(p.id) || (email && addedEmails.has(email))) return;
        if (inactiveUserIds.has(p.id) || (email && inactiveEmails.has(email))) return;

        if (role.startsWith("integration_") || role === "conseiller") {
          const name = (p.display_name || (p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : "") || email).trim();
          if (name || email) {
            list.push({
              id: p.id,
              email,
              name: name || email,
              displayName: name || email,
              role: role === "conseiller" ? "integration_conseiller" : p.role,
              isProfile: true
            });
            addedIds.add(p.id);
            if (email) addedEmails.add(email);
          }
        }
      });
    }

    // 5. Fetch pending counselors
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_counselors")
      .select("id, email, first_name, last_name, role, access_code")
      .eq("church_id", churchId);

    if (!pendingErr && pending) {
      pending.forEach((p: any) => {
        const email = (p.email?.includes("@poimen.local") ? "" : p.email?.toLowerCase().trim()) || "";
        const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
        if (name || email) {
          list.push({
            id: p.id,
            email,
            name: name || email,
            displayName: name || email,
            role: p.role || "integration_conseiller",
            isPending: true,
            isObservation: p.role === "integration_observation",
            code: p.access_code
          });
        }
      });
    }

    // 6. Fetch observation counselors from integration_observation_members
    try {
      const { data: obsData, error: obsErr } = await supabase
        .from("integration_observation_members")
        .select("id, email, first_name, last_name, role")
        .eq("church_id", churchId)
        .eq("active", true);

      if (!obsErr && obsData) {
        obsData.forEach((obs: any) => {
          const email = (obs.email?.includes("@poimen.local") ? "" : obs.email?.toLowerCase().trim()) || "";
          const name = `${obs.first_name || ""} ${obs.last_name || ""}`.trim();
          if (name || email) {
            list.push({
              id: obs.id,
              email,
              name: name || email,
              displayName: name || email,
              role: "integration_observation",
              isObservation: true
            });
          }
        });
      }
    } catch (e) {
      // Ignore if table schema error
    }

    // Deduplicate by name and email so counselors without email are preserved
    const uniqueMap = new Map<string, any>();
    list.forEach(item => {
      const email = (item.email || "").toLowerCase().trim();
      const hasEmail = Boolean(email && !email.includes("@poimen.local"));
      const rawName = (item.name || "").trim();
      const normName = rawName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const nameKey = normName ? `name:${normName}` : "";
      const emailKey = hasEmail ? `email:${email}` : "";
      const idKey = item.id ? `id:${item.id}` : "";

      // Check if already registered under email or name
      if (emailKey && uniqueMap.has(emailKey)) {
        return;
      }
      if (nameKey && uniqueMap.has(nameKey)) {
        const existing = uniqueMap.get(nameKey);
        if (!existing.email && hasEmail) {
          existing.email = email;
          uniqueMap.set(emailKey, existing);
        }
        return;
      }

      const entry = {
        id: item.id,
        email: hasEmail ? email : "",
        name: rawName || email,
        displayName: rawName || email,
        role: item.role || "integration_conseiller",
        isHead: Boolean(item.isHead),
        isPending: Boolean(item.isPending),
        isObservation: Boolean(item.isObservation || item.role === "integration_observation"),
        code: item.code
      };

      const primaryKey = nameKey || emailKey || idKey || `rand:${Math.random()}`;
      uniqueMap.set(primaryKey, entry);
      if (emailKey) uniqueMap.set(emailKey, entry);
      if (nameKey) uniqueMap.set(nameKey, entry);
    });

    const uniqueList = Array.from(new Set(uniqueMap.values()));

    const roleRank = (role: string) => {
      const r = (role || "").toLowerCase();
      if (r === "integration_responsable") return 1;
      if (r === "integration_second") return 2;
      if (r === "integration_conseiller") return 3;
      if (r === "integration_observation") return 4;
      return 5;
    };

    uniqueList.sort((a, b) => {
      const rankDiff = roleRank(a.role) - roleRank(b.role);
      if (rankDiff !== 0) return rankDiff;
      return (a.name || "").localeCompare(b.name || "", "fr", { sensitivity: "base" });
    });

    return { success: true, list: uniqueList };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateIntegrationTeamMember(params: {
  churchId: string;
  userId: string;
  contextId: string;
  firstName: string;
  lastName: string;
  email?: string;
  accessCode?: string;
  role: string;
  canDispatchAll?: boolean;
}) {
  const permission = await assertCanManageIntegrationTeam(params?.churchId || "");
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();

  // 1. Check if target is an observation member in integration_observation_members
  try {
    const { data: obsMember } = await supabase
      .from("integration_observation_members")
      .select("*")
      .eq("id", params.contextId || params.userId)
      .eq("church_id", params.churchId)
      .maybeSingle();

    if (obsMember) {
      if (!params.firstName?.trim() || !params.lastName?.trim()) {
        return { success: false, error: "Le prénom et le nom sont obligatoires." };
      }
      const cleanEmail = params.email && typeof params.email === "string" && params.email.trim()
        ? params.email.toLowerCase().trim()
        : null;

      const { error: updErr } = await supabase
        .from("integration_observation_members")
        .update({
          first_name: params.firstName.trim(),
          last_name: params.lastName.trim(),
          email: cleanEmail,
          updated_at: new Date().toISOString()
        })
        .eq("id", obsMember.id);

      if (updErr) return { success: false, error: updErr.message };
      return { success: true };
    }
  } catch (e) {
    // Ignore error if table not yet created
  }

  // 2. Check if target is an observation member in pending_counselors
  try {
    const { data: pendingObs } = await supabase
      .from("pending_counselors")
      .select("*")
      .eq("id", params.contextId || params.userId)
      .eq("church_id", params.churchId)
      .eq("role", "integration_observation")
      .maybeSingle();

    if (pendingObs) {
      if (!params.firstName?.trim() || !params.lastName?.trim()) {
        return { success: false, error: "Le prénom et le nom sont obligatoires." };
      }
      const cleanEmail = params.email && typeof params.email === "string" && params.email.trim()
        ? params.email.toLowerCase().trim()
        : pendingObs.email;

      const { error: updErr } = await supabase
        .from("pending_counselors")
        .update({
          first_name: params.firstName.trim(),
          last_name: params.lastName.trim(),
          email: cleanEmail
        })
        .eq("id", pendingObs.id);

      if (updErr) return { success: false, error: updErr.message };
      return { success: true };
    }
  } catch (e) {
    // Ignore error
  }

  if (!params || !validTeamInput(params) || !isUuid(params.userId) || !isUuid(params.contextId)) {
    return { success: false, error: "Membre invalide." };
  }

  const cleanEmail = (params.email || "").toLowerCase().trim();
  const displayName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
  const role = params.role === "integration_second" ? "integration_second" : params.role === "integration_responsable" ? "integration_responsable" : "integration_conseiller";

  // An organisation manager may edit membership, never global account credentials.
  const { data: target, error: targetError } = await supabase.from("user_contexts")
    .select("id, email, role, metadata")
    .eq("id", params.contextId).eq("user_id", params.userId)
    .eq("church_id", params.churchId).eq("context_type", "integration").single();
  if (targetError || !target) return { success: false, error: "Membre introuvable dans cette église." };
  if (params.accessCode || cleanEmail !== target.email.toLowerCase().trim()) {
    return { success: false, error: "L'adresse de connexion et le mot de passe doivent être modifiés par le titulaire du compte." };
  }
  if ((role === "integration_responsable" || target.role === "integration_responsable") && permission.user?.email?.toLowerCase().trim() !== SUPER_ADMIN_EMAIL) {
    return { success: false, error: "Seul l'administrateur central peut modifier le responsable." };
  }

  // 2. Update user_contexts
  const contextUpdatePayload: Record<string, any> = {
    email: cleanEmail,
    display_name: displayName,
    role: role
  };
  if (params.canDispatchAll !== undefined) {
    contextUpdatePayload.metadata = {
      ...(target.metadata || {}),
      can_dispatch_all: Boolean(params.canDispatchAll)
    };
  }

  const { error: contextError } = await supabase
    .from("user_contexts")
    .update(contextUpdatePayload)
    .eq("id", params.contextId)
    .eq("user_id", params.userId)
    .eq("church_id", params.churchId)
    .eq("context_type", "integration");

  if (contextError) return { success: false, error: contextError.message };

  // 4. Update church integration settings if role is integration_responsable
  if (role === "integration_responsable") {
    const updateChurchPayload: any = {
      integration_email: cleanEmail,
      integration_first_name: params.firstName.trim(),
      integration_last_name: params.lastName.trim()
    };
    if (params.accessCode) {
      updateChurchPayload.integration_access_code = params.accessCode;
    }

    const { error: churchError } = await supabase
      .from("churches")
      .update(updateChurchPayload)
      .eq("id", params.churchId);

    if (churchError) return { success: false, error: churchError.message };
  }

  return { success: true };
}

export async function getFamilyLeadersList(familyId: string) {
  try {
    if (!isUuid(familyId)) return { success: false, error: "Famille invalide." };
    const supabase = await getServiceSupabase();

    // 1. Fetch family to verify existence and retrieve creator information
    const { data: family, error: famErr } = await supabase
      .from("bergeries")
      .select("id, name, creator_email, creator_first_name, creator_last_name, creator_civility, creator_role, berger_id, coordonnateur_id, archived")
      .eq("id", familyId)
      .maybeSingle();

    if (famErr || !family || family.archived) {
      return { success: false, error: "Famille introuvable ou archivée." };
    }

    // 2. Fetch all active members of this family
    const { data: members, error: memErr } = await supabase
      .from("members")
      .select("id, email, civility, first_name, last_name, status")
      .eq("bergerie_id", familyId)
      .eq("archived", false);

    if (memErr) throw memErr;

    const leadersMap = new Map<string, any>();

    (members || []).forEach((m: any) => {
      const status = (m.status || "").toLowerCase().trim();
      const isLeader =
        isFamilyLeader(status) ||
        status.includes("berger") ||
        status.includes("second") ||
        status.includes("responsable") ||
        status.includes("coordonnateur") ||
        (family.berger_id && m.id === family.berger_id) ||
        (family.coordonnateur_id && m.id === family.coordonnateur_id);

      if (isLeader && m.email) {
        const emailKey = m.email.toLowerCase().trim();
        leadersMap.set(emailKey, {
          id: m.id,
          email: emailKey,
          civility: m.civility || "M.",
          first_name: m.first_name,
          last_name: m.last_name,
          status: m.status
        });
      }
    });

    // 3. Fallback: If family creator exists and is not yet in leadersMap, add them
    if (family.creator_email) {
      const creatorKey = family.creator_email.toLowerCase().trim();
      if (!leadersMap.has(creatorKey)) {
        leadersMap.set(creatorKey, {
          id: `creator-${family.id}`,
          email: creatorKey,
          civility: family.creator_civility || "M.",
          first_name: family.creator_first_name || "Berger",
          last_name: family.creator_last_name || "",
          status: family.creator_role || "Berger"
        });
      }
    }

    const leaders = Array.from(leadersMap.values());

    // Rank leaders: 1 = Berger, 2 = Second, 3 = Responsable, 4 = Coordonnateur, 5 = other
    const getLeaderRank = (l: any) => {
      const st = (l.status || "").toLowerCase().trim();
      const isBergerById = family.berger_id && l.id === family.berger_id;
      if (isBergerById || (st.includes("berger") && !st.includes("second"))) {
        return 1;
      }
      if (st.includes("second")) {
        return 2;
      }
      if (st.includes("responsable")) {
        return 3;
      }
      if (st.includes("coordonnateur") || (family.coordonnateur_id && l.id === family.coordonnateur_id)) {
        return 4;
      }
      return 5;
    };

    leaders.sort((a, b) => {
      const rankA = getLeaderRank(a);
      const rankB = getLeaderRank(b);
      if (rankA !== rankB) return rankA - rankB;
      const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim();
      const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim();
      return nameA.localeCompare(nameB, "fr", { sensitivity: "base" });
    });

    return { success: true, leaders };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function authenticateFamilyLeader(params: {
  email: string;
  accessCode: string;
  familyId?: string;
}) {
  if (!params || typeof params.email !== "string" || typeof params.accessCode !== "string" || !params.email.trim() || !params.accessCode.trim()) {
    return { success: false, error: "Informations d'identification invalides." };
  }

  const cleanEmail = params.email.toLowerCase().trim();
  const cleanCode = params.accessCode.trim();
  const supabase = await getServiceSupabase();

  let targetFamily: any = null;
  let targetMember: any = null;

  if (params.familyId) {
    if (!isUuid(params.familyId)) {
      return { success: false, error: "Identifiant de famille invalide." };
    }
    const { data: family, error: famErr } = await supabase
      .from("bergeries")
      .select("*, churches(*)")
      .eq("id", params.familyId)
      .maybeSingle();

    if (famErr || !family || family.archived || family.status !== "active") {
      return { success: false, error: "Famille introuvable ou inactive." };
    }

    if (family.access_code?.trim() !== cleanCode) {
      return { success: false, error: "Code d'accès de la famille invalide." };
    }

    targetFamily = family;

    const { data: member } = await supabase
      .from("members")
      .select("*")
      .eq("email", cleanEmail)
      .eq("bergerie_id", params.familyId)
      .eq("archived", false)
      .maybeSingle();

    targetMember = member;
  } else {
    // FamilyId not provided (e.g. from /login)
    const { data: members } = await supabase
      .from("members")
      .select("*, bergeries(*, churches(*))")
      .eq("email", cleanEmail)
      .eq("archived", false);

    const matchingMember = (members || []).find((m: any) =>
      m.bergeries &&
      !m.bergeries.archived &&
      m.bergeries.status === "active" &&
      m.bergeries.access_code?.trim() === cleanCode
    );

    if (matchingMember) {
      targetMember = matchingMember;
      targetFamily = matchingMember.bergeries;
    } else {
      const { data: creatorFamilies } = await supabase
        .from("bergeries")
        .select("*, churches(*)")
        .eq("creator_email", cleanEmail)
        .eq("access_code", cleanCode)
        .eq("archived", false)
        .eq("status", "active");

      if (creatorFamilies && creatorFamilies.length > 0) {
        targetFamily = creatorFamilies[0];
      }
    }
  }

  if (!targetFamily) {
    return { success: false, error: "Aucune famille active ne correspond à ces identifiants." };
  }

  const isBergerCreator = targetFamily.creator_email?.toLowerCase().trim() === cleanEmail;
  const isMemberLeader = targetMember && isFamilyLeader(targetMember.status);

  if (!isBergerCreator && !isMemberLeader) {
    return { success: false, error: "Vous n'êtes pas enregistré comme responsable dans cette famille." };
  }

  const resolvedRole = normalizeFamilyRole(targetMember?.status || targetFamily.creator_role || "Berger");
  const displayName = targetMember
    ? `${targetMember.first_name} ${targetMember.last_name}`.trim()
    : `${targetFamily.creator_first_name || ""} ${targetFamily.creator_last_name || ""}`.trim();

  // Ensure Auth User exists and sync password to cleanCode
  const existingUser = await findAuthUserByEmail(supabase, cleanEmail);
  let targetUserId = existingUser?.id;

  if (existingUser) {
    const { error: updateErr } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: cleanCode
    });
    if (updateErr) {
      console.error("Error updating user password for family access:", updateErr);
    }
  } else {
    const { data: newAuth, error: createErr } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: cleanCode,
      email_confirm: true
    });
    if (createErr) {
      return { success: false, error: `Création du compte impossible: ${createErr.message}` };
    }
    targetUserId = newAuth.user.id;
  }

  if (!targetUserId) {
    return { success: false, error: "Impossible de résoudre le compte utilisateur." };
  }

  const resolvedAccess = {
    role: resolvedRole,
    churchId: targetFamily.church_id,
    bergerieId: targetFamily.id,
    displayName,
    churchData: targetFamily.churches || null,
    familyData: targetFamily
  };

  // Upsert user_contexts for this family
  const { data: context, error: contextErr } = await upsertUserContext(supabase, targetUserId, cleanEmail, resolvedAccess);
  if (contextErr) {
    console.error("Context creation error:", contextErr);
  }

  // Create or preserve profile
  await createOrPreserveProfile(supabase, targetUserId, cleanEmail, resolvedAccess);

  return {
    success: true,
    user: { id: targetUserId },
    role: resolvedRole,
    displayName,
    churchId: targetFamily.church_id,
    bergerieId: targetFamily.id,
    family: targetFamily,
    context
  };
}

export async function createFamilyUserContext(params: {
  userId: string;
  email: string;
  familyId: string;
  role: string;
  churchId: string;
  displayName: string;
}) {
  try {
    if (!params || !isUuid(params.familyId)) return { success: false, error: "Famille invalide." };
    const sessionClient = await createServerClient();
    const { data: { user }, error: authError } = await sessionClient.auth.getUser();
    if (authError || !user?.email || user.id !== params.userId) {
      return { success: false, error: "Non authentifié." };
    }
    const supabase = await getServiceSupabase();
    const cleanEmail = user.email.toLowerCase().trim();

    // 1. Check if member exists in members table
    const { data: member } = await supabase.from("members")
      .select("status, first_name, last_name, bergeries!inner(id, church_id, status, archived)")
      .eq("email", cleanEmail).eq("bergerie_id", params.familyId).eq("archived", false).maybeSingle();

    const memberFamily = member?.bergeries as any;
    let resolvedRole = member?.status ? normalizeFamilyRole(member.status) : null;
    let resolvedChurchId = memberFamily?.church_id;
    let resolvedDisplayName = member ? `${member.first_name} ${member.last_name}`.trim() : null;

    if (!member || !memberFamily || memberFamily.status !== "active" || memberFamily.archived || !isFamilyLeader(member.status)) {
      // 2. Check if user is the registered creator of the family
      const { data: famOnly } = await supabase.from("bergeries")
        .select("id, church_id, status, archived, creator_email, creator_role, creator_first_name, creator_last_name")
        .eq("id", params.familyId).maybeSingle();

      if (famOnly && famOnly.status === "active" && !famOnly.archived && famOnly.creator_email?.toLowerCase().trim() === cleanEmail) {
        resolvedRole = normalizeFamilyRole(famOnly.creator_role || "Berger");
        resolvedChurchId = famOnly.church_id;
        resolvedDisplayName = `${famOnly.creator_first_name || ""} ${famOnly.creator_last_name || ""}`.trim() || cleanEmail;
      } else {
        return { success: false, error: "Aucun rôle de leader actif dans cette famille." };
      }
    }
    
    const access = {
      role: resolvedRole || "responsable de brebi",
      churchId: resolvedChurchId || params.churchId,
      bergerieId: params.familyId,
      displayName: resolvedDisplayName || params.displayName || cleanEmail,
      churchData: null,
      familyData: null
    };

    const { data: context, error: contextError } = await upsertUserContext(supabase, params.userId, cleanEmail, access);
    if (contextError) throw contextError;

    const { error: profileError } = await createOrPreserveProfile(supabase, params.userId, cleanEmail, access);
    if (profileError) throw profileError;

    return { success: true, context };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function setCounselorDispatchPermission(params: {
  churchId: string;
  contextId: string;
  canDispatchAll: boolean;
}) {
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const { data: target, error: targetError } = await supabase
    .from("user_contexts")
    .select("id, metadata, role, display_name")
    .eq("id", params.contextId)
    .eq("church_id", params.churchId)
    .eq("context_type", "integration")
    .single();

  if (targetError || !target) {
    return { success: false, error: "Membre introuvable." };
  }

  const newMeta = {
    ...(target.metadata || {}),
    can_dispatch_all: Boolean(params.canDispatchAll)
  };

  const { error: updateError } = await supabase
    .from("user_contexts")
    .update({ metadata: newMeta })
    .eq("id", params.contextId);

  if (updateError) return { success: false, error: updateError.message };
  return { 
    success: true, 
    canDispatchAll: Boolean(params.canDispatchAll), 
    memberName: target.display_name || "Conseiller" 
  };
}

export async function getIntegrationInvites(churchId: string) {
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();
  if (authErr || !user) return { success: false, error: "Non authentifié." };

  const permission = await assertCanReadIntegrationTeam(churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const { data: contexts } = await supabase
    .from("user_contexts")
    .select("role, metadata, active")
    .eq("user_id", user.id)
    .eq("church_id", churchId)
    .eq("context_type", "integration")
    .eq("active", true);

  const isLeader = (contexts || []).some(c => ["integration_responsable", "integration_second"].includes(c.role)) || user.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
  const hasDispatchAll = (contexts || []).some(c => Boolean(c.metadata?.can_dispatch_all));

  let query = supabase.from("invites").select("*").eq("church_id", churchId);
  if (!isLeader && !hasDispatchAll) {
    query = query.or(`created_by.eq.${user.id},assigned_to.eq.${user.id}`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return { success: false, error: error.message };
  return { success: true, invites: data || [], canDispatchAll: hasDispatchAll || isLeader };
}

/**
 * Returns an anonymous monthly integration summary for the pastoral dashboard.
 * The service role is used only after checking the active integration leader,
 * and the response contains aggregate values rather than guest contact details.
 */
export async function getIntegrationMonthlySummary(churchId: string) {
  const permission = await assertCanManageIntegrationTeam(churchId);
  if (!permission.ok) return { success: false as const, error: permission.error };

  try {
    const supabase = await getServiceSupabase();
    const [familyResult, arrivalRows] = await Promise.all([
      supabase.from("bergeries").select("id, name").eq("church_id", churchId).order("name"),
      (async () => {
        const rows: Record<string, any>[] = [];
        const pageSize = 1000;
        for (let start = 0; ; start += pageSize) {
          const { data, error } = await supabase.from("invites")
            .select("arrival_date, phone, faux_numero, appel_abouti, local_church, aps, dans_famille_disciple, famille_disciple, is_in_bergerie, bergerie_id, integre_cdm, pcnc, p101, p201, p301, interet_formation, est_revenu_culte, attendance, motif_retrait, statut_affectation, assigned_to, responsible, prevu_revenir, rdv_pastoral, souhait_suivi, commentaire_suivi")
            .eq("church_id", churchId)
            .eq("archived", false)
            .order("arrival_date", { ascending: true })
            .range(start, start + pageSize - 1);
          if (error) throw error;
          rows.push(...(data || []));
          if ((data || []).length < pageSize) break;
        }
        return rows;
      })(),
    ]);

    if (familyResult.error) throw familyResult.error;

    const normalizeFamily = (name: string) => name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
    const familyNames = new Map<string, string>();
    const familyNamesById = new Map<string, string>();
    for (const name of DEFAULT_DISCIPLE_FAMILIES) familyNames.set(normalizeFamily(name), name);
    for (const row of familyResult.data || []) {
      if (row.name?.trim()) {
        familyNames.set(normalizeFamily(row.name), row.name.trim());
        familyNamesById.set(row.id, row.name.trim());
      }
    }

    const monthBuckets = new Map<string, {
      month: string;
      guestsReceived: number;
      guestsWithoutFamily: number;
      guestsWithPhone: number;
      wrongNumbers: number;
      callsReached: number;
      withLocalChurch: number;
      withoutLocalChurch: number;
      salvationPrayer: number;
      integratedCdm: number;
      pcnc: number;
      returnedToChurch: number;
      returnedWithoutLocalChurch: number;
      fidelizedWithoutLocalChurch: number;
      uninitiatedCalls: number;
      awaitingAssignment: number;
      awaitingContact: number;
      guestsWithoutNextStep: number;
    }>();

    const familyAssignments = new Map<string, { familyName: string; count: number }>();
    const isReturned = (guest: Record<string, any>) => {
      if (guest.est_revenu_culte) return true;
      const attendance = guest.attendance && typeof guest.attendance === "object" ? guest.attendance : {};
      const arrivalDate = typeof guest.arrival_date === "string" ? guest.arrival_date : "";
      return Object.entries(attendance).some(([date, present]) => {
        if (present !== true || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= arrivalDate) return false;
        return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
      });
    };

    for (const guest of arrivalRows) {
      const arrivalDate = typeof guest.arrival_date === "string" ? guest.arrival_date : "";
      const month = arrivalDate.slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) continue;

      let bucket = monthBuckets.get(month);
      if (!bucket) {
        bucket = {
          month, guestsReceived: 0, guestsWithoutFamily: 0, guestsWithPhone: 0, wrongNumbers: 0, callsReached: 0,
          withLocalChurch: 0, withoutLocalChurch: 0, salvationPrayer: 0, integratedCdm: 0,
          pcnc: 0, returnedToChurch: 0, returnedWithoutLocalChurch: 0, fidelizedWithoutLocalChurch: 0,
          uninitiatedCalls: 0, awaitingAssignment: 0, awaitingContact: 0, guestsWithoutNextStep: 0,
        };
        monthBuckets.set(month, bucket);
      }

      bucket.guestsReceived += 1;
      if (typeof guest.phone === "string" && guest.phone.trim()) bucket.guestsWithPhone += 1;
      if (guest.faux_numero === true) bucket.wrongNumbers += 1;
      if (guest.appel_abouti === true) bucket.callsReached += 1;
      if (guest.local_church === true) bucket.withLocalChurch += 1;
      else bucket.withoutLocalChurch += 1;
      if (guest.aps === true) bucket.salvationPrayer += 1;
      if (guest.integre_cdm === true) bucket.integratedCdm += 1;
      if (guest.interet_formation === true || guest.pcnc === true || guest.p101 === true || guest.p201 === true || guest.p301 === true) bucket.pcnc += 1;
      if (isReturned(guest)) {
        bucket.returnedToChurch += 1;
        if (guest.local_church !== true) bucket.returnedWithoutLocalChurch += 1;
      }
      const followupCompleted = guest.motif_retrait === "suivi_termine";
      if (guest.local_church !== true && (isReturned(guest) || followupCompleted)) {
        bucket.fidelizedWithoutLocalChurch += 1;
      }

      const recordedFamily = typeof guest.famille_disciple === "string" ? guest.famille_disciple.trim() : "";
      const hasRecordedFamily = !!recordedFamily && normalizeFamily(recordedFamily) !== "aucune";
      const hasFamily = guest.dans_famille_disciple === true || guest.is_in_bergerie === true || hasRecordedFamily;

      // Pipeline de qualification : Appels non entamés (À affecter ou À contacter)
      const rawStatut = (typeof guest.statut_affectation === "string" && guest.statut_affectation.trim())
        || (typeof guest.commentaire_suivi === "string" ? guest.commentaire_suivi.match(/\[STATUT:\s*([^\]]+)\]/i)?.[1]?.trim() : "")
        || "";
      const motifRetrait = (typeof guest.motif_retrait === "string" && guest.motif_retrait.trim())
        || (typeof guest.commentaire_suivi === "string" ? guest.commentaire_suivi.match(/\[MOTIF_RETRAIT:\s*([^\]]+)\]/i)?.[1]?.trim() : "")
        || "";
      const isAssigned = Boolean(guest.assigned_to || (typeof guest.responsible === "string" && !!guest.responsible.trim() && guest.responsible.trim() !== "Non assigné"));
      const isSansSuite = rawStatut === "sans_suite" || guest.statut_affectation === "sans_suite" || motifRetrait === "sans_suite";
      const isConserve = rawStatut === "conserve" || guest.statut_affectation === "conserve";
      const isSuiviTermine = motifRetrait === "suivi_termine" || followupCompleted;

      const isAwaitingAssignment = !isSansSuite && !isConserve && !isSuiviTermine && !isAssigned;
      const isAwaitingContact = !isSansSuite && !isConserve && !isSuiviTermine && isAssigned && (rawStatut === "en_attente_contact" || !guest.appel_abouti);

      if (isAwaitingAssignment) bucket.awaitingAssignment += 1;
      if (isAwaitingContact) bucket.awaitingContact += 1;
      if (isAwaitingAssignment || isAwaitingContact) {
        bucket.uninitiatedCalls += 1;
      }
      bucket.guestsWithoutNextStep = bucket.uninitiatedCalls;
      const familyName = hasRecordedFamily
        ? recordedFamily
        : hasFamily && typeof guest.bergerie_id === "string" ? familyNamesById.get(guest.bergerie_id) || "" : "";
      if (hasFamily && familyName && normalizeFamily(familyName) !== "aucune") {
        const key = normalizeFamily(familyName);
        familyNames.set(key, familyNames.get(key) || familyName);
        const familyKey = `${month}:${key}`;
        const current = familyAssignments.get(familyKey) || { familyName: familyNames.get(key) || familyName, count: 0 };
        current.count += 1;
        familyAssignments.set(familyKey, current);
      } else {
        bucket.guestsWithoutFamily += 1;
      }
    }

    const months = Array.from(monthBuckets.values()).map(bucket => ({
      ...bucket,
      families: Array.from(familyAssignments.entries())
        .filter(([key]) => key.startsWith(`${bucket.month}:`))
        .map(([, family]) => ({ familyName: family.familyName, count: family.count })),
    })).sort((a, b) => a.month.localeCompare(b.month));

    return {
      success: true as const,
      families: Array.from(familyNames.values()).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" })),
      months,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Impossible de charger le bilan.";
    return {
      success: false as const,
      error: message,
    };
  }
}

const INTEGRATION_REPORT_PLAN_TABLE = "integration_monthly_report_plans";

function isMissingIntegrationReportPlanTable(error: any) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205"
    || (message.includes(INTEGRATION_REPORT_PLAN_TABLE) && (message.includes("does not exist") || message.includes("schema cache")));
}

function isValidIntegrationReportPeriod(period: string) {
  return /^\d{4}-(0[1-9]|1[0-2])(,(0[1-9]|1[0-2])){0,11}$/.test(period)
    && new Set(period.slice(5).split(",")).size === period.slice(5).split(",").length;
}

/** Loads the shared preparation notes and optional monthly target for a selected report period. */
export async function getIntegrationMonthlyReportPlan(churchId: string, period: string) {
  const permission = await assertCanManageIntegrationTeam(churchId);
  if (!permission.ok) return { success: false as const, error: permission.error };
  if (!isValidIntegrationReportPeriod(period)) return { success: false as const, error: "Période invalide." };

  try {
    const supabase = await getServiceSupabase();
    const { data, error } = await supabase.from(INTEGRATION_REPORT_PLAN_TABLE)
      .select("monthly_guest_target, observation, challenge, action, owner, due_date")
      .eq("church_id", churchId).eq("report_period", period).maybeSingle();
    if (error) {
      if (isMissingIntegrationReportPlanTable(error)) return { success: false as const, setupRequired: true as const, error: "La table des plans de bilan n’est pas encore installée." };
      throw error;
    }
    return { success: true as const, plan: data || null };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Impossible de charger le plan du bilan." };
  }
}

/** Saves shared report preparation notes and an optional target, limited to integration leaders. */
export async function saveIntegrationMonthlyReportPlan(params: {
  churchId: string;
  period: string;
  monthlyGuestTarget: number | null;
  observation: string;
  challenge: string;
  action: string;
  owner: string;
  dueDate: string;
}) {
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false as const, error: permission.error };
  if (!isValidIntegrationReportPeriod(params.period)) return { success: false as const, error: "Période invalide." };
  if (params.monthlyGuestTarget !== null && (!Number.isInteger(params.monthlyGuestTarget) || params.monthlyGuestTarget < 0 || params.monthlyGuestTarget > 1000000)) {
    return { success: false as const, error: "L’objectif mensuel doit être un nombre entier positif." };
  }
  const textFields = [params.observation, params.challenge, params.action, params.owner];
  if (textFields.some(value => typeof value !== "string" || value.length > 2000)) return { success: false as const, error: "Chaque note doit contenir au maximum 2 000 caractères." };
  if (params.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(params.dueDate)) return { success: false as const, error: "Date d’échéance invalide." };

  try {
    const supabase = await getServiceSupabase();
    const { error } = await supabase.from(INTEGRATION_REPORT_PLAN_TABLE).upsert({
      church_id: params.churchId,
      report_period: params.period,
      monthly_guest_target: params.monthlyGuestTarget,
      observation: params.observation.trim(),
      challenge: params.challenge.trim(),
      action: params.action.trim(),
      owner: params.owner.trim(),
      due_date: params.dueDate || null,
      updated_by: permission.user?.id ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "church_id,report_period" });
    if (error) {
      if (isMissingIntegrationReportPlanTable(error)) return { success: false as const, setupRequired: true as const, error: "La table des plans de bilan n’est pas encore installée." };
      throw error;
    }
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Impossible d’enregistrer le plan du bilan." };
  }
}

export async function assignCounselorToGuest(params: {
  churchId: string;
  guestId: string;
  counselorId: string | null;
}) {
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();
  if (authErr || !user) return { success: false, error: "Non authentifié." };

  const permission = await assertCanReadIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const { data: contexts } = await supabase
    .from("user_contexts")
    .select("role, metadata, active")
    .eq("user_id", user.id)
    .eq("church_id", params.churchId)
    .eq("context_type", "integration")
    .eq("active", true);

  const isLeader = (contexts || []).some(c => ["integration_responsable", "integration_second"].includes(c.role)) || user.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
  const hasDispatchAll = (contexts || []).some(c => Boolean(c.metadata?.can_dispatch_all));
  const isSelfAssign = params.counselorId === user.id;

  if (!isLeader && !hasDispatchAll && !isSelfAssign) {
    return { success: false, error: "Vous n'avez pas l'autorisation d'affecter cette âme à un tiers." };
  }

  let respName = "";
  if (params.counselorId) {
    const { data: cProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", params.counselorId)
      .maybeSingle();
    
    if (cProfile?.display_name) {
      respName = cProfile.display_name;
    } else {
      const { data: cContext } = await supabase
        .from("user_contexts")
        .select("display_name")
        .eq("user_id", params.counselorId)
        .eq("church_id", params.churchId)
        .eq("context_type", "integration")
        .maybeSingle();
      respName = cContext?.display_name || "";
    }
  } else {
    respName = "Non assigné";
  }

  const updatePayload: Record<string, any> = { 
    assigned_to: params.counselorId,
    statut_affectation: params.counselorId ? "en_attente_contact" : "a_affecter",
    responsible: respName
  };

  const { error: updateError } = await supabase
    .from("invites")
    .update(updatePayload)
    .eq("id", params.guestId)
    .eq("church_id", params.churchId);

  if (updateError) {
    // If statut_affectation column is missing before SQL patch, fallback to payload without it
    if (updateError.message.includes("statut_affectation")) {
      const fallbackPayload: Record<string, any> = { 
        assigned_to: params.counselorId,
        responsible: respName 
      };
      const { error: fbErr } = await supabase
        .from("invites")
        .update(fallbackPayload)
        .eq("id", params.guestId)
        .eq("church_id", params.churchId);
      if (fbErr) return { success: false, error: fbErr.message };
    } else {
      return { success: false, error: updateError.message };
    }
  }

  // Enregistrement de la notification pour le conseiller (non-bloquant)
  if (params.counselorId) {
    try {
      const { data: gData } = await supabase
        .from("invites")
        .select("first_name, last_name, civility, phone")
        .eq("id", params.guestId)
        .maybeSingle();

      const guestFullName = [gData?.civility, gData?.first_name, gData?.last_name].filter(Boolean).join(" ").trim() || "Un nouvel invité";

      await supabase.from("notifications").insert({
        church_id: params.churchId,
        user_id: params.counselorId,
        type: "assignment",
        title: "Nouvel invité confié",
        message: `${guestFullName} vous a été confié(e) pour le suivi pastoral.`,
        guest_id: params.guestId,
        guest_name: guestFullName,
        guest_phone: gData?.phone || null,
        is_read: false
      });
    } catch {
      // Ignoré sans bloquer si la table notifications n'a pas encore été créée
    }
  }

  return { success: true, responsible: respName };
}

export interface ConserveGuestPayload {
  prevuRevenir?: boolean;
  estRevenuCulte?: boolean;
  groupeWhatsapp?: boolean;
  interetFormation?: boolean;
  interetCDM?: boolean;
  piliers1?: boolean;
  souhaitSuivi?: boolean;
  rdvPastoral?: boolean;
  visiteDomicile?: boolean;
  aps?: boolean;
  commentaireSuivi?: string;
}

export async function conserveGuestAction(params: {
  churchId: string;
  guestId: string;
  payload: ConserveGuestPayload;
}) {
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();
  if (authErr || !user) return { success: false, error: "Non authentifié." };

  const permission = await assertCanReadIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();

  // Fetch current guest comment to preserve it
  const { data: currentGuest } = await supabase
    .from("invites")
    .select("commentaire_suivi, assigned_to")
    .eq("id", params.guestId)
    .maybeSingle();

  const prevComment = currentGuest?.commentaire_suivi || "";
  const cleanedPrev = prevComment.replace(/\[STATUT:[^\]]+\]\s*/gi, "").trim();
  const newComment = params.payload.commentaireSuivi ? params.payload.commentaireSuivi.trim() : "";
  const combinedComment = `[STATUT:conserve] ${newComment || cleanedPrev}`.trim();

  const updateData: Record<string, any> = {
    appel_abouti: true,
    statut_affectation: "conserve",
    prevu_revenir: Boolean(params.payload.prevuRevenir),
    est_revenu_culte: Boolean(params.payload.estRevenuCulte),
    groupe_whatsapp: Boolean(params.payload.groupeWhatsapp),
    interet_formation: Boolean(params.payload.interetFormation),
    interet_cdm: Boolean(params.payload.interetCDM),
    piliers_1: Boolean(params.payload.piliers1),
    souhait_suivi: Boolean(params.payload.souhaitSuivi),
    rdv_pastoral: Boolean(params.payload.rdvPastoral),
    visite_domicile: Boolean(params.payload.visiteDomicile),
    aps: Boolean(params.payload.aps),
    commentaire_suivi: combinedComment
  };

  const { error: updateError } = await supabase
    .from("invites")
    .update(updateData)
    .eq("id", params.guestId)
    .eq("church_id", params.churchId);

  if (updateError) {
    console.warn("Full conserve update failed, attempting safe fallback:", updateError.message);
    // Try without newer optional columns
    const safeData: Record<string, any> = {
      appel_abouti: true,
      commentaire_suivi: combinedComment,
      prevu_revenir: Boolean(params.payload.prevuRevenir),
      est_revenu_culte: Boolean(params.payload.estRevenuCulte),
      aps: Boolean(params.payload.aps)
    };
    const { error: safeErr } = await supabase
      .from("invites")
      .update(safeData)
      .eq("id", params.guestId)
      .eq("church_id", params.churchId);

    if (safeErr) {
      // Minimal fallback: only core columns guaranteed in invites
      const { error: minErr } = await supabase
        .from("invites")
        .update({ appel_abouti: true, commentaire_suivi: combinedComment })
        .eq("id", params.guestId)
        .eq("church_id", params.churchId);
      if (minErr) return { success: false, error: minErr.message };
    }
  }

  return { success: true };
}

export async function retireGuestAction(params: {
  churchId: string;
  guestId: string;
  motif: string;
  autreEglise?: string;
  commentaire: string;
  appelAbouti?: boolean;
}) {
  const allowedMotifs = new Set(["ne_decroche_pas", "faux_numero", "autre_eglise", "pas_interesse", "demenagement", "autre"]);
  if (!allowedMotifs.has(params.motif)) return { success: false, error: "Motif de retrait invalide." };

  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();
  if (authErr || !user) return { success: false, error: "Non authentifié." };

  const permission = await assertCanReadIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();

  const isFauxNumero = params.motif === "faux_numero";
  const isNeDecrochePas = params.motif === "ne_decroche_pas";
  const isAutreEglise = params.motif === "autre_eglise";
  const isPasInteresse = params.motif === "pas_interesse";

  // Détermination de l'aboutissement de l'appel :
  // Si le conseiller a explicitement indiqué appelAbouti, on respecte son choix.
  // Sinon valeur par défaut intelligente selon le motif choisi.
  let finalAppelAbouti = false;
  if (typeof params.appelAbouti === "boolean") {
    finalAppelAbouti = params.appelAbouti;
  } else if (isFauxNumero || isNeDecrochePas) {
    finalAppelAbouti = false;
  } else if (["autre_eglise", "pas_interesse", "demenagement"].includes(params.motif)) {
    finalAppelAbouti = true;
  }

  const { data: currentGuest } = await supabase
    .from("invites")
    .select("commentaire_suivi")
    .eq("id", params.guestId)
    .maybeSingle();

  const prevComment = currentGuest?.commentaire_suivi || "";
  const cleanedPrev = prevComment
    .replace(/\[[A-Za-z0-9_]+:[^\]]*\]\s*/gi, "")
    .replace(/\[(?:FAUX_NUMERO|NE_DECROCHE_PAS)\]\s*/gi, "")
    .replace(/Retir[ée] directement depuis l'onglet Mes [âa]mes/gi, "")
    .trim();

  const isAutoPlaceholder = !params.commentaire || /retir[ée] directement depuis l'onglet mes [âa]mes/i.test(params.commentaire);
  const userComment = isAutoPlaceholder ? "" : params.commentaire.trim();

  const parts = [userComment, cleanedPrev].filter(Boolean);
  const commentNote = parts.length === 2 && userComment.includes(cleanedPrev)
    ? userComment
    : parts.join(" \n");

  const encodedTags = [
    `[STATUT:sans_suite]`,
    `[MOTIF_RETRAIT:${params.motif}]`,
    `[RETIRE_PAR:${user.id}]`,
    `[RETIRE_AT:${new Date().toISOString()}]`,
    `[RAISON_ECHEC:${params.motif}]`,
    `[APPEL_ABOUTI:${finalAppelAbouti ? "oui" : "non"}]`,
    isAutreEglise && params.autreEglise ? `[AUTRE_EGLISE:${params.autreEglise.trim()}]` : "",
    isFauxNumero ? `[FAUX_NUMERO]` : "",
    isNeDecrochePas ? `[NE_DECROCHE_PAS]` : ""
  ].filter(Boolean).join(" ");

  const combinedComment = `${encodedTags} ${commentNote}`.trim();

  const updateData: Record<string, any> = {
    statut_affectation: "sans_suite",
    motif_retrait: params.motif,
    retire_par: user.id,
    retire_at: new Date().toISOString(),
    raison_echec: params.motif,
    commentaire_suivi: combinedComment,
    appel_abouti: finalAppelAbouti
  };

  if (isFauxNumero) {
    updateData.faux_numero = true;
    updateData.ne_decroche_pas = false;
  }
  if (isNeDecrochePas) {
    updateData.ne_decroche_pas = true;
    updateData.faux_numero = false;
  }
  if (isAutreEglise) {
    updateData.local_church = true;
  }
  if (isPasInteresse) {
    updateData.souhaite_etre_contacte = false;
    updateData.souhait_suivi = false;
  }

  const { error: updateError } = await supabase
    .from("invites")
    .update(updateData)
    .eq("id", params.guestId)
    .eq("church_id", params.churchId);

  if (updateError) {
    console.warn("Full retire update failed, attempting safe fallback:", updateError.message);
    
    // Remove columns that might not exist in the database yet (patch v7.2 and v7.3)
    delete updateData.statut_affectation;
    delete updateData.motif_retrait;
    delete updateData.retire_par;
    delete updateData.retire_at;
    delete updateData.raison_echec;
    delete updateData.faux_numero;
    delete updateData.ne_decroche_pas;
    delete updateData.souhait_suivi;

    const { error: retryError } = await supabase
      .from("invites")
      .update(updateData)
      .eq("id", params.guestId)
      .eq("church_id", params.churchId);

    if (retryError) {
      // Ultimate minimal fallback: only core columns guaranteed in invites
      const { error: minErr } = await supabase
        .from("invites")
        .update({ appel_abouti: finalAppelAbouti, commentaire_suivi: combinedComment })
        .eq("id", params.guestId)
        .eq("church_id", params.churchId);

      if (minErr) return { success: false, error: minErr.message };
    }
  }

  return { success: true };
}

/** Closes a counselor's active follow-up while recording the guest as fidelized. */
export async function completeGuestFollowupAction(params: {
  churchId: string;
  guestId: string;
}) {
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();
  if (authErr || !user) return { success: false, error: "Non authentifié." };

  const permission = await assertCanReadIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const { data: guest, error: guestError } = await supabase
    .from("invites")
    .select("assigned_to, responsible, appel_abouti, statut_affectation, motif_retrait, commentaire_suivi")
    .eq("id", params.guestId)
    .eq("church_id", params.churchId)
    .maybeSingle();

  if (guestError || !guest) {
    return { success: false, error: guestError?.message || "Invité introuvable." };
  }

  const counselorOwnsAssignment = guest.assigned_to === user.id;
  let legacyAssignmentName = "";
  if (!counselorOwnsAssignment && !guest.assigned_to) {
    const { data: memberships } = await supabase
      .from("user_contexts")
      .select("user_id, display_name")
      .eq("church_id", params.churchId)
      .eq("context_type", "integration")
      .eq("active", true)
      .in("role", ["integration_conseiller", "conseiller"]);
    const matchingMemberships = (memberships || []).filter((membership: { display_name?: string | null }) =>
      membership.display_name?.trim().toLocaleLowerCase("fr") === (guest.responsible || "").trim().toLocaleLowerCase("fr")
    );
    if (matchingMemberships.length === 1 && matchingMemberships[0].user_id === user.id) {
      legacyAssignmentName = matchingMemberships[0].display_name?.trim() || "";
    }
  }

  if (!counselorOwnsAssignment && !legacyAssignmentName) {
    return { success: false, error: "Seul le conseiller chargé de cet invité peut terminer son suivi." };
  }

  const previousComment = guest.commentaire_suivi || "";
  const previousMotif = guest.motif_retrait || previousComment.match(/\[MOTIF_RETRAIT:\s*([^\]]+)\]/i)?.[1]?.trim();
  const previousStatus = guest.statut_affectation || previousComment.match(/\[STATUT:\s*([^\]]+)\]/i)?.[1]?.trim();
  if (previousStatus === "sans_suite" && previousMotif === "suivi_termine") {
    return { success: false, error: "Ce suivi est déjà clôturé comme fidélisé." };
  }
  if (previousStatus === "sans_suite" || (previousStatus !== "conserve" && guest.appel_abouti !== true)) {
    return { success: false, error: "Seul un suivi actif peut être clôturé comme fidélisé." };
  }

  const retiredAt = new Date().toISOString();
  const cleanComment = previousComment
    .replace(/\[STATUT:\s*[^\]]+\]\s*/gi, "")
    .replace(/\[MOTIF_RETRAIT:\s*[^\]]+\]\s*/gi, "")
    .replace(/\[RETIRE_PAR:\s*[^\]]+\]\s*/gi, "")
    .replace(/\[RETIRE_AT:\s*[^\]]+\]\s*/gi, "")
    .trim();
  const combinedComment = [
    "[STATUT:sans_suite]",
    "[MOTIF_RETRAIT:suivi_termine]",
    `[RETIRE_PAR:${user.id}]`,
    `[RETIRE_AT:${retiredAt}]`,
    cleanComment
  ].filter(Boolean).join(" ");

  const updateOwnedGuest = async (payload: Record<string, unknown>) => {
    let query = supabase.from("invites").update(payload).eq("id", params.guestId).eq("church_id", params.churchId);
    query = counselorOwnsAssignment
      ? query.eq("assigned_to", user.id)
      : query.is("assigned_to", null).eq("responsible", guest.responsible);
    return query.select("id").maybeSingle();
  };

  const { data: updated, error: updateError } = await updateOwnedGuest({
    statut_affectation: "sans_suite",
    motif_retrait: "suivi_termine",
    retire_par: user.id,
    retire_at: retiredAt,
    commentaire_suivi: combinedComment
  });

  if (updateError) {
    // Preserve compatibility with installations where some triage columns are not deployed yet.
    const { data: safeUpdated, error: safeError } = await updateOwnedGuest({
      statut_affectation: "sans_suite",
      motif_retrait: "suivi_termine",
      commentaire_suivi: combinedComment
    });
    if (safeError) {
      const { data: statusUpdated, error: statusError } = await updateOwnedGuest({
        statut_affectation: "sans_suite",
        commentaire_suivi: combinedComment
      });
      if (statusError) {
        const { data: motifUpdated, error: motifError } = await updateOwnedGuest({
          motif_retrait: "suivi_termine",
          commentaire_suivi: combinedComment
        });
        if (motifError) {
          const { data: commentUpdated, error: commentError } = await updateOwnedGuest({ commentaire_suivi: combinedComment });
          if (commentError) return { success: false, error: commentError.message };
          if (!commentUpdated) return { success: false, error: "L’affectation a changé. Rechargez la liste avant de réessayer." };
        } else if (!motifUpdated) {
          return { success: false, error: "L’affectation a changé. Rechargez la liste avant de réessayer." };
        }
      } else if (!statusUpdated) {
        return { success: false, error: "L’affectation a changé. Rechargez la liste avant de réessayer." };
      }
    } else if (!safeUpdated) {
      return { success: false, error: "L’affectation a changé. Rechargez la liste avant de réessayer." };
    }
  } else if (!updated) {
    return { success: false, error: "L’affectation a changé. Rechargez la liste avant de réessayer." };
  }

  return { success: true };
}


