"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { SUPER_ADMIN_EMAIL, inferContextType, normalizeFamilyRole } from "@/lib/auth-contexts";

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

async function upsertUserContext(supabase: any, userId: string, email: string, access: ResolvedAccess) {
  const contextType = inferContextType(access.role, access.bergerieId);

  let query = supabase
    .from("user_contexts")
    .select("*")
    .eq("user_id", userId)
    .eq("context_type", contextType)
    .eq("role", access.role);

  query = access.churchId ? query.eq("church_id", access.churchId) : query.is("church_id", null);
  query = access.bergerieId ? query.eq("bergerie_id", access.bergerieId) : query.is("bergerie_id", null);

  const { data: existing } = await query.maybeSingle();
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
      active: true
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
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

  if (authErr || !user) {
    return { ok: false, error: "Non authentifie." };
  }

  const cleanEmail = user.email?.toLowerCase().trim();
  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    return { ok: true, user };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role, church_id")
    .eq("id", user.id)
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

export async function listIntegrationTeam(churchId: string) {
  const permission = await assertCanManageIntegrationTeam(churchId);
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
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const cleanEmail = params.email.toLowerCase().trim();
  const displayName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
  const role = params.role === "integration_second" ? "integration_second" : "integration_conseiller";

  let targetUser = await findAuthUserByEmail(supabase, cleanEmail);
  let createdAuthUser = false;

  if (!targetUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: params.accessCode,
      email_confirm: true
    });
    if (error) return { success: false, error: error.message };
    targetUser = data.user;
    createdAuthUser = true;
  } else {
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      { password: params.accessCode }
    );
    if (updateErr) return { success: false, error: updateErr.message };
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

  const { error: contextError } = await upsertUserContext(supabase, targetUser.id, cleanEmail, access);
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
    requiresPrimaryPassword: false
  };
}

export async function deactivateIntegrationTeamMember(params: { churchId: string; userId: string; contextId?: string | null }) {
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
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

  if (!chErr && church) {
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

    if (!pcErr && pendingCounselor) {
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

      if (!memErr && member && member.bergeries) {
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

    const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) {
      return { success: false, error: `Recuperation du compte existant echouee: ${listErr.message}` };
    }

    const existingUser = usersData?.users?.find(u => u.email?.toLowerCase().trim() === cleanEmail);
    if (!existingUser) {
      return { success: false, error: "Compte existant introuvable." };
    }

    targetUserId = existingUser.id;
    targetUser = existingUser;
    requiresPrimaryPassword = true;
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
    user: targetUser,
    role: resolvedRole,
    displayName: resolvedDisplayName,
    churchId: resolvedChurchId,
    bergerieId: resolvedBergerieId,
    context,
    requiresPrimaryPassword,
    churchData,
    familyData
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
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authErr } = await serverSupabase.auth.getUser();

  if (authErr || !user) {
    return { success: false, error: "Non authentifie." };
  }

  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin" || user.email?.toLowerCase().trim() === SUPER_ADMIN_EMAIL;
  const isSelf = user.email?.toLowerCase().trim() === params.email.toLowerCase().trim();

  if (!isSelf && !isSuperAdmin) {
    return { success: false, error: "Non autorise. Vous ne pouvez ajouter que votre propre profil de leader." };
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
      status: params.status,
      is_conseiller: params.is_conseiller || false,
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
    const supabase = await getServiceSupabase();
    const list: any[] = [];

    // 1. Fetch pending counselors
    const { data: pending, error: pendingErr } = await supabase
      .from("pending_counselors")
      .select("*")
      .eq("church_id", churchId);

    if (!pendingErr && pending) {
      pending.forEach((p: any) => {
        list.push({
          email: p.email.toLowerCase().trim(),
          name: `${p.first_name} ${p.last_name}`,
          role: p.role || "integration_counselor",
          isPending: true,
          code: p.access_code
        });
      });
    }

    // 2. Fetch active integration profiles
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("church_id", churchId)
      .ilike("role", "integration_%");

    if (!profilesErr && profiles) {
      profiles.forEach((p: any) => {
        list.push({
          email: p.email.toLowerCase().trim(),
          name: p.display_name,
          role: p.role,
          isProfile: true
        });
      });
    }

    // 3. Fetch active integration contexts
    const { data: contexts, error: contextsErr } = await supabase
      .from("user_contexts")
      .select("*")
      .eq("church_id", churchId)
      .eq("context_type", "integration")
      .eq("active", true);

    if (!contextsErr && contexts) {
      contexts.forEach((c: any) => {
        list.push({
          email: c.email.toLowerCase().trim(),
          name: c.display_name,
          role: c.role,
          isContext: true
        });
      });
    }

    // Remove duplicates by email
    const uniqueList: any[] = [];
    const emailsSeen = new Set<string>();
    list.forEach(item => {
      if (!emailsSeen.has(item.email)) {
        emailsSeen.add(item.email);
        uniqueList.push(item);
      }
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
  const permission = await assertCanManageIntegrationTeam(params.churchId);
  if (!permission.ok) return { success: false, error: permission.error };

  const supabase = await getServiceSupabase();
  const cleanEmail = params.email.toLowerCase().trim();
  const displayName = `${params.firstName.trim()} ${params.lastName.trim()}`.trim();
  const role = params.role === "integration_second" ? "integration_second" : params.role === "integration_responsable" ? "integration_responsable" : "integration_conseiller";

  // 1. Update auth email & password if provided
  const updatePayload: any = { email: cleanEmail };
  if (params.accessCode) {
    updatePayload.password = params.accessCode;
  }

  const { error: authError } = await supabase.auth.admin.updateUserById(params.userId, updatePayload);
  if (authError) return { success: false, error: authError.message };

  // 2. Update user_contexts
  const { error: contextError } = await supabase
    .from("user_contexts")
    .update({
      email: cleanEmail,
      display_name: displayName,
      role: role
    })
    .eq("id", params.contextId);

  if (contextError) return { success: false, error: contextError.message };

  // 3. Update profiles
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      email: cleanEmail,
      display_name: displayName
    })
    .eq("id", params.userId);

  if (profileError) return { success: false, error: profileError.message };

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

