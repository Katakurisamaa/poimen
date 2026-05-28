"use server";

import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase-server";

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

  // 1. Verify credentials against the database tables using service role
  let resolvedRole = "";
  let resolvedChurchId = "";
  let resolvedBergerieId = "";
  let resolvedDisplayName = "";
  let pendingCounselorIdToDelete = "";
  let churchData: any = null;
  let familyData: any = null;

  // Scenario 1: Church Integration Responsable
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
      : "Responsable Intégration";
    churchData = church;
  } else {
    // Scenario 2: Pending Counselor
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
      // Scenario 3: Family member
      const { data: member, error: memErr } = await supabase
        .from("members")
        .select("*, bergeries(*)")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!memErr && member && member.bergeries) {
        const familyCode = member.bergeries.access_code;
        if (familyCode && accessCode === familyCode) {
          resolvedRole = member.status ? (
            member.status.toLowerCase().trim() === "responsable" || member.status.toLowerCase().trim() === "responsable de brebis" ? "responsable de brebi" :
            member.status.toLowerCase().trim() === "second" || member.status.toLowerCase().trim() === "second du berger" ? "second du berger" :
            member.status.toLowerCase().trim()
          ) : "membre";
          resolvedBergerieId = member.bergerie_id;
          resolvedChurchId = member.bergeries.church_id;
          resolvedDisplayName = `${member.first_name} ${member.last_name}`;
          familyData = member.bergeries;
          
          // Also fetch church info for family member
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
    return { success: false, error: "Informations d'identification invalides. Veuillez vérifier vos accès." };
  }

  // Credentials are valid, now create or update the auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password: accessCode,
    email_confirm: true
  });

  let targetUserId = "";
  let targetUser = null;

  if (authErr) {
    if (authErr.message.includes("already") || authErr.message.includes("registered") || authErr.message.includes("exists")) {
      try {
        const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers();
        if (!listErr && usersData?.users) {
          const existingUser = usersData.users.find(u => u.email?.toLowerCase().trim() === cleanEmail);
          if (existingUser) {
            const { data: updateData, error: updateErr } = await supabase.auth.admin.updateUserById(
              existingUser.id,
              { password: accessCode }
            );
            if (updateErr) {
              return { success: false, error: `Mise à jour du mot de passe échouée: ${updateErr.message}` };
            }
            targetUserId = existingUser.id;
            targetUser = updateData.user;
          }
        }
      } catch (err: any) {
        return { success: false, error: `Erreur d'auto-récupération: ${err.message}` };
      }
    } else {
      return { success: false, error: authErr.message };
    }
  } else {
    targetUserId = authData.user.id;
    targetUser = authData.user;
  }

  if (!targetUserId || !targetUser) {
    return { success: false, error: "Échec de création ou mise à jour de l'utilisateur." };
  }

  // Create or update their profile server-side under service_role
  const { error: profError } = await supabase.from("profiles").upsert({
    id: targetUserId,
    email: cleanEmail,
    display_name: resolvedDisplayName,
    role: resolvedRole,
    church_id: resolvedChurchId || null,
    bergerie_id: resolvedBergerieId || null,
    active: true
  });

  if (profError) {
    return { success: false, error: `Création ou mise à jour du profil échouée: ${profError.message}` };
  }

  // Delete pending counselor record if applicable
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
    return { success: false, error: "Non authentifié." };
  }

  // Security check: only allow adding themselves, or if they are super_admin
  const { data: profile } = await serverSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "super_admin" || user.email?.toLowerCase().trim() === "minkojunior400@gmail.com";
  const isSelf = user.email?.toLowerCase().trim() === params.email.toLowerCase().trim();

  if (!isSelf && !isSuperAdmin) {
    return { success: false, error: "Non autorisé. Vous ne pouvez ajouter que votre propre profil de leader." };
  }

  // Proceed with inserting the member using the service role
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
