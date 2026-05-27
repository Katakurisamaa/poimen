"use server";

import { createClient } from "@supabase/supabase-js";

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

  // Try creating the user
  const { data, error } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password: accessCode,
    email_confirm: true
  });

  if (error) {
    // If user already exists, update their password so they can log in with this access code
    if (error.message.includes("already") || error.message.includes("registered") || error.message.includes("exists")) {
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
            return { success: true, user: updateData.user };
          }
        }
      } catch (err: any) {
        return { success: false, error: `Erreur d'auto-récupération: ${err.message}` };
      }
    }
    return { success: false, error: error.message };
  }

  return { success: true, user: data.user };
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

