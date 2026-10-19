export interface InviteFormData {
  civility: string; firstName: string; lastName: string; age: string;
  phone: string; email: string; pays: string; address: string;
  arrivalDate: string; event: string; aps: boolean | null;
  localChurch: boolean | null; autreEglise: string; aEteInvite: boolean | null;
  parQui: string; baptemeEau: boolean | null; interetFormation: boolean | null;
  interetCDM: boolean | null; interetBapteme: boolean | null; commentaire: string;
}

export function emptyInvite(now = new Date()): InviteFormData {
  return {
    civility: "M.", firstName: "", lastName: "", age: "26-30 ans", phone: "", email: "",
    pays: "Belgique", address: "",
    arrivalDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    event: "Culte", aps: null, localChurch: null, autreEglise: "", aEteInvite: null,
    parQui: "", baptemeEau: null, interetFormation: null, interetCDM: null, interetBapteme: null, commentaire: "",
  };
}

export type FormField = keyof InviteFormData | "church";
export type FormIssue = { field: FormField; message: "requiredError" | "answerError" | "emailError" };

export function validateInvite(data: InviteFormData, churchId: string): FormIssue | null {
  if (!churchId) return { field: "church", message: "requiredError" };
  for (const field of ["arrivalDate", "event", "civility", "firstName", "lastName", "phone", "pays"] as const) {
    if (!data[field].trim()) return { field, message: "requiredError" };
  }
  if (data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) return { field: "email", message: "emailError" };
  if (data.aEteInvite === null) return { field: "aEteInvite", message: "answerError" };
  if (data.aps === null) return { field: "aps", message: "answerError" };
  if (data.localChurch === null) return { field: "localChurch", message: "answerError" };
  if (data.localChurch && !data.autreEglise.trim()) return { field: "autreEglise", message: "requiredError" };
  for (const field of ["baptemeEau", "interetFormation", "interetCDM"] as const) {
    if (data[field] === null) return { field, message: "answerError" };
  }
  if (data.baptemeEau === false && data.interetBapteme === null) return { field: "interetBapteme", message: "answerError" };
  return null;
}

export function invitePayload(data: InviteFormData, churchId: string) {
  return {
    civility: data.civility, first_name: data.firstName.trim(), last_name: data.lastName.trim(),
    age: data.age, phone: data.phone.trim(), email: data.email.trim() || null,
    address: data.address.trim() || null, pays: data.pays || "Belgique", arrival_date: data.arrivalDate,
    event: data.event, aps: data.aps === true, local_church: data.localChurch === true,
    autre_eglise: data.localChurch ? data.autreEglise.trim() || null : null,
    a_ete_invite: data.aEteInvite === true, par_qui: data.aEteInvite ? data.parQui.trim() : null,
    bapteme_eau: data.baptemeEau === true, interet_formation: data.interetFormation === true,
    interet_cdm: data.interetCDM === true, interet_bapteme: data.baptemeEau === false && data.interetBapteme === true,
    commentaire: data.commentaire.trim() || null, church_id: churchId,
    bergerie_id: null, responsible: "Non assigné", assigned_to: null, created_by: null,
  };
}

export function nextInvite(previous: InviteFormData, family: boolean): InviteFormData {
  const next = { ...emptyInvite(), arrivalDate: previous.arrivalDate, event: previous.event };
  return family ? {
    ...next, lastName: previous.lastName, pays: previous.pays, address: previous.address,
    aEteInvite: previous.aEteInvite, parQui: previous.parQui,
  } : next;
}
