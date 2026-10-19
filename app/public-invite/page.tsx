"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Flame, Church, Loader2, CheckCircle2, ArrowRight, UserPlus, Users, Check, X, Globe2, HeartHandshake } from "lucide-react";
import { supabase } from "@/lib/supabase";
import YesNoField from "@/components/ui/YesNoField";
import CustomSelect from "@/components/ui/CustomSelect";
import CustomDatePicker from "@/components/ui/CustomDatePicker";
import { COUNTRIES } from "@/components/ui/CountryPickerModal";
import { inviteCopy, languageNames, localizedOptions, eventValues, civilityValues, ageValues, type InviteLocale } from "./translations";
import { emptyInvite, invitePayload, nextInvite, validateInvite, type InviteFormData, type FormField, type FormIssue } from "./form-data";
import styles from "./PublicInvite.module.css";

type ChurchInfo = { id: string; name: string; city?: string | null };
const LANGUAGE_KEY = "poimen_invite_language_v1";

function Field({ id, label, required, optional, error, children }: {
  id: string; label: string; required?: boolean; optional?: string; error?: string; children: ReactNode;
}) {
  return <div className={styles.field} data-field={id} data-invalid={!!error}>
    <label id={`${id}-label`} htmlFor={id}>{label}{required ? <span aria-hidden="true"> *</span> : optional ? <small>{optional}</small> : null}</label>
    {children}
    {error && <p id={`${id}-error`} className={styles.fieldError}>{error}</p>}
  </div>;
}

function Question({ id, label, value, onChange, yes, no, error }: {
  id: string; label: string; value: boolean | null; onChange: (value: boolean) => void; yes: string; no: string; error?: string;
}) {
  return <YesNoField name={id} label={label} value={value} onChange={onChange} required yesLabel={yes} noLabel={no} error={error} />;
}

export default function PublicInvitePage() {
  const [locale, setLocale] = useState<InviteLocale>("fr");
  const t = inviteCopy[locale];
  const [churches, setChurches] = useState<ChurchInfo[]>([]);
  const [selectedChurchId, setSelectedChurchId] = useState("");
  const [isUrlLocked, setIsUrlLocked] = useState(false);
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const savingRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLHeadingElement>(null);
  const [pendingAction, setPendingAction] = useState<"finish" | "add_another">("finish");
  const [success, setSuccess] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [lastSavedGuestName, setLastSavedGuestName] = useState("");
  const [banner, setBanner] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [issue, setIssue] = useState<FormIssue | null>(null);
  const [formData, setFormData] = useState<InviteFormData>(() => emptyInvite());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (saved === "fr" || saved === "en" || saved === "nl") setLocale(saved);
    } catch { /* Language selection remains usable without browser storage. */ }
  }, []);

  useEffect(() => {
    const original = document.documentElement.lang;
    document.documentElement.lang = locale;
    return () => { document.documentElement.lang = original; };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingChurches(true);
      setLoadFailed(false);
      try {
        const { data, error } = await supabase.from("churches").select("id, name, city").order("name");
        if (error) throw error;
        if (cancelled) return;
        setChurches(data || []);
        const id = new URLSearchParams(window.location.search).get("church_id");
        const church = data?.find(item => item.id === id);
        if (church) { setSelectedChurchId(church.id); setIsUrlLocked(true); }
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoadingChurches(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [loadAttempt]);

  useEffect(() => {
    if (success || isFinished) statusRef.current?.focus();
  }, [success, isFinished]);

  const countryOptions = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return COUNTRIES.map(country => ({ value: country.name, label: `${country.flag} ${locale === "fr" ? country.name : names.of(country.code) || country.name}` }))
      .sort((a, b) => a.label.slice(5).localeCompare(b.label.slice(5), locale));
  }, [locale]);
  const selectText = { search: t.search, clearSearch: t.clearSearch, noResults: t.noResults };

  function changeLanguage(language: InviteLocale) {
    setLocale(language);
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch { /* Optional preference. */ }
  }
  function update<K extends keyof InviteFormData>(key: K, value: InviteFormData[K]) {
    setFormData(previous => ({ ...previous, [key]: value, ...(key === "baptemeEau" ? { interetBapteme: null } : {}) }));
    if (issue?.field === key) setIssue(null);
  }
  const fieldError = (field: FormField) => issue?.field === field ? t[issue.message] : undefined;
  const inputProps = (field: keyof InviteFormData) => ({
    id: field, name: field, "aria-invalid": issue?.field === field,
    "aria-describedby": issue?.field === field ? `${field}-error` : undefined,
  });
  function resetForNextGuest(family: boolean) {
    setFormData(previous => nextInvite(previous, family));
    setSuccess(false); setIsFinished(false); setIssue(null); setSaveError(false); setBanner(family);
    requestAnimationFrame(() => {
      document.getElementById("firstName")?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  async function handleSubmit(mode: "finish" | "add_another") {
    if (savingRef.current) return;
    const invalid = validateInvite(formData, selectedChurchId);
    setIssue(invalid);
    setSaveError(false);
    if (invalid) {
      requestAnimationFrame(() => {
        const field = formRef.current?.querySelector<HTMLElement>(`[data-field="${invalid.field}"]`);
        field?.scrollIntoView({ block: "center", behavior: "instant" });
        field?.querySelector<HTMLElement>("input, button, textarea")?.focus({ preventScroll: true });
      });
      return;
    }
    savingRef.current = true;
    setSubmitting(true); setPendingAction(mode);
    const payload = invitePayload(formData, selectedChurchId);
    try {
      const { error } = await supabase.from("invites").insert(payload);
      if (error) {
        const columnError = error.code === "42703" || error.code === "PGRST204";
        if (!columnError || !/autre_eglise|pays/.test(error.message)) throw error;
        // Support installations whose optional columns have not been migrated yet.
        const { autre_eglise, pays, ...fallback } = payload;
        const notes = [pays !== "Belgique" ? `[Pays de résidence : ${pays}]` : "", autre_eglise ? `[Église d'origine : ${autre_eglise}]` : ""].filter(Boolean);
        const { error: retryError } = await supabase.from("invites").insert({ ...fallback, commentaire: [...notes, fallback.commentaire].filter(Boolean).join(" ") || null });
        if (retryError) throw retryError;
      }
      setLastSavedGuestName(`${formData.firstName.trim()} ${formData.lastName.trim()}`);
      if (mode === "add_another") resetForNextGuest(true);
      else { setSuccess(true); setIsFinished(false); window.scrollTo({ top: 0, behavior: "instant" }); }
    } catch {
      setSaveError(true);
    } finally {
      savingRef.current = false;
      setSubmitting(false);
    }
  }

  return <main className={styles.page} lang={locale}>
    <div className={styles.shell}>
      <nav className={styles.language} aria-label={t.language}>
        <Globe2 size={17} aria-hidden="true" />
        {(Object.keys(languageNames) as InviteLocale[]).map(language => <button key={language} type="button" lang={language} aria-pressed={locale === language} onClick={() => changeLanguage(language)}>{languageNames[language]}</button>)}
      </nav>
      <header className={styles.hero}>
        <span className={styles.eyebrow}><Flame size={18} aria-hidden="true" /> {t.department}</span>
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
        <span className={styles.formTag}>{t.formTitle}</span>
      </header>

      {loadingChurches ? <div className={styles.state} role="status"><Loader2 className={styles.spinner} size={24} /><p>{t.loading}</p></div>
        : loadFailed || !churches.length ? <div className={styles.state} role="alert"><p>{loadFailed ? t.loadError : t.noChurches}</p><button className={styles.secondary} onClick={() => setLoadAttempt(value => value + 1)}>{t.retry}</button></div>
        : success || isFinished ? <section className={styles.success}>
          <div className={styles.successIcon}><CheckCircle2 size={32} /></div>
          <h2 ref={statusRef} tabIndex={-1}>{isFinished ? t.finished : t.successTitle}</h2>
          {lastSavedGuestName && <p className={styles.savedName}>{lastSavedGuestName}</p>}
          <p>{isFinished ? t.finishedText : t.successText}</p>
          {isFinished ? <button className={styles.primary} onClick={() => resetForNextGuest(false)}><UserPlus size={18} />{t.newForm}</button> : <>
            <div className={styles.nextGuest}>
              <h3>{t.anotherTitle}</h3>
              <button className={styles.choice} onClick={() => resetForNextGuest(true)}><Users size={21} /><span>{t.family}<small>{t.familyHint}</small></span><ArrowRight size={18} /></button>
              <button className={styles.choice} onClick={() => resetForNextGuest(false)}><UserPlus size={21} /><span>{t.newGuest}<small>{t.newGuestHint}</small></span><ArrowRight size={18} /></button>
            </div>
            <button className={styles.primary} onClick={() => setIsFinished(true)}>{t.finish}<Check size={18} /></button>
          </>}
        </section> : <form ref={formRef} className={styles.form} noValidate onSubmit={event => { event.preventDefault(); void handleSubmit("finish"); }} aria-busy={submitting}>
          <p className={styles.requiredNote}>{t.required}</p>
          {banner && <div className={styles.banner} role="status"><CheckCircle2 size={20} /><div>{lastSavedGuestName && <strong>{t.saved} · {lastSavedGuestName}</strong>}<p>{t.familyBanner}</p></div><button type="button" onClick={() => setBanner(false)} aria-label={t.dismiss}><X size={18} /></button></div>}
          <fieldset className={styles.section} disabled={submitting}>
            <legend><span>01</span>{t.visit}</legend><p className={styles.sectionHint}>{t.visitHint}</p>
            <Field id="church" label={t.church} required error={fieldError("church")}>
              <CustomSelect value={selectedChurchId} onChange={value => { setSelectedChurchId(value); if (issue?.field === "church") setIssue(null); }} disabled={isUrlLocked} placeholder={t.churchPlaceholder} ariaLabel={t.church} messages={selectText} icon={<Church size={17} />} options={churches.map(church => ({ value: church.id, label: church.name, sublabel: church.city || undefined }))} />
            </Field>
            <div className={styles.grid}>
              <Field id="arrivalDate" label={t.date} required error={fieldError("arrivalDate")}><CustomDatePicker value={formData.arrivalDate} onChange={value => update("arrivalDate", value)} locale={locale} placeholder={t.datePlaceholder} ariaLabel={t.date} /></Field>
              <Field id="event" label={t.event} required error={fieldError("event")}><CustomSelect value={formData.event} onChange={value => update("event", value)} ariaLabel={t.event} options={localizedOptions(eventValues, t.events)} searchable={false} /></Field>
            </div>
          </fieldset>
          <fieldset className={styles.section} disabled={submitting}>
            <legend><span>02</span>{t.details}</legend><p className={styles.sectionHint}>{t.detailsHint}</p>
            <div className={styles.nameGrid}>
              <Field id="civility" label={t.civility} required><CustomSelect value={formData.civility} onChange={value => update("civility", value)} ariaLabel={t.civility} options={localizedOptions(civilityValues, t.civilities)} searchable={false} /></Field>
              <Field id="firstName" label={t.firstName} required error={fieldError("firstName")}><input {...inputProps("firstName")} autoComplete="given-name" required value={formData.firstName} onChange={event => update("firstName", event.target.value)} /></Field>
              <Field id="lastName" label={t.lastName} required error={fieldError("lastName")}><input {...inputProps("lastName")} autoComplete="family-name" required value={formData.lastName} onChange={event => update("lastName", event.target.value)} /></Field>
            </div>
            <div className={styles.grid}>
              <Field id="phone" label={t.phone} required error={fieldError("phone")}><input {...inputProps("phone")} type="tel" autoComplete="tel" required value={formData.phone} onChange={event => update("phone", event.target.value.replace(/[^0-9+\-\s()]/g, ""))} placeholder="+32 470 12 34 56" /></Field>
              <Field id="email" label={t.email} optional={t.optional} error={fieldError("email")}><input {...inputProps("email")} type="email" autoComplete="email" value={formData.email} onChange={event => update("email", event.target.value)} placeholder="vous@exemple.com" /></Field>
              <Field id="age" label={t.age}><CustomSelect value={formData.age} onChange={value => update("age", value)} ariaLabel={t.age} options={localizedOptions(ageValues, t.ages)} searchable={false} /></Field>
              <Field id="pays" label={t.country} required><CustomSelect value={formData.pays} onChange={value => update("pays", value)} ariaLabel={t.country} placeholder={t.select} options={countryOptions} messages={selectText} searchable /></Field>
            </div>
            <Field id="address" label={t.address} optional={t.optional}><input {...inputProps("address")} autoComplete="street-address" value={formData.address} onChange={event => update("address", event.target.value)} placeholder={t.addressPlaceholder} /></Field>
            <Question id="aEteInvite" label={t.invited} value={formData.aEteInvite} onChange={value => update("aEteInvite", value)} yes={t.yes} no={t.no} error={fieldError("aEteInvite")} />
            {formData.aEteInvite && <Field id="parQui" label={t.inviter}><input {...inputProps("parQui")} value={formData.parQui} onChange={event => update("parQui", event.target.value)} placeholder={t.inviterPlaceholder} /></Field>}
          </fieldset>
          <fieldset className={styles.section} disabled={submitting}>
            <legend><span>03</span>{t.journey}</legend><p className={styles.sectionHint}>{t.journeyHint}</p>
            <Question id="aps" label={t.aps} value={formData.aps} onChange={value => update("aps", value)} yes={t.yes} no={t.no} error={fieldError("aps")} />
            <Question id="localChurch" label={t.localChurch} value={formData.localChurch} onChange={value => update("localChurch", value)} yes={t.yes} no={t.no} error={fieldError("localChurch")} />
            {formData.localChurch && <Field id="autreEglise" label={t.otherChurch} required error={fieldError("autreEglise")}><input {...inputProps("autreEglise")} required value={formData.autreEglise} onChange={event => update("autreEglise", event.target.value)} placeholder={t.otherChurchPlaceholder} /></Field>}
            <Question id="baptemeEau" label={t.baptized} value={formData.baptemeEau} onChange={value => update("baptemeEau", value)} yes={t.yes} no={t.no} error={fieldError("baptemeEau")} />
            {formData.baptemeEau === false && <Question id="interetBapteme" label={t.baptismInterest} value={formData.interetBapteme} onChange={value => update("interetBapteme", value)} yes={t.yes} no={t.no} error={fieldError("interetBapteme")} />}
            <Question id="interetFormation" label={t.training} value={formData.interetFormation} onChange={value => update("interetFormation", value)} yes={t.yes} no={t.no} error={fieldError("interetFormation")} />
            <Question id="interetCDM" label={t.cells} value={formData.interetCDM} onChange={value => update("interetCDM", value)} yes={t.yes} no={t.no} error={fieldError("interetCDM")} />
            <Field id="commentaire" label={t.comment} optional={t.optional}><textarea {...inputProps("commentaire")} rows={4} value={formData.commentaire} onChange={event => update("commentaire", event.target.value)} placeholder={t.commentPlaceholder} /></Field>
          </fieldset>
          <div className={styles.actions}>
            {issue && <p className={styles.errorSummary} role="alert">{t.errorTitle} : {t[issue.message]}</p>}
            {saveError && <p className={styles.errorSummary} role="alert">{t.saveError}</p>}
            <button type="submit" className={styles.primary} disabled={submitting}>{submitting && pendingAction === "finish" ? <><Loader2 className={styles.spinner} size={19} />{t.saving}</> : <>{t.submit}<ArrowRight size={19} /></>}</button>
            <button type="button" className={styles.secondary} onClick={() => void handleSubmit("add_another")} disabled={submitting}>{submitting && pendingAction === "add_another" ? <><Loader2 className={styles.spinner} size={19} />{t.saving}</> : <><UserPlus size={18} />{t.addAnother}</>}</button>
          </div>
        </form>}
      <footer className={styles.footer}><HeartHandshake size={17} aria-hidden="true" />{t.department} · Poimén</footer>
    </div>
  </main>;
}
