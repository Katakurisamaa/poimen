"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Plus, Users, UserCheck, Calendar, MapPin, Phone, User as UserIcon,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Search, 
  HelpCircle, Eye, Trash2, ArrowRightLeft, MessageSquare, AlertCircle,
  Heart, Flame, UserPlus
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Evangelisation {
  id: string;
  church_id: string;
  bergerie_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  address?: string | null;
  is_anonymous: boolean;
  anonymous_description?: string | null;
  people_count: number;
  prayer_salvation: boolean;
  prayer_healing: boolean;
  prayer_other: boolean;
  prayer_other_details?: string | null;
  has_invitation: boolean;
  attended_service: boolean;
  comment?: string | null;
  created_by: string;
  converted_guest_id?: string | null;
  evangelisation_date: string;
  created_at: string;
  is_contacted: boolean;
  call_comment?: string | null;
  invitations_count?: number | null;
  profiles?: {
    display_name: string;
  } | null;
}

export default function EvangelisationPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<Evangelisation | null>(null);
  
  // User info
  const [userInfo, setUserInfo] = useState<any>(null);
  const [userRoleClean, setUserRoleClean] = useState("");
  const [userId, setUserId] = useState("");
  const [churchId, setChurchId] = useState("");
  const [familyId, setFamilyId] = useState("");
  
  // Tabulation
  const [activeTab, setActiveTab] = useState<"mine" | "all">("mine");
  
  // Saisie lists
  const [evangelisations, setEvangelisations] = useState<Evangelisation[]>([]);
  const [search, setSearch] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form State
  const [formMode, setFormMode] = useState<"nominative" | "anonymous_single" | "anonymous_bulk">("nominative");
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    address: "",
    anonymous_description: "",
    people_count: 1,
    prayer_salvation: false,
    prayer_healing: false,
    prayer_other: false,
    prayer_other_details: "",
    has_invitation: false,
    attended_service: false,
    comment: "",
    evangelisation_date: new Date().toISOString().split("T")[0],
    invitations_count: 0
  });

  const isIntegration = useMemo(() => userRoleClean.startsWith("integration_"), [userRoleClean]);

  useEffect(() => {
    if (isAddModalOpen) {
      document.documentElement.classList.add("no-scroll");
      document.body.classList.add("no-scroll");
    } else {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    }

    return () => {
      document.documentElement.classList.remove("no-scroll");
      document.body.classList.remove("no-scroll");
    };
  }, [isAddModalOpen]);

  useEffect(() => {
    const userInfoLocal = localStorage.getItem("poimen_user_info");
    let uId = "";
    let cId = "";
    let cleanRole = "";
    let uEmail = "";

    if (userInfoLocal) {
      try {
        const parsed = JSON.parse(userInfoLocal);
        setUserInfo(parsed);
        cleanRole = (parsed.role || "").toLowerCase().trim();
        setUserRoleClean(cleanRole);
        uId = parsed.id || "";
        cId = parsed.church_id || "";
        uEmail = parsed.email || "";
      } catch (e) {
        console.error("Error parsing user info", e);
      }
    }

    // Fallback for churchId from selected_church
    if (!cId) {
      const savedChurch = localStorage.getItem("selected_church");
      if (savedChurch) {
        try {
          const parsedChurch = JSON.parse(savedChurch);
          cId = parsedChurch.id || "";
        } catch (e) {}
      }
    }

    setUserId(uId);
    setChurchId(cId);

    const fam = localStorage.getItem("selected_family");
    let activeFamilyId = "";
    if (fam) {
      try {
        const parsedFam = JSON.parse(fam);
        activeFamilyId = parsedFam.id || "";
        setFamilyId(activeFamilyId);
      } catch (e) {
        console.error("Error parsing family info", e);
      }
    }

    const resolveDatabaseSession = async (currentUserId: string, currentChurchId: string, simulatedRole: string, simulatedFamilyId: string, currentEmail: string) => {
      let resolvedUserId = currentUserId; // Start with localStorage — guaranteed to be set after login
      let resolvedChurchId = currentChurchId;
      let resolvedFamilyId = simulatedFamilyId;
      let resolvedRole = simulatedRole;

      try {
        // Try to get the live auth session (getSession is local, doesn't make network calls)
        const { data: { session } } = await supabase.auth.getSession();
        const authUid = session?.user?.id;
        const authEmail = session?.user?.email;

        // If the ID from localStorage is missing but we have an email, resolve the ID from the database first (essential for healing empty IDs)
        if (!resolvedUserId && currentEmail) {
          const { data: p } = await supabase
            .from("profiles")
            .select("id, church_id, role, bergerie_id")
            .eq("email", currentEmail.toLowerCase().trim())
            .maybeSingle();
          if (p) {
            resolvedUserId = p.id;
            resolvedChurchId = resolvedChurchId || p.church_id || "";
            resolvedRole = resolvedRole || (p.role || "").toLowerCase().trim();
            if (p.bergerie_id) {
              resolvedFamilyId = p.bergerie_id;
              setFamilyId(p.bergerie_id);
            }
            // Heal the localStorage immediately!
            const userInfoLocal = localStorage.getItem("poimen_user_info");
            if (userInfoLocal) {
              try {
                const parsed = JSON.parse(userInfoLocal);
                parsed.id = p.id;
                localStorage.setItem("poimen_user_info", JSON.stringify(parsed));
              } catch (e) {}
            }
          }
        }
        
        // CRITICAL SIMULATION RESOLVER:
        // If we are simulating another user (currentEmail is set and differs from real authEmail),
        // we must resolve that simulated identity securely.
        if (currentEmail && currentEmail.toLowerCase().trim() !== authEmail?.toLowerCase().trim()) {
          // If authUid matches resolvedUserId, they are NOT simulating! They just updated their own email.
          if (authUid && authUid === resolvedUserId) {
            const userInfoLocal = localStorage.getItem("poimen_user_info");
            if (userInfoLocal) {
              try {
                const parsed = JSON.parse(userInfoLocal);
                parsed.email = authEmail;
                localStorage.setItem("poimen_user_info", JSON.stringify(parsed));
              } catch (e) {}
            }
            resolvedUserId = authUid;
          } else {
            // We are simulating another user! Use the simulated user's ID directly from resolvedUserId
            // to stay completely immune to email changes or name updates.
            resolvedUserId = resolvedUserId;
          }
        } else if (authUid) {
          // Normal mode: trust the live auth session
          resolvedUserId = authUid;
        }

        // Self-Healing Fallback: If we lack a resolved user ID, resolve by email
        if (!resolvedUserId && currentEmail) {
          const { data: p } = await supabase
            .from("profiles")
            .select("id, church_id, role, bergerie_id")
            .eq("email", currentEmail.toLowerCase().trim())
            .maybeSingle();
            
          if (p) {
            resolvedUserId = p.id;
            resolvedChurchId = resolvedChurchId || p.church_id || "";
            if (!resolvedRole) {
              resolvedRole = (p.role || "").toLowerCase().trim();
            }
            if (p.bergerie_id && !resolvedFamilyId) {
              resolvedFamilyId = p.bergerie_id;
              setFamilyId(p.bergerie_id);
            }
          }
        }

        // Absolute Fallback: If resolvedUserId is still empty but we have a live auth session, trust it!
        if (!resolvedUserId && authUid) {
          resolvedUserId = authUid;
        }
        
        // Fetch the profile from DB using the resolved user ID to sync roles and church
        if (resolvedUserId) {
          const { data: p, error: pErr } = await supabase
            .from("profiles")
            .select("id, church_id, role, bergerie_id, email, display_name")
            .eq("id", resolvedUserId)
            .single();
            
          let resolvedProfile = p;

          // Ultimate Fallback: If profile row is completely missing, dynamically create it on the fly!
          if (pErr && pErr.code === "PGRST116" && resolvedUserId) {
            const { data: chData } = await supabase.from("churches").select("id").limit(1);
            const defaultChurchId = chData?.[0]?.id;
            const displayName = currentEmail ? currentEmail.split('@')[0] : (authEmail ? authEmail.split('@')[0] : "Équipier");
            
            const { data: newProfile, error: insErr } = await supabase
              .from("profiles")
              .insert({
                id: resolvedUserId,
                email: currentEmail || authEmail || "",
                display_name: displayName,
                role: "integration_conseiller",
                church_id: defaultChurchId
              })
              .select()
              .single();
              
            if (!insErr && newProfile) {
              resolvedProfile = newProfile;
            } else {
              console.error("On-the-fly profile creation failed:", insErr);
            }
          }
            
          if (resolvedProfile) {
            const rp = resolvedProfile;
            resolvedChurchId = resolvedChurchId || rp.church_id || "";
            
            // Use the DB role — but only if no role was already resolved from localStorage
            if (!resolvedRole) {
              resolvedRole = (rp.role || "").toLowerCase().trim();
            }
            // ALWAYS sync role with DB for accuracy (covers role changes since last login)
            setUserRoleClean(resolvedRole || (rp.role || "").toLowerCase().trim());

            if (rp.bergerie_id && !resolvedFamilyId) {
              resolvedFamilyId = rp.bergerie_id;
              setFamilyId(rp.bergerie_id);
            }

            // Self-Healing: Sync name, email, and ID in localStorage if they differ
            const userInfoLocal = localStorage.getItem("poimen_user_info");
            if (userInfoLocal) {
              try {
                const parsed = JSON.parse(userInfoLocal);
                let needsUpdate = false;
                if (rp.id && parsed.id !== rp.id) {
                  parsed.id = rp.id;
                  needsUpdate = true;
                }
                if (rp.email && parsed.email !== rp.email) {
                  parsed.email = rp.email;
                  needsUpdate = true;
                }
                if (rp.display_name) {
                  const parts = rp.display_name.split(" ");
                  const first = parts[0] || "";
                  const last = parts.slice(1).join(" ") || "";
                  if (parsed.firstName !== first || parsed.lastName !== last) {
                    parsed.firstName = first;
                    parsed.lastName = last;
                    needsUpdate = true;
                  }
                }
                if (needsUpdate) {
                  localStorage.setItem("poimen_user_info", JSON.stringify(parsed));
                  setUserInfo(parsed);
                }
              } catch (e) {}
            }
          }
        }

        // Self-Healing Fallback: If churchId is still missing, resolve the first available church
        if (!resolvedChurchId) {
          const { data: chData } = await supabase.from("churches").select("id").limit(1);
          if (chData && chData.length > 0) {
            resolvedChurchId = chData[0].id;
          }
        }
        
        if (resolvedUserId) setUserId(resolvedUserId);
        if (resolvedChurchId) setChurchId(resolvedChurchId);
      } catch (err) {
        console.error("Error auto-resolving session from DB:", err);
        // Even on error, set what we have from localStorage so user isn't blocked
        if (currentUserId) setUserId(currentUserId);
        if (currentChurchId) setChurchId(currentChurchId);
      }
    };

    resolveDatabaseSession(uId, cId, cleanRole, activeFamilyId, uEmail);
  }, []);

  // Authorization rules
  const hasAccess = useMemo(() => {
    const role = userRoleClean.toLowerCase().trim();
    if (role === "super_admin" || role === "admin") return true;
    if (isIntegration) return true; // Côté Intégration : Tout le monde y a accès
    // Côté Famille : Seuls Berger, Second, Responsable
    return role.includes("berger") || role.includes("second") || role.includes("responsable");
  }, [isIntegration, userRoleClean]);

  // Overview tab authorized for: Integration Leaders, or Family Leaders (Berger & Second)
  const isLeader = useMemo(() => {
    const role = userRoleClean.toLowerCase().trim();
    if (role === "super_admin" || role === "admin") {
      return true;
    }
    if (isIntegration) {
      return role === "integration_responsable" || role === "integration_second";
    }
    // Berger et son second uniquement (exclut strictement responsable de brebis)
    return role === "berger" || role === "second du berger" || role === "second" || role.includes("second");
  }, [isIntegration, userRoleClean]);

  // Synchronize activeTab with isLeader permissions (prevent session role switcher leakage)
  useEffect(() => {
    if (!isLeader && activeTab !== "mine") {
      setActiveTab("mine");
    }
  }, [isLeader, activeTab]);

  // Fetch evangelisations
  const fetchEvangelisations = async () => {
    if (!hasAccess || !userId) return;
    
    const cleanFamilyId = familyId && familyId !== "null" && familyId !== "undefined" ? familyId : "";
    
    // Safety check: if not integration context, we strictly require a valid familyId to prevent fetching integration data (where bergerie_id is null)
    if (!isIntegration && !cleanFamilyId) {
      setEvangelisations([]);
      return;
    }

    setLoading(true);
    try {
      let query = supabase.from("evangelisations").select("*, profiles:created_by(display_name)");
      
      // Force strictly "mine" for non-leaders to prevent any front-end bypass
      const effectiveTab = isLeader ? activeTab : "mine";
      
      if (isIntegration) {
        // Département d'Intégration : uniquement les fiches propres à l'intégration (sans famille de disciples)
        query = query.is("bergerie_id", null).eq("church_id", churchId);
        if (effectiveTab === "mine") {
          query = query.eq("created_by", userId);
        }
      } else {
        // Famille de Disciples : uniquement les fiches de cette bergerie spécifique
        query = query.eq("bergerie_id", cleanFamilyId);
        if (effectiveTab === "mine") {
          query = query.eq("created_by", userId);
        }
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      setEvangelisations(data || []);
    } catch (err) {
      console.error("Error fetching evangelisations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasAccess && userId) {
      fetchEvangelisations();
    }
  }, [hasAccess, userId, activeTab, churchId, familyId, isIntegration, isLeader]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // 1. Resolve auth user ID and email
      const { data: { session } } = await supabase.auth.getSession();
      let activeUid = session?.user?.id || userId;
      const authEmail = session?.user?.email;

      // 2. Fetch simulated info from localStorage
      let storageEmail = "";
      let storageChurchId = "";
      let storageFamilyId = "";
      let storageRole = "";
      let storageUserId = "";
      
      const userInfoLocal = localStorage.getItem("poimen_user_info");
      if (userInfoLocal) {
        try {
          const parsed = JSON.parse(userInfoLocal);
          storageEmail = parsed.email || "";
          storageChurchId = parsed.church_id || "";
          storageFamilyId = parsed.bergerie_id || parsed.familyId || "";
          storageRole = parsed.role || "";
          storageUserId = parsed.id || "";
          if (parsed.id) {
            activeUid = parsed.id;
          }
        } catch (err) {}
      }

      // 3. Simulation Resolver: If the simulated email is different from Supabase Auth email, 
      // resolve the profile identity securely.
      if (storageEmail && storageEmail.toLowerCase().trim() !== authEmail?.toLowerCase().trim()) {
        if (session?.user?.id && session?.user?.id === storageUserId) {
          activeUid = session.user.id;
        } else {
          // We are simulating another user! Use the simulated user's ID directly from localStorage (storageUserId)
          // to stay completely immune to email changes or name updates.
          activeUid = storageUserId || activeUid;
        }
      }

      // 3b. Emergency Fallback: If activeUid is still empty or storageUserId is empty, but we have storageEmail
      if (!activeUid && storageEmail) {
        const { data: p } = await supabase
          .from("profiles")
          .select("id")
          .eq("email", storageEmail.toLowerCase().trim())
          .maybeSingle();
        if (p) {
          activeUid = p.id;
          // Heal localStorage immediately
          const infoLocal = localStorage.getItem("poimen_user_info");
          if (infoLocal) {
            try {
              const parsed = JSON.parse(infoLocal);
              parsed.id = p.id;
              localStorage.setItem("poimen_user_info", JSON.stringify(parsed));
            } catch (e) {}
          }
        }
      }

      // 3c. Absolute Fallback: If activeUid is still empty but we have a live auth session, trust the live session!
      if (!activeUid && session?.user?.id) {
        activeUid = session.user.id;
      }

      if (!activeUid) {
        alert("⚠️ Erreur de session : Impossible d'identifier l'utilisateur connecté. Veuillez vous reconnecter.");
        setSubmitting(false);
        return;
      }

      // 4. Resolve church_id and bergerie_id directly from DB (authoritative, not from state)
      const { data: profile } = await supabase
        .from("profiles")
        .select("church_id, bergerie_id, role")
        .eq("id", activeUid)
        .single();

      const activeChurchId = profile?.church_id || storageChurchId || churchId;
      const dbBergerieId = profile?.bergerie_id || storageFamilyId || familyId;
      
      // Prioritize simulated role for proper UI context mapping
      const effectiveRole = (storageRole || profile?.role || userRoleClean || "").toLowerCase().trim();
      const isIntegrationSave = effectiveRole.startsWith("integration_");

      if (!activeChurchId) {
        alert("⚠️ Erreur de session : L'identifiant d'église n'a pas pu être récupéré. Veuillez vous reconnecter.");
        setSubmitting(false);
        return;
      }

      const cleanFamilyId = dbBergerieId && dbBergerieId !== "null" && dbBergerieId !== "undefined" ? dbBergerieId : "";
      if (!isIntegrationSave && !cleanFamilyId) {
        alert("⚠️ Erreur : Aucune famille de disciples n'est associée à votre compte. Veuillez vérifier votre profil.");
        setSubmitting(false);
        return;
      }

      const isAnon = formMode !== "nominative";
      const isBulk = formMode === "anonymous_bulk";
      
      const payload = {
        church_id: activeChurchId,
        bergerie_id: isIntegrationSave ? null : cleanFamilyId,
        first_name: isAnon ? null : formData.first_name,
        last_name: isAnon ? null : formData.last_name,
        phone: isAnon ? null : formData.phone,
        address: isAnon ? null : formData.address,
        is_anonymous: isAnon,
        anonymous_description: formMode === "anonymous_single" ? formData.anonymous_description : null,
        people_count: isBulk ? formData.people_count : 1,
        prayer_salvation: isBulk ? false : formData.prayer_salvation,
        prayer_healing: isBulk ? false : formData.prayer_healing,
        prayer_other: isBulk ? false : formData.prayer_other,
        prayer_other_details: isBulk ? null : (formData.prayer_other ? formData.prayer_other_details : null),
        has_invitation: formData.has_invitation,
        invitations_count: formData.has_invitation ? (isBulk ? formData.invitations_count : 1) : 0,
        attended_service: isBulk ? false : formData.attended_service,
        comment: formData.comment,
        created_by: activeUid,
        evangelisation_date: formData.evangelisation_date
      };

      let resError;
      if (editingReport) {
        const { error } = await supabase
          .from("evangelisations")
          .update(payload)
          .eq("id", editingReport.id);
        resError = error;
      } else {
        const { error } = await supabase.from("evangelisations").insert(payload);
        resError = error;
      }
      
      if (resError) throw resError;

      alert(editingReport ? "Rapport d'évangélisation modifié avec succès !" : "Rapport d'évangélisation enregistré avec succès !");
      setIsAddModalOpen(false);
      setEditingReport(null);
      
      // Reset form
      setFormData({
        first_name: "",
        last_name: "",
        phone: "",
        address: "",
        anonymous_description: "",
        people_count: 1,
        prayer_salvation: false,
        prayer_healing: false,
        prayer_other: false,
        prayer_other_details: "",
        has_invitation: false,
        attended_service: false,
        comment: "",
        evangelisation_date: new Date().toISOString().split("T")[0],
        invitations_count: 0
      });
      setFormMode("nominative");
      
      fetchEvangelisations();
    } catch (err: any) {
      console.error("Error saving evangelisation:", err);
      alert("Erreur lors de la sauvegarde : " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (e: Evangelisation) => {
    setEditingReport(e);
    setFormMode(
      e.is_anonymous 
        ? (e.people_count > 1 ? "anonymous_bulk" : "anonymous_single") 
        : "nominative"
    );
    setFormData({
      first_name: e.first_name || "",
      last_name: e.last_name || "",
      phone: e.phone || "",
      address: e.address || "",
      anonymous_description: e.anonymous_description || "",
      people_count: e.people_count || 1,
      prayer_salvation: e.prayer_salvation || false,
      prayer_healing: e.prayer_healing || false,
      prayer_other: e.prayer_other || false,
      prayer_other_details: e.prayer_other_details || "",
      has_invitation: e.has_invitation || false,
      attended_service: e.attended_service || false,
      comment: e.comment || "",
      evangelisation_date: e.evangelisation_date || new Date().toISOString().split("T")[0],
      invitations_count: e.invitations_count || 0
    });
    setIsAddModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer définitivement ce rapport d'évangélisation ? Cette action est irréversible.")) return;
    
    try {
      const { error } = await supabase.from("evangelisations").delete().eq("id", id);
      if (error) throw error;
      setEvangelisations(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      alert("Erreur lors de la suppression : " + err.message);
    }
  };

  const handleToggleAttended = async (id: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("evangelisations")
        .update({ attended_service: !currentValue })
        .eq("id", id);

      if (error) throw error;
      
      // Update local state instantly
      setEvangelisations(prev => prev.map(e => e.id === id ? { ...e, attended_service: !currentValue } : e));
    } catch (err: any) {
      console.error("Error toggling attendance:", err);
      alert("Erreur lors de la mise à jour de la présence : " + err.message);
    }
  };

  const handleUpdateCallTracking = async (id: string, isContacted: boolean, comment: string) => {
    try {
      const { error } = await supabase
        .from("evangelisations")
        .update({ 
          is_contacted: isContacted,
          call_comment: comment
        })
        .eq("id", id);

      if (error) throw error;
      
      // Update local state instantly
      setEvangelisations(prev => prev.map(e => e.id === id ? { ...e, is_contacted: isContacted, call_comment: comment } : e));
    } catch (err: any) {
      console.error("Error updating call tracking:", err);
      alert("Erreur lors de la mise à jour du suivi d'appel : " + err.message);
    }
  };



  // Filter lists
  const filteredList = useMemo(() => {
    return evangelisations.filter(e => {
      const name = `${e.first_name || ""} ${e.last_name || ""}`.toLowerCase();
      const desc = (e.anonymous_description || "").toLowerCase();
      const comm = (e.comment || "").toLowerCase();
      const s = search.toLowerCase();
      
      const matchesSearch = name.includes(s) || desc.includes(s) || comm.includes(s);
      
      // Date range filtering
      let matchesDate = true;
      if (e.evangelisation_date) {
        if (filterStartDate) {
          matchesDate = matchesDate && (e.evangelisation_date >= filterStartDate);
        }
        if (filterEndDate) {
          matchesDate = matchesDate && (e.evangelisation_date <= filterEndDate);
        }
      }
      
      return matchesSearch && matchesDate;
    });
  }, [evangelisations, search, filterStartDate, filterEndDate]);

  // Statistics Computations (Reacts dynamically to date range and search filters!)
  const stats = useMemo(() => {
    let totalPeople = 0;
    let totalAnonymous = 0;
    let totalNominative = 0;
    let prayersSalvation = 0;
    let prayersHealing = 0;
    let prayersOther = 0;
    let invitationsGiven = 0;
    let attendedService = 0;
    let totalContacted = 0;
    let totalToContact = 0;

    filteredList.forEach(e => {
      totalPeople += e.people_count;
      if (e.is_anonymous) {
        totalAnonymous += e.people_count;
      } else {
        totalNominative += 1;
      }
      if (e.prayer_salvation) prayersSalvation++;
      if (e.prayer_healing) prayersHealing++;
      if (e.prayer_other) prayersOther++;
      if (e.has_invitation) {
        invitationsGiven += e.invitations_count || 1;
      }
      if (e.attended_service || e.converted_guest_id) attendedService += e.people_count;
      
      if (e.phone && e.phone.trim() !== "") {
        if (e.is_contacted) totalContacted++;
        else totalToContact++;
      }
    });

    const inviteRate = totalPeople > 0 ? Math.round((invitationsGiven / totalPeople) * 100) : 0;
    const conversionRate = invitationsGiven > 0 ? Math.round((attendedService / invitationsGiven) * 100) : 0;

    return {
      totalPeople,
      totalAnonymous,
      totalNominative,
      prayersSalvation,
      prayersHealing,
      prayersOther,
      inviteRate,
      conversionRate,
      invitationsGiven,
      attendedService,
      totalContacted,
      totalToContact
    };
  }, [filteredList]);

  if (!hasAccess) {
    return (
      <div className="glass fade-in" style={{ padding: 40, textAlign: "center", border: "1px solid var(--red-glow)" }}>
        <XCircle size={40} style={{ color: "var(--red)", marginBottom: 16 }} />
        <h2 style={{ fontFamily: "var(--font-display)", color: "var(--gold-light)", marginBottom: 12 }}>Accès Restreint</h2>
        <p style={{ color: "var(--cream-dim)", fontSize: 14 }}>
          Seuls les leaders de familles de disciples (Bergers, Seconds, Responsables) et les membres du département d'Intégration ont l'autorisation d'accéder à ce module.
        </p>
      </div>
    );
  }

  return (
    <div className="evang-page" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      
      {/* Header */}
      <div className="page-header evang-page-hero fade-in">
        <div>
          <h2 className="page-title">Session d'Évangélisation</h2>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
            Consignez vos rapports d'échanges, prières et invitations offertes lors des temps d'évangélisation
          </p>
        </div>
        <button 
          className="btn btn-primary btn-sm evang-primary-action" 
          onClick={() => { 
            setEditingReport(null);
            setFormData({
              first_name: "",
              last_name: "",
              phone: "",
              address: "",
              anonymous_description: "",
              people_count: 1,
              prayer_salvation: false,
              prayer_healing: false,
              prayer_other: false,
              prayer_other_details: "",
              has_invitation: false,
              attended_service: false,
              comment: "",
              evangelisation_date: new Date().toISOString().split("T")[0],
              invitations_count: 0
            });
            setFormMode("nominative");
            setIsAddModalOpen(true); 
          }}
        >
          <Plus size={14} /> Nouveau Rapport
        </button>
      </div>


      {/* Stats Bento (Always visible if Leader in overview tab, or as small recap for Counselor) */}
      {(isLeader || activeTab === "mine") && (
        <div className="bento bento-3 evang-stats-grid fade-in">
          <div className="stat-card col-span-2">
            <div className="evang-stat-head">
              <span className="stat-label" style={{ margin: 0 }}>Personnes Évangélisées</span>
              <Users className="evang-stat-icon" style={{ color: "var(--sky)" }} />
            </div>
            <div className="stat-value" style={{ color: "var(--sky)" }}>{stats.totalPeople}</div>
            <div className="stat-sub">{stats.totalNominative} nominatives · {stats.totalAnonymous} anonymes</div>
          </div>
          
          <div className="stat-card">
            <div className="evang-stat-head">
              <span className="stat-label" style={{ margin: 0 }}>Prière du Salut</span>
              <Flame className="evang-stat-icon" style={{ color: "var(--gold)" }} />
            </div>
            <div className="stat-value" style={{ color: "var(--gold)" }}>{stats.prayersSalvation}</div>
            <div className="stat-sub">Engagements de foi</div>
          </div>

          <div className="stat-card">
            <div className="evang-stat-head">
              <span className="stat-label" style={{ margin: 0 }}>Prière Guérison</span>
              <Heart className="evang-stat-icon" style={{ color: "var(--red)" }} />
            </div>
            <div className="stat-value" style={{ color: "var(--red)" }}>{stats.prayersHealing}</div>
            <div className="stat-sub">Pour les malades</div>
          </div>

          <div className="stat-card">
            <div className="evang-stat-head">
              <span className="stat-label" style={{ margin: 0 }}>Autre Prière</span>
              <HelpCircle className="evang-stat-icon" style={{ color: "var(--orange)" }} />
            </div>
            <div className="stat-value" style={{ color: "var(--orange)" }}>{stats.prayersOther}</div>
            <div className="stat-sub">Sujets spécifiques</div>
          </div>

          <div className="stat-card">
            <div className="evang-stat-head">
              <span className="stat-label" style={{ margin: 0 }}>Invitations</span>
              <MessageSquare className="evang-stat-icon" style={{ color: "var(--violet)" }} />
            </div>
            <div className="stat-value" style={{ color: "var(--violet)" }}>{stats.invitationsGiven}</div>
            <div className="stat-sub">{stats.inviteRate}% taux invitation</div>
          </div>

          <div className="stat-card">
            <div className="evang-stat-head">
              <span className="stat-label" style={{ margin: 0 }}>Appels Effectués</span>
              <Phone className="evang-stat-icon" style={{ color: "var(--sky)" }} />
            </div>
            <div className="stat-value" style={{ color: "var(--sky)" }}>{stats.totalContacted}</div>
            <div className="stat-sub">
              {stats.totalContacted}/{stats.totalContacted + stats.totalToContact} appelés
            </div>
          </div>

          <div className="stat-card col-span-2">
            <div className="evang-stat-head">
              <span className="stat-label" style={{ margin: 0 }}>Présences au Culte</span>
              <UserCheck className="evang-stat-icon" style={{ color: "var(--green)" }} />
            </div>
            <div className="stat-value" style={{ color: "var(--green)" }}>{stats.attendedService}</div>
            <div className="stat-sub">{stats.conversionRate}% conversion post-évangélisation</div>
          </div>
        </div>
      )}

      {/* Tab Switcher (Only visible to Leaders who have both Vue d'ensemble and Mes Saisies) */}
      {isLeader && (
        <div className="evang-scope-switcher fade-in" style={{ display: "flex", gap: 10, background: "rgba(10, 6, 22, 0.5)", border: "1px solid var(--border)", padding: 5, borderRadius: "14px", width: "fit-content" }}>
          <button 
            onClick={() => setActiveTab("mine")}
            className={`pill evang-scope-option ${activeTab === "mine" ? "pill-active active" : "pill-inactive"}`}
            style={{ border: "none" }}
          >
            Mes Saisies ({evangelisations.filter(e => e.created_by === userId).length})
          </button>
          <button 
            onClick={() => setActiveTab("all")}
            className={`pill evang-scope-option ${activeTab === "all" ? "pill-active active" : "pill-inactive"}`}
            style={{ border: "none" }}
          >
            Vue d'ensemble ({isIntegration ? "Département" : "Bergerie"})
          </button>
        </div>
      )}

      {/* List view filter */}
      <div className="glass evang-filter-panel fade-in" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="evang-filter-row" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search bar */}
          <div className="evang-search-field" style={{ position: "relative", flex: "2 1 300px" }}>
            <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input 
              className="input" 
              placeholder="Rechercher par nom, description ou notes de rencontre..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ paddingLeft: 38, width: "100%" }} 
            />
          </div>

          {/* Date range filters */}
          <div className="evang-date-range" style={{ display: "flex", gap: 12, flex: "1 1 300px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="evang-date-filter" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>Du</span>
              <input 
                type="date" 
                className="input" 
                value={filterStartDate} 
                onChange={(e) => setFilterStartDate(e.target.value)} 
                style={{ fontSize: 12, padding: "8px 12px" }}
              />
            </div>
            <div className="evang-date-filter" style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>Au</span>
              <input 
                type="date" 
                className="input" 
                value={filterEndDate} 
                onChange={(e) => setFilterEndDate(e.target.value)} 
                style={{ fontSize: 12, padding: "8px 12px" }}
              />
            </div>

            {(filterStartDate || filterEndDate) && (
              <button 
                onClick={() => { setFilterStartDate(""); setFilterEndDate(""); }}
                className="btn btn-subtle btn-xs"
                style={{ fontSize: 10, padding: "6px 12px", border: "1px dashed var(--border)" }}
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <Loader2 className="spinner" size={32} />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="glass text-center" style={{ padding: 48, border: "1px dashed var(--border)" }}>
          <AlertCircle size={28} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Aucun rapport d'évangélisation ne correspond à vos critères.</p>
        </div>
      ) : (
        <div className="evang-report-list fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredList.map((e) => {
            const isExpanded = expandedId === e.id;
            const formattedDate = new Date(e.created_at).toLocaleDateString("fr-FR", {
              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
            });
            const formattedEvangelisationDate = e.evangelisation_date ? new Date(e.evangelisation_date).toLocaleDateString("fr-FR", {
              day: "numeric", month: "short", year: "numeric"
            }) : "";
            
            return (
              <div 
                key={e.id} 
                className="glass glass-flush evang-report-card" 
                style={{ 
                  borderLeft: e.converted_guest_id ? "4px solid var(--green)" : e.is_anonymous ? "1px solid var(--border)" : "1px solid var(--gold)", 
                  transition: "all 0.3s ease" 
                }}
              >
                <div 
                  className="evang-list-header"
                  onClick={() => setExpandedId(isExpanded ? null : e.id)}
                  style={{ 
                    padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
                    cursor: "pointer", background: isExpanded ? "rgba(212, 175, 55, 0.03)" : "transparent"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
                    <div className="avatar avatar-gradient evang-avatar" style={{ width: 38, height: 38, fontSize: 11, flexShrink: 0 }}>
                      {e.is_anonymous ? "AN" : `${e.first_name?.[0] || ""}${e.last_name?.[0] || ""}`}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="evang-info-row" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 className="evang-name" style={{ fontSize: 14, fontWeight: 700, color: "var(--cream)" }}>
                          {e.is_anonymous ? (
                            e.people_count > 1 ? `Groupe Anonyme (${e.people_count} pers.) 👥` : "Contact Anonyme 👤"
                          ) : (
                            `${e.first_name} ${e.last_name}`
                          )}
                        </h3>
                        <div className="evang-badges" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {e.prayer_salvation && <span className="badge badge-gold" style={{ fontSize: 8 }}>Salut</span>}
                          {e.has_invitation && <span className="badge badge-violet" style={{ fontSize: 8 }}>Invitation</span>}
                          {e.phone && e.phone.trim() !== "" && (
                            e.is_contacted ? (
                              <span className="badge badge-green" style={{ fontSize: 8 }}>📞 Contacté</span>
                            ) : (
                              <span className="badge badge-orange" style={{ fontSize: 8 }}>⏳ À contacter</span>
                            )
                          )}
                          {e.converted_guest_id && <span className="badge badge-green" style={{ fontSize: 8 }}>Intégré</span>}
                        </div>
                      </div>
                      <div className="evang-meta" style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        {formattedEvangelisationDate && <span style={{ color: "var(--gold-light)", fontWeight: 700 }}>Évangélisé le {formattedEvangelisationDate}</span>}
                        {" · "}Saisi par {e.created_by === userId ? "Moi" : (e.profiles?.display_name || "un équipier")}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, marginLeft: 8 }}>
                    {isExpanded ? <ChevronUp size={16} style={{ color: "var(--gold)" }} /> : <ChevronDown size={16} style={{ color: "var(--muted)" }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="evang-expanded" style={{ borderTop: "1px solid var(--border)", background: "rgba(0, 0, 0, 0.25)", padding: 24 }}>
                    <div className="evang-expanded-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                      
                      {/* Informations Column */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        <h4 style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Détails de la rencontre</h4>
                        
                        {e.is_anonymous ? (
                          e.people_count > 1 ? (
                            <div style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.6 }}>
                              <strong>Taille du groupe :</strong> {e.people_count} personnes.
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: "var(--cream-dim)", lineHeight: 1.6 }}>
                              <strong>Description physique :</strong><br />
                              <span style={{ fontStyle: "italic" }}>{e.anonymous_description || "Aucune description fournie."}</span>
                            </div>
                          )
                        ) : (
                          <>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                              <Phone size={13} style={{ color: "var(--muted)" }} />
                              <span style={{ color: "var(--cream-dim)" }}>{e.phone || "Aucun numéro de téléphone"}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                              <MapPin size={13} style={{ color: "var(--muted)" }} />
                              <span style={{ color: "var(--cream-dim)" }}>{e.address || "Adresse non renseignée"}</span>
                            </div>
                          </>
                        )}

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                          {e.prayer_salvation && <span className="badge badge-gold" style={{ fontSize: 9 }}>Prière du salut</span>}
                          {e.prayer_healing && <span className="badge badge-sky" style={{ fontSize: 9 }}>Prière de guérison</span>}
                          {e.prayer_other && (
                            <span className="badge badge-orange" style={{ fontSize: 9 }} title={e.prayer_other_details || ""}>
                              Prière spécifiée
                            </span>
                          )}
                        </div>
                        
                        {e.prayer_other && e.prayer_other_details && (
                          <div style={{ fontSize: 11, color: "var(--cream-dim)", background: "rgba(255,255,255,0.01)", padding: 8, borderRadius: 6, border: "1px dashed var(--border)" }}>
                            <strong>Sujet de prière :</strong> {e.prayer_other_details}
                          </div>
                        )}
                      </div>

                      {/* Comments & Integration Actions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <h4 style={{ fontSize: 10, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Notes & Suivi culte</h4>
                        
                        <div style={{ fontSize: 12, color: "var(--cream-dim)", background: "rgba(10, 6, 22, 0.4)", padding: 12, borderRadius: 10, border: "1px solid var(--border)", lineHeight: 1.5 }}>
                          {e.comment || <span style={{ fontStyle: "italic", color: "var(--muted)" }}>Aucun commentaire ou note d'échange.</span>}
                        </div>

                        {e.has_invitation && (
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between",
                            background: "rgba(255, 255, 255, 0.02)", 
                            padding: "10px 16px", 
                            borderRadius: "10px", 
                            border: "1px solid var(--border)"
                          }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 11, color: "var(--cream)", fontWeight: 600 }}>Statut invitation culte</span>
                              {e.is_anonymous && e.people_count > 1 ? (
                                <span style={{ fontSize: 9, color: "var(--muted)" }}>{e.invitations_count || 0} cartons donnés</span>
                              ) : (
                                <span style={{ fontSize: 9, color: "var(--muted)" }}>1 carton donné</span>
                              )}
                            </div>
                            
                            {(!e.is_anonymous || e.people_count <= 1) ? (
                              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input 
                                  type="checkbox" 
                                  checked={e.attended_service === true}
                                  onChange={() => handleToggleAttended(e.id, e.attended_service)}
                                  disabled={!!e.converted_guest_id}
                                  style={{ accentColor: "var(--gold)", cursor: "pointer" }}
                                />
                                <span style={{ 
                                  fontSize: 11, 
                                  fontWeight: 700, 
                                  color: e.attended_service || e.converted_guest_id ? "var(--green)" : "var(--orange)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}>
                                  {e.attended_service || e.converted_guest_id ? (
                                    <>
                                      <CheckCircle2 size={12} /> Venu au culte
                                    </>
                                  ) : (
                                    <>
                                      ⏳ En attente de culte
                                    </>
                                  )}
                                </span>
                              </label>
                            ) : (
                              <span style={{ 
                                fontSize: 11, 
                                fontWeight: 700, 
                                color: "var(--muted)",
                                display: "flex",
                                alignItems: "center",
                                gap: 4
                              }}>
                                👥 Groupe éligible culte
                              </span>
                            )}
                          </div>
                        )}

                        {e.phone && e.phone.trim() !== "" && (
                          <div style={{ 
                            display: "flex", 
                            flexDirection: "column",
                            gap: 12,
                            background: "rgba(255, 255, 255, 0.02)", 
                            padding: "16px", 
                            borderRadius: "10px", 
                            border: "1px solid var(--border)"
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <span style={{ fontSize: 11, color: "var(--cream)", fontWeight: 600 }}>Appel post-évangélisation</span>
                                <span style={{ fontSize: 9, color: "var(--muted)" }}>Rappeler de venir au culte</span>
                              </div>
                              
                              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                                <input 
                                  type="checkbox" 
                                  checked={e.is_contacted === true}
                                  onChange={() => handleUpdateCallTracking(e.id, !e.is_contacted, e.call_comment || "")}
                                  style={{ accentColor: "var(--gold)", cursor: "pointer" }}
                                />
                                <span style={{ 
                                  fontSize: 11, 
                                  fontWeight: 700, 
                                  color: e.is_contacted ? "var(--green)" : "var(--orange)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4
                                }}>
                                  {e.is_contacted ? (
                                    <>
                                      <CheckCircle2 size={12} /> Contacté
                                    </>
                                  ) : (
                                    <>
                                      ⏳ À contacter
                                    </>
                                  )}
                                </span>
                              </label>
                            </div>

                            {e.is_contacted && (
                              <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                                <label style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>RÉSUMÉ DE L'APPEL / RETOURS</label>
                                <textarea
                                  className="input"
                                  rows={2}
                                  defaultValue={e.call_comment || ""}
                                  onBlur={(evt) => handleUpdateCallTracking(e.id, e.is_contacted, evt.target.value)}
                                  placeholder="Ex: Enthousiaste, confirme sa présence dimanche / Indisponible ce dimanche mais souhaite rester en contact..."
                                  style={{ fontSize: 11, resize: "none", width: "100%", padding: "6px 10px", boxSizing: "border-box" }}
                                />
                                <span style={{ fontSize: 9, color: "var(--muted)", fontStyle: "italic", textAlign: "right" }}>
                                  Les notes sont sauvegardées automatiquement à la sortie du champ.
                                </span>
                              </div>
                            )}
                          </div>
                        )}



                        {/* Edit and Delete actions ONLY if creator */}
                        {e.created_by === userId && (
                          <div style={{ display: "flex", gap: 10, alignSelf: "flex-end", marginTop: 12 }}>
                            <button 
                              className="btn btn-subtle btn-sm"
                              style={{ color: "var(--gold-light)", borderColor: "rgba(212, 175, 55, 0.2)" }}
                              onClick={() => handleEditClick(e)}
                            >
                              Modifier le rapport
                            </button>
                            <button 
                              className="btn btn-subtle btn-sm"
                              style={{ color: "var(--red)", borderColor: "rgba(239, 68, 68, 0.15)" }}
                              onClick={() => handleDelete(e.id)}
                            >
                              <Trash2 size={12} /> Supprimer le rapport
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Report Modal */}
      {typeof window !== "undefined" && isAddModalOpen && createPortal(
        <div className="modal-overlay">
          <div className="custom-modal evang-report-modal fade-in" style={{ maxWidth: 620 }}>
            
            <div className="evang-modal-actions">
              <button
                type="button"
                className="evang-modal-icon-action cancel"
                onClick={() => { setIsAddModalOpen(false); setEditingReport(null); }}
                aria-label="Annuler"
                title="Annuler"
              >
                <XCircle size={20} />
              </button>
              <button
                type="submit"
                form="evang-report-form"
                className="evang-modal-icon-action confirm"
                disabled={submitting}
                aria-label={editingReport ? "Enregistrer les modifications" : "Valider le rapport"}
                title={editingReport ? "Enregistrer les modifications" : "Valider le rapport"}
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              </button>
            </div>

            <div className="evang-modal-header">
              <div className="evang-modal-icon">
                <Flame size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: "clamp(18px, 2.5vw, 24px)", color: "var(--gold-light)", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                  {editingReport ? "Modifier le Rapport" : "Nouveau Rapport"}
                </h2>
                <p>Consignez la rencontre, les prieres et les invitations en quelques etapes.</p>
              </div>
            </div>

            {/* Mode selection tabs */}
            <div className="evang-mode-switcher">
              {[
                { mode: "nominative", label: "Nominatif", sub: "Personne identifiee" },
                { mode: "anonymous_single", label: "Anonyme", sub: "Une personne" },
                { mode: "anonymous_bulk", label: "Groupe", sub: "Plusieurs personnes" }
              ].map((item, index) => (
                <button
                  key={item.mode}
                  type="button"
                  className={`evang-mode-option ${formMode === item.mode ? "active" : ""}`}
                  onClick={() => setFormMode(item.mode as any)}
                >
                  <span className="evang-mode-step">{index + 1}</span>
                  <span className="evang-mode-copy">
                    <span className="evang-mode-label">{item.label}</span>
                    <span className="evang-mode-sub">{item.sub}</span>
                  </span>
                </button>
              ))}
            </div>

            <form id="evang-report-form" className="evang-report-form" onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div className="evang-modal-scroll">
              
              {/* Conditional Fields based on Mode */}
              {formMode === "nominative" && (
                <>
                  <div className="form-grid-2">
                    <div>
                      <label className="form-label">PRÉNOM</label>
                      <input 
                        className="input" 
                        required 
                        value={formData.first_name || ""} 
                        onChange={e => setFormData({...formData, first_name: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="form-label">NOM DE FAMILLE</label>
                      <input 
                        className="input" 
                        required 
                        value={formData.last_name || ""} 
                        onChange={e => setFormData({...formData, last_name: e.target.value})} 
                      />
                    </div>
                  </div>
                  
                  <div className="form-grid-2">
                    <div>
                      <label className="form-label">TÉLÉPHONE</label>
                      <input 
                        className="input" 
                        value={formData.phone || ""} 
                        onChange={e => setFormData({...formData, phone: e.target.value})} 
                        placeholder="+32..."
                      />
                    </div>
                    <div>
                      <label className="form-label">ADRESSE DOMICILE</label>
                      <input 
                        className="input" 
                        value={formData.address || ""} 
                        onChange={e => setFormData({...formData, address: e.target.value})} 
                        placeholder="Rue, Numéro, Ville..."
                      />
                    </div>
                  </div>
                </>
              )}

              {formMode === "anonymous_single" && (
                <div>
                  <label className="form-label">DESCRIPTION PHYSIQUE & SIGNES DISTINCTIFS *</label>
                  <textarea 
                    className="input" 
                    required
                    rows={3}
                    value={formData.anonymous_description || ""} 
                    onChange={e => setFormData({...formData, anonymous_description: e.target.value})} 
                    placeholder="ex: Femme, veste jaune, cheveux courts, abordée près du carrefour commercial à 16h..."
                    style={{ fontSize: 12, resize: "vertical" }}
                  />
                </div>
              )}

              {formMode === "anonymous_bulk" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
                  <div>
                    <label className="form-label">NOMBRE DE PERSONNES ÉVANGÉLISÉES *</label>
                    <input 
                      className="input" 
                      type="number" 
                      min={1} 
                      required 
                      value={formData.people_count} 
                      onChange={e => setFormData({...formData, people_count: parseInt(e.target.value, 10) || 1})} 
                      style={{ maxWidth: 150 }}
                    />
                  </div>

                  <div className="evang-form-panel" style={{ background: "rgba(255,255,255,0.01)", padding: 16, borderRadius: 10, border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 12 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12 }}>
                      <input 
                        type="checkbox" 
                        checked={formData.has_invitation} 
                        onChange={e => setFormData({...formData, has_invitation: e.target.checked})}
                        style={{ accentColor: "var(--gold)" }}
                      />
                      <div>
                        <strong style={{ color: "var(--cream)", display: "block" }}>Cartons d'invitation donnés ?</strong>
                        <span style={{ color: "var(--muted)", fontSize: 10 }}>Des invitations physiques ont été distribuées au groupe</span>
                      </div>
                    </label>

                    {formData.has_invitation && (
                      <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 24 }}>
                        <span style={{ fontSize: 12, color: "var(--cream-dim)" }}>Nombre d'invitations :</span>
                        <input 
                          type="number"
                          className="input"
                          min={1}
                          required
                          value={formData.invitations_count || ""}
                          onChange={e => setFormData({...formData, invitations_count: parseInt(e.target.value, 10) || 0})}
                          style={{ maxWidth: 100, fontSize: 12, padding: "6px 12px" }}
                          placeholder="ex. 10"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Prayers and invitations - Hide in mass mode to keep it minimal and accurate */}
              {formMode !== "anonymous_bulk" && (
                <>
                  {/* Prayers Group */}
                  <div>
                    <label className="form-label" style={{ marginBottom: 10, display: "block" }}>PRIÈRES ACCOMPAGNÉES</label>
                    <div className="evang-check-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 15 }}>
                      <label className="evang-check-card" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12 }}>
                        <input 
                          type="checkbox" 
                          checked={formData.prayer_salvation} 
                          onChange={e => setFormData({...formData, prayer_salvation: e.target.checked})}
                          style={{ accentColor: "var(--gold)" }}
                        />
                        <span style={{ color: "var(--cream-dim)" }}>Prière du Salut</span>
                      </label>
                      <label className="evang-check-card" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12 }}>
                        <input 
                          type="checkbox" 
                          checked={formData.prayer_healing} 
                          onChange={e => setFormData({...formData, prayer_healing: e.target.checked})}
                          style={{ accentColor: "var(--gold)" }}
                        />
                        <span style={{ color: "var(--cream-dim)" }}>Guérison</span>
                      </label>
                      <label className="evang-check-card" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12 }}>
                        <input 
                          type="checkbox" 
                          checked={formData.prayer_other} 
                          onChange={e => setFormData({...formData, prayer_other: e.target.checked})}
                          style={{ accentColor: "var(--gold)" }}
                        />
                        <span style={{ color: "var(--cream-dim)" }}>Autre prière</span>
                      </label>
                    </div>
                  </div>

                  {formData.prayer_other && (
                    <div className="fade-in">
                      <label className="form-label">PRÉCISEZ LE SUJET DE PRIÈRE *</label>
                      <input 
                        className="input" 
                        required 
                        value={formData.prayer_other_details || ""} 
                        onChange={e => setFormData({...formData, prayer_other_details: e.target.value})} 
                        placeholder="ex. Prière pour les études, situation de travail, paix familiale..."
                      />
                    </div>
                  )}

                  {/* Invitations */}
                  <div className="evang-form-panel" style={{ background: "rgba(255,255,255,0.01)", padding: 12, borderRadius: 10, border: "1px solid var(--border)" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 12 }}>
                      <input 
                        type="checkbox" 
                        checked={formData.has_invitation} 
                        onChange={e => setFormData({...formData, has_invitation: e.target.checked})}
                        style={{ accentColor: "var(--gold)" }}
                      />
                      <div>
                        <strong style={{ color: "var(--cream)", display: "block" }}>Invitation Donnée</strong>
                        <span style={{ color: "var(--muted)", fontSize: 10 }}>A reçu un carton ou prospectus d'invitation</span>
                      </div>
                    </label>
                  </div>
                </>
              )}

              {/* Date of Evangelisation */}
              <div className="evang-date-field">
                <label className="form-label">DATE DE L'ÉVANGÉLISATION *</label>
                <input 
                  type="date"
                  className="input" 
                  required 
                  value={formData.evangelisation_date || ""} 
                  onChange={e => setFormData({...formData, evangelisation_date: e.target.value})} 
                  style={{ maxWidth: 220 }}
                />
              </div>

              {/* Comment */}
              <div>
                <label className="form-label">NOTES / DESCRIPTION DES ÉCHANGES</label>
                <textarea 
                  className="input" 
                  rows={4} 
                  value={formData.comment || ""} 
                  onChange={e => setFormData({...formData, comment: e.target.value})} 
                  placeholder={
                    formMode === "anonymous_bulk" 
                      ? "Consignez l'atmosphère de cette session de groupe, les retours marquants, les questions récurrentes..." 
                      : "Détails de vos échanges spirituels, questions théologiques soulevées, ouverture d'esprit de la personne..."
                  }
                  style={{ fontSize: 12, resize: "vertical" }}
                />
              </div>

              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
