"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function usePeopleView<T extends { id: string }>(people: T[]) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const update = (key: string, value?: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const filter = ["contact", "unassigned"].includes(params.get("view") || "") ? params.get("view") : null;
  return {
    selected: people.find(person => person.id === params.get("person")),
    requestedId: params.get("person"),
    openPerson: (id: string) => update("person", id), closePerson: () => update("person"),
    filter, clearFilter: () => update("view"),
    createRequested: params.get("new") === "1", acknowledgeCreate: () => update("new"),
  };
}
