"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getActiveContext, getActiveUserInfo } from "@/lib/client-session";
import { FddReportingData, computeReportingMetrics, getKeyPointsSummary } from "@/types/reporting";
import ReportingTemplate from "@/components/reporting/ReportingTemplate";
import { getAttendanceStatus, usesExplicitAttendance } from "@/lib/attendance";
import {
  Download, RefreshCw, Save, Check, AlertCircle, FileText,
  Calendar, Upload, Eye, Edit3, Church, Users,
  ChevronLeft, ChevronRight, Bookmark, Image as ImageIcon
} from "lucide-react";
import jsPDF from "jspdf";
import { toPng } from "html-to-image";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import CustomSelect from "@/components/ui/CustomSelect";
import CustomDatePicker from "@/components/ui/CustomDatePicker";

function isAttendancePresent(val: any): boolean {
  if (val === true || val === 1 || val === "present") return true;
  if (typeof val === "string" && val.trim().length > 0 && val !== "false" && val !== "unpointed" && val !== "justified" && val !== "unjustified") return true;
  if (!val || typeof val !== "object") return false;
  if (val.status === "present") return true;
  if (typeof val.service === "string" && val.service.trim().length > 0) return true;
  return false;
}

export default function ReportingPage() {
  const { notify } = useFeedback();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currentFamily, setCurrentFamily] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const reportRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHeight, setPreviewHeight] = useState(0);
  const [downloadingImage, setDownloadingImage] = useState(false);

  // Helper to format French date for Sunday
  const formatFrenchDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).replace(/^\w/, (c) => c.toUpperCase());
    } catch {
      return dateStr;
    }
  };

  const getInitialSundayDate = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 0 : day; // If today is Sunday, take today, else go back to last Sunday
    const sunday = new Date(d);
    sunday.setDate(d.getDate() - diff);
    const yyyy = sunday.getFullYear();
    const mm = String(sunday.getMonth() + 1).padStart(2, "0");
    const dd = String(sunday.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Generate list of the 12 most recent Sundays for quick filter
  const getRecentSundays = (count = 12) => {
    const sundays: { isoDate: string; label: string; isLatest: boolean }[] = [];
    const now = new Date();
    const day = now.getDay();
    const diffToSunday = day === 0 ? 0 : day;
    const baseSunday = new Date(now);
    baseSunday.setDate(now.getDate() - diffToSunday);
    baseSunday.setHours(0, 0, 0, 0);

    for (let i = 0; i < count; i++) {
      const d = new Date(baseSunday);
      d.setDate(baseSunday.getDate() - i * 7);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const isoDate = `${yyyy}-${mm}-${dd}`;
      sundays.push({
        isoDate,
        label: formatFrenchDate(isoDate),
        isLatest: i === 0,
      });
    }
    return sundays;
  };

  const [formData, setFormData] = useState<FddReportingData>({
    bergerie_id: "",
    church_id: "",
    nom_famille: "Famille de Disciples",
    nom_berger: "",
    slogan: "Suivi • Participation • Engagement • Croissance",
    date_rapport: getInitialSundayDate(),
    date_libelle: formatFrenchDate(getInitialSundayDate()),
    logo_url: "",

    nombre_total_membres: 0,
    repartition_hommes: 0,
    repartition_femmes: 0,

    culte_1: 0,
    culte_2: 0,
    culte_en_ligne: 0,

    absences_justifiees: 0,
    absences_non_justifiees: 0,
    star_en_service: 0,
    nombre_total_star: 0,
    reunion_hebdomadaire: 0,
    nouveaux_membres: 0,

    nombre_disciples: 0,
    taux_participation_disciples: 85,

    points_cles: [],
    action_1: "",
    action_2: "",
    action_3: "",
    verset_texte: "Nous qui bâtissons le mur, nous avions tous notre épée à la main ; ainsi chacun travaillait d'une main, et de l'autre tenait son arme. Chacun bâtit à son endroit, et bâtit le mur.",
    verset_ref: "Néhémie 4:11-12 (BDS)",
  });

  // Load family and auto-populate stats from members
  const loadFamilyAndMemberStats = async (dateOverride?: string, forceRecalculate: boolean = false) => {
    setLoading(true);
    try {
      // 1. Get family context
      let familyId = "";
      let familyName = "";
      let churchId = "";

      const activeCtx = getActiveContext();
      const savedFamily = localStorage.getItem("selected_family");
      if (savedFamily) {
        try {
          const parsed = JSON.parse(savedFamily);
          familyId = parsed.id;
          familyName = parsed.name;
          churchId = parsed.church_id || "";
          setCurrentFamily(parsed);
        } catch {}
      }

      if (!familyId && activeCtx?.bergerie_id) {
        familyId = activeCtx.bergerie_id;
      }

      // 2. Query members of this bergerie
      let totalMembres = 0;
      let hommes = 0;
      let femmes = 0;
      let totalStar = 0;
      let disciplesCount = 0;
      let nouveaux = 0;

      let countC1 = 0;
      let countC2 = 0;
      let countEnLigne = 0;
      let absJustifiees = 0;
      let absNonJustifiees = 0;
      let starInService = 0;
      let disciplesPresent = 0;
      let reunionHebdo = 0;

      const currentDate = dateOverride || formData.date_rapport || getInitialSundayDate();
      const [cy, cm, cd] = currentDate.split("-").map(Number);
      const sundayEnd = new Date(cy, cm - 1, cd, 23, 59, 59);
      const sevenDaysPrior = new Date(cy, cm - 1, cd - 7, 0, 0, 0);

      // Helper to determine the Monday to Sunday week dates for any date in the week
      // e.g. for Sunday 13/09/2026: Monday 07/09/2026 to Sunday 13/09/2026
      const getReportingWeekDates = (targetDateStr: string): string[] => {
        if (!targetDateStr) return [];
        const [y, m, d] = targetDateStr.split("-").map(Number);
        const target = new Date(y, m - 1, d);
        const day = target.getDay(); // 0 is Sunday
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(target);
        monday.setDate(target.getDate() + diffToMonday);

        const dates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const cur = new Date(monday);
          cur.setDate(monday.getDate() + i);
          const wy = cur.getFullYear();
          const wm = String(cur.getMonth() + 1).padStart(2, "0");
          const wd = String(cur.getDate()).padStart(2, "0");
          dates.push(`${wy}-${wm}-${wd}`);
        }
        return dates;
      };

      const weekDates: string[] = getReportingWeekDates(currentDate);

      let detectedBergerName = "";

      if (familyId) {
        // Query bergeries activities & berger_id
        const { data: bergerieData } = await supabase
          .from("bergeries")
          .select("activities, berger_id")
          .eq("id", familyId)
          .maybeSingle();

        const acts: any[] = (bergerieData?.activities as any[]) || [];
        const culteActIds = acts
          .filter((a: any) => a.id === "culte" || a.name?.toLowerCase().includes("culte"))
          .map((a: any) => a.id);
        if (!culteActIds.includes("culte")) culteActIds.push("culte");

        const normalizeStr = (s: string) =>
          (s || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();

        // Evangelisation activities (Sorties d'évangélisation)
        const evangActIds = acts
          .filter((a: any) => {
            const id = normalizeStr(a.id);
            const name = normalizeStr(a.name);
            return (
              id === "evangelisation" ||
              id.includes("evang") ||
              name.includes("evang") ||
              name.includes("sortie")
            );
          })
          .map((a: any) => a.id);
        if (!evangActIds.includes("evangelisation")) evangActIds.push("evangelisation");

        const { data: membersRaw, error } = await supabase
          .from("members")
          .select("*")
          .eq("bergerie_id", familyId);

        const members = (membersRaw || []).filter((m: any) => !m.archived && m.status !== "Externe");

        if (!error && members) {
          totalMembres = members.length;
          const explicitPointageInUse = members.some((member: any) => usesExplicitAttendance(member.attendance, culteActIds, currentDate));

          // Check if there is a member with status = 'Berger' in this family
          const bergerMember = members.find((m: any) => {
            const st = (m.status || "").toLowerCase().trim();
            return st === "berger";
          });
          if (bergerMember) {
            detectedBergerName = `${bergerMember.first_name} ${bergerMember.last_name}`.trim();
          }

          // If not found in members, check if berger_id points to a member or profile
          if (!detectedBergerName && bergerieData?.berger_id) {
            const matchMem = members.find((m: any) => m.id === bergerieData.berger_id);
            if (matchMem) {
              detectedBergerName = `${matchMem.first_name} ${matchMem.last_name}`.trim();
            } else {
              try {
                const { data: p } = await supabase
                  .from("profiles")
                  .select("display_name")
                  .eq("id", bergerieData.berger_id)
                  .maybeSingle();
                if (p?.display_name) detectedBergerName = p.display_name.trim();
              } catch {}
            }
          }

          members.forEach((m: any) => {
            // Civility
            if (m.civility === "M.") {
              hommes++;
            } else {
              femmes++;
            }

            // Star
            const isStar = Boolean(m.est_star || m.status === "Star" || m.status === "STAR");
            if (isStar) {
              totalStar++;
            }

            // Faiseurs de Disciples (FDD) : Faiseur de Disciple, Responsable, Second, Berger
            const normStatus = (m.status || "").toLowerCase().trim();
            const isFdd = 
              normStatus === "faiseur de disciple" ||
              normStatus === "faiseur de disciples" ||
              normStatus === "fdd" ||
              normStatus === "responsable" ||
              normStatus === "second" ||
              normStatus === "berger" ||
              normStatus === "disciple";
            if (isFdd) {
              disciplesCount++;
            }

            // Nouveaux membres (semaine précédant ce dimanche)
            const created = m.date_entree ? new Date(m.date_entree) : (m.created_at ? new Date(m.created_at) : null);
            if (created && created >= sevenDaysPrior && created <= sundayEnd) {
              nouveaux++;
            } else if (normStatus === "nouveau" || normStatus === "nouvelle âme" || normStatus === "invité") {
              if (created && created >= sevenDaysPrior && created <= sundayEnd) {
                nouveaux++;
              }
            }

            // Pointage du culte pour ce dimanche
            let attendedCulte: string | null = null;
            for (const actId of culteActIds) {
              const val = m.attendance?.[actId]?.[currentDate];
              if (val) {
                attendedCulte = (val === true || val === "culte_1") ? "culte_1" : val;
                break;
              }
            }

            if (attendedCulte === "culte_1") {
              countC1++;
            } else if (attendedCulte === "culte_2") {
              countC2++;
            } else if (attendedCulte === "culte_en_ligne" || attendedCulte === "en_ligne" || attendedCulte === "online") {
              countEnLigne++;
            } else if (attendedCulte) {
              countC1++;
            } else {
              // Absences
              let hasComment = false;
              let absenceStatus: "unpointed" | "justified" | "unjustified" = "unpointed";
              for (const actId of culteActIds) {
                const status = getAttendanceStatus(m.attendance, actId, currentDate);
                if (status === "justified" || status === "unjustified") absenceStatus = status;
                const c = m.attendance?.["_comments"]?.[actId]?.[currentDate];
                if (c && typeof c === "string" && c.trim().length > 0) {
                  hasComment = true;
                  break;
                }
              }
              if (absenceStatus === "justified" || hasComment) {
                absJustifiees++;
              }
            }

            if (attendedCulte) {
              if (isStar) starInService++;
              if (isFdd) disciplesPresent++;
            }

            // Participation aux sorties d'évangélisation (calcul hebdomadaire du lundi au dimanche)
            let attendedEvang = false;
            const attObj = m.attendance || {};
            const attKeys = Object.keys(attObj).filter((k) => !k.startsWith("_"));

            for (const actId of evangActIds) {
              for (const d of weekDates) {
                if (isAttendancePresent(attObj[actId]?.[d])) {
                  attendedEvang = true;
                  break;
                }
              }
              if (attendedEvang) break;
            }

            if (!attendedEvang) {
              for (const key of attKeys) {
                const lk = normalizeStr(key);
                if (lk.includes("evang") || lk.includes("sortie")) {
                  for (const d of weekDates) {
                    if (isAttendancePresent(attObj[key]?.[d])) {
                      attendedEvang = true;
                      break;
                    }
                  }
                  if (attendedEvang) break;
                }
              }
            }

            if (attendedEvang) {
              reunionHebdo++;
            }
          });

          // Accurate calculation of unjustified absences:
          // Total absences = Total members - (Present Culte 1 + Culte 2 + Culte en ligne)
          // Absences non justifiées = Total absences - Absences justifiées
          const totalPartCulte = countC1 + countC2 + countEnLigne;
          const totalSundayAbsences = Math.max(0, totalMembres - totalPartCulte);
          absNonJustifiees = Math.max(0, totalSundayAbsences - absJustifiees);

          // Check if any additional new invites were entered in this family during that week
          try {
            const { count: countInvites } = await supabase
              .from("invites")
              .select("id", { count: "exact", head: true })
              .eq("bergerie_id", familyId)
              .eq("archived", false)
              .gte("created_at", sevenDaysPrior.toISOString())
              .lte("created_at", sundayEnd.toISOString());
            if (countInvites && countInvites > 0) {
              nouveaux += countInvites;
            }
          } catch {}
        }
      }

      // If shepherd name not yet found, check profiles where bergerie_id = familyId and role = 'berger'
      if (!detectedBergerName && familyId) {
        try {
          const { data: pBerger } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("bergerie_id", familyId)
            .ilike("role", "%berger%")
            .maybeSingle();
          if (pBerger?.display_name) detectedBergerName = pBerger.display_name.trim();
        } catch {}
      }

      // If still not found, check logged-in user info
      if (!detectedBergerName) {
        const userInfo = getActiveUserInfo();
        if (userInfo) {
          if (userInfo.firstName || userInfo.lastName) {
            detectedBergerName = `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim();
          } else if (userInfo.display_name && userInfo.display_name.toLowerCase() !== "berger") {
            detectedBergerName = userInfo.display_name.trim();
          } else if (userInfo.name && userInfo.name.toLowerCase() !== "berger") {
            detectedBergerName = userInfo.name.trim();
          }
        }
      }

      const bergerName = detectedBergerName || "Prénom Nom";

      // Check for saved report for this family & date
      let existingReport: any = null;

      if (!forceRecalculate) {
        try {
          const { data: reportDb } = await supabase
            .from("rapports_fdd")
            .select("*")
            .eq("bergerie_id", familyId)
            .eq("date_rapport", currentDate)
            .maybeSingle();
          if (reportDb) existingReport = reportDb;
        } catch {}

        // Fallback local storage
        if (!existingReport) {
          const localSaved = localStorage.getItem(`fdd_report_${familyId}_${currentDate}`);
          if (localSaved) {
            try {
              existingReport = JSON.parse(localSaved);
            } catch {}
          }
        }
      }

      // Check saved logo, slogan, and bible verse for this family
      const savedLogo = localStorage.getItem(`fdd_custom_logo_${familyId}`) || "";
      const savedSlogan = localStorage.getItem(`fdd_custom_slogan_${familyId}`);
      const savedVerseText = localStorage.getItem(`fdd_custom_verse_text_${familyId}`);
      const savedVerseRef = localStorage.getItem(`fdd_custom_verse_ref_${familyId}`);

      const defaultVerseText = "Nous qui bâtissons le mur, nous avions tous notre épée à la main ; ainsi chacun travaillait d'une main, et de l'autre tenait son arme. Chacun bâtit à son endroit, et bâtit le mur.";
      const defaultVerseRef = "Néhémie 4:11-12 (BDS)";

      const effectiveSlogan = (savedSlogan !== null && savedSlogan !== undefined)
        ? savedSlogan
        : (existingReport?.slogan || "Suivi • Participation • Engagement • Croissance");

      const effectiveVerseText = (savedVerseText !== null && savedVerseText !== undefined)
        ? savedVerseText
        : (existingReport?.verset_texte || defaultVerseText);

      const effectiveVerseRef = (savedVerseRef !== null && savedVerseRef !== undefined)
        ? savedVerseRef
        : (existingReport?.verset_ref || defaultVerseRef);

      if (existingReport && !forceRecalculate) {
        setFormData((prev) => ({
          ...prev,
          ...existingReport,
          reunion_hebdomadaire: reunionHebdo,
          nom_famille: familyName || existingReport.nom_famille || prev.nom_famille,
          nom_berger: (existingReport.nom_berger && existingReport.nom_berger !== "Berger")
            ? existingReport.nom_berger
            : (bergerName !== "Prénom Nom" ? bergerName : prev.nom_berger || "Prénom Nom"),
          slogan: effectiveSlogan,
          verset_texte: effectiveVerseText,
          verset_ref: effectiveVerseRef,
          action_1: existingReport.action_1 !== undefined ? existingReport.action_1 : (prev.action_1 ?? ""),
          action_2: existingReport.action_2 !== undefined ? existingReport.action_2 : (prev.action_2 ?? ""),
          action_3: existingReport.action_3 !== undefined ? existingReport.action_3 : (prev.action_3 ?? ""),
          date_rapport: currentDate,
          date_libelle: formatFrenchDate(existingReport.date_rapport || currentDate),
          logo_url: existingReport.logo_url || savedLogo || prev.logo_url,
        }));
      } else {
        const disciplesPct = disciplesCount > 0 
          ? Math.round((disciplesPresent / disciplesCount) * 100) 
          : 0;

        // Pre-fill with database numbers and auto-calculated attendance
        setFormData((prev) => ({
          ...prev,
          bergerie_id: familyId,
          church_id: churchId,
          nom_famille: familyName || prev.nom_famille,
          nom_berger: bergerName !== "Prénom Nom" ? bergerName : (prev.nom_berger && prev.nom_berger !== "Berger" ? prev.nom_berger : "Prénom Nom"),
          slogan: effectiveSlogan,
          verset_texte: effectiveVerseText,
          verset_ref: effectiveVerseRef,
          action_1: prev.action_1 !== undefined ? prev.action_1 : "",
          action_2: prev.action_2 !== undefined ? prev.action_2 : "",
          action_3: prev.action_3 !== undefined ? prev.action_3 : "",
          date_rapport: currentDate,
          date_libelle: formatFrenchDate(currentDate),
          nombre_total_membres: totalMembres || prev.nombre_total_membres,
          repartition_hommes: hommes || prev.repartition_hommes,
          repartition_femmes: femmes || prev.repartition_femmes,
          culte_1: countC1,
          culte_2: countC2,
          culte_en_ligne: countEnLigne,
          absences_justifiees: absJustifiees,
          absences_non_justifiees: absNonJustifiees,
          star_en_service: starInService,
          nombre_total_star: totalStar || prev.nombre_total_star,
          nombre_disciples: disciplesCount,
          taux_participation_disciples: disciplesPct,
          reunion_hebdomadaire: reunionHebdo,
          nouveaux_membres: nouveaux || prev.nouveaux_membres,
          logo_url: savedLogo || prev.logo_url,
        }));
      }
    } catch (err) {
      console.error("Error loading reporting data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFamilyAndMemberStats();
  }, []);

  useEffect(() => {
    if (activeTab !== "preview") return;

    const updatePreviewSize = () => {
      const viewportWidth = previewViewportRef.current?.clientWidth || 880;
      const nextScale = Math.min(1, Math.max(0.25, (viewportWidth - 4) / 880));
      setPreviewScale(nextScale);
      setPreviewHeight((reportRef.current?.offsetHeight || 0) * nextScale);
    };

    updatePreviewSize();
    const observer = new ResizeObserver(updatePreviewSize);
    if (previewViewportRef.current) observer.observe(previewViewportRef.current);
    if (reportRef.current) observer.observe(reportRef.current);
    return () => observer.disconnect();
  }, [activeTab]);

  // Update date handler
  const handleDateChange = (newDate: string) => {
    setFormData((prev) => ({
      ...prev,
      date_rapport: newDate,
      date_libelle: formatFrenchDate(newDate),
    }));
    loadFamilyAndMemberStats(newDate, false);
  };

  // Upload custom logo handler (FileReader to Base64)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setFormData((prev) => ({ ...prev, logo_url: b64 }));
      if (formData.bergerie_id) {
        localStorage.setItem(`fdd_custom_logo_${formData.bergerie_id}`, b64);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save report
  const handleSaveReport = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      // 1. Save to localStorage
      if (formData.bergerie_id && formData.date_rapport) {
        localStorage.setItem(
          `fdd_report_${formData.bergerie_id}_${formData.date_rapport}`,
          JSON.stringify(formData)
        );
        if (formData.slogan !== undefined) {
          localStorage.setItem(`fdd_custom_slogan_${formData.bergerie_id}`, formData.slogan);
        }
        if (formData.verset_texte !== undefined) {
          localStorage.setItem(`fdd_custom_verse_text_${formData.bergerie_id}`, formData.verset_texte);
        }
        if (formData.verset_ref !== undefined) {
          localStorage.setItem(`fdd_custom_verse_ref_${formData.bergerie_id}`, formData.verset_ref);
        }
      }

      // 2. Save to Supabase (if table exists)
      const payload = {
        bergerie_id: formData.bergerie_id,
        church_id: formData.church_id || null,
        date_rapport: formData.date_rapport,
        nom_famille: formData.nom_famille,
        nom_berger: formData.nom_berger,
        slogan: formData.slogan || null,
        logo_url: formData.logo_url || null,
        nombre_total_membres: Number(formData.nombre_total_membres) || 0,
        repartition_hommes: Number(formData.repartition_hommes) || 0,
        repartition_femmes: Number(formData.repartition_femmes) || 0,
        culte_1: Number(formData.culte_1) || 0,
        culte_2: Number(formData.culte_2) || 0,
        culte_en_ligne: Number(formData.culte_en_ligne) || 0,
        absences_justifiees: Number(formData.absences_justifiees) || 0,
        absences_non_justifiees: Number(formData.absences_non_justifiees) || 0,
        star_en_service: Number(formData.star_en_service) || 0,
        nombre_total_star: Number(formData.nombre_total_star) || 0,
        reunion_hebdomadaire: Number(formData.reunion_hebdomadaire) || 0,
        nouveaux_membres: Number(formData.nouveaux_membres) || 0,
        nombre_disciples: Number(formData.nombre_disciples) || 0,
        taux_participation_disciples: Number(formData.taux_participation_disciples) || 0,
        action_1: formData.action_1,
        action_2: formData.action_2,
        action_3: formData.action_3,
        verset_texte: formData.verset_texte,
        verset_ref: formData.verset_ref,
        updated_at: new Date().toISOString(),
      };

      try {
        const { error } = await supabase
          .from("rapports_fdd")
          .upsert(payload, { onConflict: "bergerie_id, date_rapport" });
        if (error) {
          console.warn("Supabase upsert warning (table may require patch):", error.message);
        }
      } catch (dbErr) {
        console.warn("Supabase error:", dbErr);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      setSaving(false);
    }
  };

  // Export to Full-Frame High-Definition PDF (snug fit without empty vertical white bands)
  const handleDownloadPdf = async () => {
    const printElement = document.getElementById("reporting-print-container") || reportRef.current;
    if (!printElement) {
      notify("Erreur : le modèle de rapport n'a pas été trouvé.");
      return;
    }

    setDownloadingPdf(true);

    try {
      const dataUrl = await toPng(printElement, {
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      // Wait for image dimensions
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
      });

      // Snug Full-Frame Landscape: 297mm base width (A4 landscape)
      // Height is calculated proportionally to match the exact report aspect ratio
      const targetW = 297;
      const margin = 4;
      const printW = targetW - margin * 2;
      const printH = (img.height * printW) / img.width;
      const targetH = Math.round(printH + margin * 2);

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [targetW, targetH],
      });

      pdf.addImage(dataUrl, "PNG", margin, margin, printW, printH, undefined, "FAST");

      const safeFamilyName = (formData.nom_famille || "Famille")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`Rapport_FDD_${safeFamilyName}_${formData.date_rapport}.pdf`);
      notify("Rapport PDF généré en plein cadre haute lisibilité !");
    } catch (err) {
      console.error("PDF generation error:", err);
      notify("Une erreur est survenue lors de la génération du PDF. Veuillez réessayer.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Export to HD PNG Image (ideal for direct WhatsApp and mobile sharing)
  const handleDownloadImage = async () => {
    const printElement = document.getElementById("reporting-print-container") || reportRef.current;
    if (!printElement) {
      notify("Erreur : le modèle de rapport n'a pas été trouvé.");
      return;
    }

    setDownloadingImage(true);

    try {
      const dataUrl = await toPng(printElement, {
        pixelRatio: 2.5,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      const safeFamilyName = (formData.nom_famille || "Famille").replace(/[^a-zA-Z0-9_-]/g, "_");
      const link = document.createElement("a");
      link.download = `Rapport_FDD_${safeFamilyName}_${formData.date_rapport}.png`;
      link.href = dataUrl;
      link.click();
      notify("Image HD générée avec succès pour partage WhatsApp !");
    } catch (err) {
      console.error("Image generation error:", err);
      notify("Une erreur est survenue lors de la génération de l'image.");
    } finally {
      setDownloadingImage(false);
    }
  };

  const metrics = computeReportingMetrics(formData);

  return (
    <div className="reporting-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* ── TOP ACTION BAR ── */}
      <div
        className="reporting-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div className="reporting-title-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "10px",
                background: "linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(139,92,246,0.1) 100%)",
                border: "1px solid rgba(212, 175, 55, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--cream)",
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h1 className="reporting-page-title" style={{ fontSize: 24, fontWeight: 800, margin: 0, color: "var(--cream)" }}>
                Reporting Culte & Engagement
              </h1>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "2px 0 0" }}>
                {formData.nom_famille} • {formData.date_libelle}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="reporting-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Tab switcher */}
          <div
            className="reporting-tab-switcher"
            style={{
              display: "flex",
              borderRadius: "8px",
              padding: "3px",
            }}
          >
            <button
              onClick={() => setActiveTab("edit")}
              className={`reporting-tab-btn ${activeTab === "edit" ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: "6px",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Edit3 size={15} />
              Formulaire
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`reporting-tab-btn ${activeTab === "preview" ? "active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: "6px",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Eye size={15} />
              Aperçu du rapport
            </button>
          </div>

          <button
            onClick={() => loadFamilyAndMemberStats(formData.date_rapport, true)}
            disabled={loading}
            className="btn btn-outline"
            style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            title="Recharger et recalculer avec les données des membres"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Synchroniser
          </button>

          <button
            onClick={handleSaveReport}
            disabled={saving}
            className="btn btn-outline"
            style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
          >
            {saveSuccess ? <Check size={15} className="text-emerald-400" /> : <Save size={15} />}
            {saving ? "Sauvegarde..." : saveSuccess ? "Enregistré !" : "Enregistrer"}
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn btn-primary"
            style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
            title="Télécharger le rapport officiel au format PDF"
          >
            <Download size={15} />
            {downloadingPdf ? "Génération PDF..." : "Télécharger en PDF"}
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={downloadingImage}
            className="btn btn-outline"
            style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, borderColor: "rgba(212, 175, 55, 0.4)" }}
            title="Télécharger une image HD (PNG) prête pour WhatsApp"
          >
            <ImageIcon size={15} color="var(--gold)" />
            {downloadingImage ? "Génération image..." : "Image HD (WhatsApp)"}
          </button>
        </div>
      </div>

      {/* ── TABS CONTENT ── */}
      {activeTab === "edit" && (
        <div className="reporting-form-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* ── LEFT COLUMN: REPARTITION CULTE & DATES ── */}
          <div className="reporting-form-column" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Card: Informations Générales & Filtre du Dimanche */}
            <section className="glass-card reporting-form-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Calendar size={18} style={{ color: "var(--gold)" }} />
                  Sélection du Dimanche & Paramètres
                </h3>

                {/* Quick Sunday navigation buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m, d] = formData.date_rapport.split("-").map(Number);
                      const prevD = new Date(y, m - 1, d - 7);
                      const py = prevD.getFullYear();
                      const pm = String(prevD.getMonth() + 1).padStart(2, "0");
                      const pd = String(prevD.getDate()).padStart(2, "0");
                      handleDateChange(`${py}-${pm}-${pd}`);
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 11, padding: "4px 8px", height: 28 }}
                    title="Dimanche précédent (-7 jours)"
                  >
                    <ChevronLeft size={14} /> Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const [y, m, d] = formData.date_rapport.split("-").map(Number);
                      const nextD = new Date(y, m - 1, d + 7);
                      const ny = nextD.getFullYear();
                      const nm = String(nextD.getMonth() + 1).padStart(2, "0");
                      const nd = String(nextD.getDate()).padStart(2, "0");
                      handleDateChange(`${ny}-${nm}-${nd}`);
                    }}
                    className="btn btn-outline btn-sm"
                    style={{ fontSize: 11, padding: "4px 8px", height: 28 }}
                    title="Dimanche suivant (+7 jours)"
                  >
                    Suivant <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Sunday dropdown filter */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 700, color: "var(--gold-light)", marginBottom: 6, display: "block" }}>
                  Choisir le Dimanche du Culte
                </label>
                <CustomSelect
                  value={formData.date_rapport}
                  onChange={handleDateChange}
                  searchable={false}
                  options={[
                    ...getRecentSundays(12).map((s) => ({
                      value: s.isoDate,
                      label: s.label,
                      badge: s.isLatest ? "Dernier dimanche" : undefined,
                    })),
                    ...(!getRecentSundays(12).some(s => s.isoDate === formData.date_rapport) ? [{
                      value: formData.date_rapport,
                      label: `${formData.date_libelle || formData.date_rapport} (Date personnalisée)`,
                    }] : [])
                  ]}
                />
              </div>

              <div className="reporting-fields-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ marginBottom: 6, display: "block" }}>Date exacte (calendrier)</label>
                  <CustomDatePicker
                    value={formData.date_rapport}
                    onChange={handleDateChange}
                    placeholder="Sélectionner la date"
                  />
                </div>
                <div>
                  <label className="form-label">Nom du Berger (Prénom + Nom)</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.nom_berger}
                    placeholder="Ex: David Kouassi"
                    onChange={(e) => setFormData({ ...formData, nom_berger: e.target.value })}
                  />
                </div>
              </div>

              <div className="reporting-fields-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
                <div>
                  <label className="form-label">Nom de la Famille</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.nom_famille}
                    onChange={(e) => setFormData({ ...formData, nom_famille: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Logo Officiel (Optionnel)</label>
                  <label
                    className="btn btn-outline"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Upload size={14} />
                    {formData.logo_url ? "Logo importé ✓" : "Importer image logo"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleLogoUpload}
                    />
                  </label>
                </div>
              </div>

              {/* Devise / Slogan personnalisable pour chaque famille */}
              <div style={{ marginTop: 12 }}>
                <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Devise / Slogan de la Famille</span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>Propre à chaque famille</span>
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.slogan ?? ""}
                  placeholder="Ex: Suivi • Participation • Engagement • Croissance"
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ ...prev, slogan: val }));
                    if (formData.bergerie_id) {
                      localStorage.setItem(`fdd_custom_slogan_${formData.bergerie_id}`, val);
                    }
                  }}
                />
              </div>
            </section>

            {/* Card: Participation par Culte (Sans EJP) */}
            <section className="glass-card reporting-form-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <Church size={18} style={{ color: "var(--gold)" }} />
                Présences par Culte (Ce Dimanche)
              </h3>

              <div className="reporting-fields-grid reporting-fields-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <div>
                  <label className="form-label" style={{ color: "var(--sky)", fontWeight: 700 }}>Culte 1 (Matin)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.culte_1 || ""}
                    onChange={(e) => setFormData({ ...formData, culte_1: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ color: "var(--orange)", fontWeight: 700 }}>Culte 2 (Midi)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.culte_2 || ""}
                    onChange={(e) => setFormData({ ...formData, culte_2: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ color: "var(--violet)", fontWeight: 700 }}>Culte en Ligne</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.culte_en_ligne || ""}
                    onChange={(e) => setFormData({ ...formData, culte_en_ligne: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Total Summary */}
              <div
                className="reporting-total-banner"
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  borderRadius: "8px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span className="reporting-total-label" style={{ fontSize: 13, fontWeight: 700 }}>
                  TOTAL PARTICIPATION AU CULTE :
                </span>
                <span className="reporting-total-val" style={{ fontSize: 18, fontWeight: 900 }}>
                  {metrics.totalParticipation} participants ({metrics.tauxParticipationGlobale}%)
                </span>
              </div>
            </section>

            {/* Card: Absences & STAR */}
            <section className="glass-card reporting-form-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)", marginBottom: 14 }}>
                Absences, S.T.A.R & Semaine
              </h3>

              <div className="reporting-fields-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="form-label">Absences justifiées</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.absences_justifiees || ""}
                    onChange={(e) => setFormData({ ...formData, absences_justifiees: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Absences non justifiées</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.absences_non_justifiees || ""}
                    onChange={(e) => setFormData({ ...formData, absences_non_justifiees: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">S.T.A.R en service ce dimanche</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.star_en_service || ""}
                    onChange={(e) => setFormData({ ...formData, star_en_service: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Participation aux sorties d'évangélisation</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.reunion_hebdomadaire || ""}
                    onChange={(e) => setFormData({ ...formData, reunion_hebdomadaire: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </section>
          </div>

          {/* ── RIGHT COLUMN: MEMBRES, ACTIONS & VERSET ── */}
          <div className="reporting-form-column" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Card: Effectifs des Membres (Auto-sync) */}
            <section className="glass-card reporting-form-card" style={{ padding: 20 }}>
              <div className="reporting-card-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={18} style={{ color: "var(--gold)" }} />
                  Effectif de la Famille
                </h3>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Issu de la base de données</span>
              </div>

              <div className="reporting-fields-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="form-label">Total membres</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.nombre_total_membres || ""}
                    onChange={(e) => setFormData({ ...formData, nombre_total_membres: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Nouveaux membres</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.nouveaux_membres || ""}
                    onChange={(e) => setFormData({ ...formData, nouveaux_membres: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ color: "var(--sky)", fontWeight: 700 }}>Hommes</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.repartition_hommes || ""}
                    onChange={(e) => setFormData({ ...formData, repartition_hommes: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ color: "var(--pink)", fontWeight: 700 }}>Femmes</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.repartition_femmes || ""}
                    onChange={(e) => setFormData({ ...formData, repartition_femmes: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Total S.T.A.R dans la famille</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.nombre_total_star || ""}
                    onChange={(e) => setFormData({ ...formData, nombre_total_star: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Faiseurs de Disciples (FDD)</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={formData.nombre_disciples ?? ""}
                    onChange={(e) => setFormData({ ...formData, nombre_disciples: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div>
                  <label className="form-label">Taux Participation FDD (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="input"
                    value={formData.taux_participation_disciples ?? ""}
                    onChange={(e) => setFormData({ ...formData, taux_participation_disciples: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </section>

            {/* Card: Points Clés & Synthèse Pastorale */}
            <section className="glass-card reporting-form-card" style={{ padding: 20 }}>
              <div className="reporting-card-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={18} style={{ color: "var(--gold)" }} />
                  Points Clés & Synthèse Pastorale
                </h3>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 11, height: 32, padding: "0 12px", borderRadius: 8 }}
                  onClick={() => {
                    const generated = getKeyPointsSummary(formData, metrics);
                    setFormData(prev => ({ ...prev, points_cles: generated }));
                  }}
                  title="Recalculer les points clés selon les chiffres actuels"
                >
                  <RefreshCw size={13} style={{ marginRight: 6 }} />
                  Actualiser la synthèse
                </button>
              </div>

              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
                Synthèse pastorale automatique calculée selon vos chiffres et présences réels du culte. Vous pouvez ajuster chaque point librement :
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(formData.points_cles && formData.points_cles.length > 0
                  ? formData.points_cles
                  : getKeyPointsSummary(formData, metrics)
                ).map((pt, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--gold)", width: 18, flexShrink: 0 }}>
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      className="input"
                      value={pt}
                      onChange={(e) => {
                        const currentPoints = [
                          ...(formData.points_cles && formData.points_cles.length > 0
                            ? formData.points_cles
                            : getKeyPointsSummary(formData, metrics))
                        ];
                        currentPoints[idx] = e.target.value;
                        setFormData(prev => ({ ...prev, points_cles: currentPoints }));
                      }}
                      style={{ fontSize: 12.5 }}
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Card: Plan d'Action (On passe à l'action !) */}
            <section className="glass-card reporting-form-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)", margin: 0 }}>
                  🎯 Plan d'Action — On passe à l'action !
                </h3>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Entièrement personnalisable</span>
              </div>

              <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                Renseignez les 3 actions prioritaires décidées pour la famille cette semaine. Cliquez sur une suggestion rapide ou saisissez librement votre texte :
              </p>

              {/* Quick suggestion chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {[
                  "Faire le suivi pastoral des absences non justifiées",
                  "Organiser une visite fraternelle aux brebis fragiles",
                  "Encourager à participer à la semaine de jeûne et prière",
                  "Appeler chaque membre absent pour prendre des nouvelles",
                  "Augmenter le nombre de véritables faiseurs de disciples",
                  "Planifier une sortie d'évangélisation en famille",
                ].map((sug, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => {
                      if (!formData.action_1 || formData.action_1.trim() === "") {
                        setFormData(prev => ({ ...prev, action_1: sug }));
                      } else if (!formData.action_2 || formData.action_2.trim() === "") {
                        setFormData(prev => ({ ...prev, action_2: sug }));
                      } else {
                        setFormData(prev => ({ ...prev, action_3: sug }));
                      }
                    }}
                    style={{
                      fontSize: 11,
                      padding: "4px 9px",
                      borderRadius: "14px",
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      color: "var(--cream)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    title="Cliquer pour insérer dans la première action libre"
                  >
                    + {sug}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Action 1 (Priorité haute)</span>
                    {formData.action_1 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, action_1: "" })}
                        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}
                      >
                        Effacer
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.action_1}
                    placeholder="Ex: Faire le suivi des absences non justifiées..."
                    onChange={(e) => setFormData({ ...formData, action_1: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Action 2 (Engagement & Prière)</span>
                    {formData.action_2 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, action_2: "" })}
                        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}
                      >
                        Effacer
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.action_2}
                    placeholder="Ex: Encourager au jeûne et prière..."
                    onChange={(e) => setFormData({ ...formData, action_2: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Action 3 (Croissance & Disciples)</span>
                    {formData.action_3 && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, action_3: "" })}
                        style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11, cursor: "pointer" }}
                      >
                        Effacer
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData.action_3}
                    placeholder="Ex: Augmenter les faiseurs de disciples..."
                    onChange={(e) => setFormData({ ...formData, action_3: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {/* Card: Verset Biblique */}
            <section className="glass-card reporting-form-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cream)", margin: 0 }}>
                  Verset Biblique de Clôture
                </h3>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>Mémorisé pour tous vos futurs rapports</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label className="form-label">Texte du verset</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={formData.verset_texte}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, verset_texte: val }));
                      if (formData.bergerie_id) {
                        localStorage.setItem(`fdd_custom_verse_text_${formData.bergerie_id}`, val);
                      }
                    }}
                  />
                </div>

                <div>
                  <label className="form-label">Référence (Livre, Chapitre, Version)</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.verset_ref}
                    placeholder="Ex: Néhémie 4:11-12 (BDS)"
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, verset_ref: val }));
                      if (formData.bergerie_id) {
                        localStorage.setItem(`fdd_custom_verse_ref_${formData.bergerie_id}`, val);
                      }
                    }}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── PREVIEW BANNER (when on preview tab) ── */}
      {activeTab === "preview" && (
        <div className="reporting-preview-banner-wrap" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div
            className="reporting-preview-banner"
            style={{
              padding: "10px 16px",
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              border: "1px solid rgba(212, 175, 55, 0.3)",
              borderRadius: "8px",
              fontSize: 13,
              color: "var(--gold-light)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FileText size={16} />
            <span>
              Aperçu officiel du rapport. Cliquez sur <strong>« Télécharger en PDF »</strong> pour générer le document à transmettre à la hiérarchie pastorale.
            </span>
          </div>
        </div>
      )}

      {/* ── REPORTING TEMPLATE (ALWAYS MOUNTED IN DOM SO PDF DOWNLOAD WORKS AT ANY TIME) ── */}
      <div
        ref={previewViewportRef}
        className={activeTab === "preview" ? "reporting-preview-viewport" : "reporting-preview-hidden"}
        style={
          activeTab === "preview"
            ? {
                width: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                padding: "10px 0 30px",
                display: "flex",
                justifyContent: "center",
                WebkitOverflowScrolling: "touch",
                height: previewHeight ? previewHeight + 40 : undefined,
              }
            : {
                position: "fixed",
                left: "-9999px",
                top: 0,
                width: 880,
                opacity: 0,
                pointerEvents: "none",
                zIndex: -100,
              }
        }
      >
        <div
          className="reporting-preview-stage"
          style={{
            width: 880,
            flex: "0 0 880px",
            transform: activeTab === "preview" ? `scale(${previewScale})` : undefined,
            transformOrigin: "top center",
          }}
        >
          <ReportingTemplate data={formData} containerRef={reportRef} />
        </div>
      </div>
    </div>
  );
}
