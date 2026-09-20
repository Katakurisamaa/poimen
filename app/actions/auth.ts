"use server";

if (typeof process !== "undefined" && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { SUPER_ADMIN_EMAIL, inferContextType, normalizeFamilyRole } from "@/lib/auth-contexts";
import { isUuid, isFamilyLeader, validTeamInput } from "@/lib/security-validation";

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
  let profiles: any[] = [];
  if (userIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, display_name, created_at")
      .in("id", userIds);
    profiles = data || [];
  }

  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

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

  return {
    success: true,
    team: (contexts || []).map((context: any) => {
      const profile = profileMap.get(context.user_id);
      return {
        id: context.user_id,
        contextId: context.id,
        email: context.email || profile?.email,
        name: context.display_name || profile?.display_name || context.email,
        role: context.role === "integration_responsable" ? "Responsable" : context.role === "integration_second" ? "Second" : "Conseiller",
        status: "active",
        workload: workloadMap[context.user_id] || 0,
        createdAt: context.created_at || profile?.created_at
      };
    })
  };
}

export async function createIntegrationTeamMember(params: {
  churchId: string;
  firstName: string;
  lastName: string;
  email: string;
  accessCode: string;
  role: string;
}) {
  if (!params || !validTeamInput(params)) return { success: false, error: "Coordonnées invalides." };
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const cleanEmail = params.email.toLowerCase().trim();
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
  const { data: targets, error: targetsError } = await supabase.from("user_contexts")
    .select("id, role, email").eq("user_id", params.userId).eq("church_id", params.churchId).eq("context_type", "integration");
  if (targetsError || !targets?.length) return { success: false, error: "Membre introuvable." };
  if (params.contextId && !targets.some(t => t.id === params.contextId)) return { success: false, error: "Accès introuvable dans cette église." };
  if (targets.some(t => t.role === "integration_responsable" || t.email.toLowerCase().trim() === SUPER_ADMIN_EMAIL)
    && permission.user?.email?.toLowerCase().trim() !== SUPER_ADMIN_EMAIL) {
    return { success: false, error: "Seul l'administrateur central peut désactiver ce responsable." };
  }
  let query = supabase
    .from("user_contexts")
    .update({ active: false })
    .eq("user_id", params.userId)
    .eq("church_id", params.churchId)
    .eq("context_type", "integration");

  if (params.contextId) query = query.eq("id", params.contextId);

  const { error } = await query;
  if (error) return { success: false, error: error.message };

  await supabase
    .from("invites")
    .update({ assigned_to: null })
    .eq("church_id", params.churchId)
    .eq("assigned_to", params.userId);

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

    // 2. Add department head from church
    if (church.integration_email && church.integration_first_name) {
      list.push({
        email: church.integration_email.toLowerCase().trim(),
        name: `${church.integration_first_name} ${church.integration_last_name || ""}`.trim(),
        role: "integration_responsable",
        isHead: true,
        code: church.integration_access_code
      });
    }

    // 3. Fetch active integration contexts
    const { data: contexts, error: contextsErr } = await supabase
      .from("user_contexts")
      .select("user_id, email, display_name, role")
      .eq("church_id", churchId)
      .eq("context_type", "integration")
      .eq("active", true)
      .in("role", ["integration_responsable", "integration_second", "integration_conseiller"]);

    const contextUserIds = [...new Set((contexts || []).map((c: any) => c.user_id).filter(Boolean))];
    let contextProfiles: any[] = [];
    if (contextUserIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, display_name")
        .in("id", contextUserIds);
      contextProfiles = profs || [];
    }
    const contextProfileMap = new Map(contextProfiles.map((p: any) => [p.id, p]));

    if (!contextsErr && contexts) {
      contexts.forEach((c: any) => {
        const prof = contextProfileMap.get(c.user_id);
        const email = (c.email || prof?.email)?.toLowerCase().trim();
        const name = c.display_name || prof?.display_name || email;
        if (email) {
          list.push({
            email,
            name,
            role: c.role,
            isContext: true
          });
        }
      });
    }

    // 4. Fetch active integration profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("email, display_name, role")
      .eq("church_id", churchId)
      .eq("active", true)
      .ilike("role", "integration_%");

    if (!profilesErr && profiles) {
      profiles.forEach((p: any) => {
        if (p.email) {
          list.push({
            email: p.email.toLowerCase().trim(),
            name: p.display_name || p.email,
            role: p.role,
            isProfile: true
          });
        }
      });
    }

    // 5. Fetch pending counselors
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_counselors")
      .select("email, first_name, last_name, role, access_code")
      .eq("church_id", churchId);

    if (!pendingErr && pending) {
      pending.forEach((p: any) => {
        if (p.email) {
          list.push({
            email: p.email.toLowerCase().trim(),
            name: `${p.first_name} ${p.last_name || ""}`.trim(),
            role: p.role || "integration_conseiller",
            isPending: true,
            code: p.access_code
          });
        }
      });
    }

    // Deduplicate by email
    const uniqueMap = new Map<string, any>();
    list.forEach(item => {
      const email = item.email?.toLowerCase().trim();
      if (email && !uniqueMap.has(email)) {
        uniqueMap.set(email, {
          email,
          name: item.name || email,
          role: item.role || "integration_conseiller",
          isHead: item.isHead,
          isPending: item.isPending,
          code: item.code
        });
      }
    });

    const uniqueList = Array.from(uniqueMap.values());

    const roleRank = (role: string) => {
      const r = (role || "").toLowerCase();
      if (r === "integration_responsable") return 1;
      if (r === "integration_second") return 2;
      return 3;
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
  email: string;
  accessCode?: string;
  role: string;
}) {
  if (!params || !validTeamInput(params) || !isUuid(params.userId) || !isUuid(params.contextId)) {
    return { success: false, error: "Membre invalide." };
  }
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const cleanEmail = params.email.toLowerCase().trim();
  const displayName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
  const role = params.role === "integration_second" ? "integration_second" : params.role === "integration_responsable" ? "integration_responsable" : "integration_conseiller";

  // An organisation manager may edit membership, never global account credentials.
  const { data: target, error: targetError } = await supabase.from("user_contexts")
    .select("id, email, role")
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
  const { error: contextError } = await supabase
    .from("user_contexts")
    .update({
      email: cleanEmail,
      display_name: displayName,
      role: role
    })
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
