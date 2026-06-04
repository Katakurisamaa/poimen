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
