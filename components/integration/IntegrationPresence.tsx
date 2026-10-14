"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Circle, Users } from "lucide-react";
import { listIntegrationPresenceMembers } from "@/app/actions/auth";
import { getActiveUserInfo } from "@/lib/client-session";
import { getSafeSession, supabase } from "@/lib/supabase";

type PresenceMember = { id: string; name: string; role: string };
type PresencePayload = { user_id?: string; name?: string; role?: string };
type ConnectionState = "connecting" | "connected" | "unavailable";

export default function IntegrationPresence() {
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const start = async () => {
      const session = await getSafeSession();
      const user = session?.user;
      const activeUser = getActiveUserInfo();
      let churchId = activeUser?.church_id;
      if (!churchId) {
        try {
          churchId = JSON.parse(localStorage.getItem("selected_church") || "null")?.id;
        } catch {
          churchId = null;
        }
      }
      if (!user?.id || !churchId || !mounted) {
        if (mounted) setConnection("unavailable");
        return;
      }

      const roster = await listIntegrationPresenceMembers(churchId);
      if (!mounted) return;
      const currentMember: PresenceMember = {
        id: user.id,
        name: activeUser?.firstName
          ? [activeUser.firstName, activeUser.lastName].filter(Boolean).join(" ")
          : activeUser?.display_name || user.email?.split("@")[0] || "Vous",
        role: activeUser?.role || "integration_conseiller"
      };
      const byId = new Map<string, PresenceMember>();
      for (const member of roster.members || []) byId.set(member.id, member);
      if (!byId.has(user.id)) byId.set(user.id, currentMember);
      setMembers([...byId.values()]);

      channel = supabase.channel(`integration-presence:${churchId}`, {
        config: { private: true, presence: { key: user.id } }
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!mounted || !channel) return;
          const state = channel.presenceState<PresencePayload>();
          const nextOnline = new Set<string>();
          const liveMembers: PresenceMember[] = [];
          for (const [key, presences] of Object.entries(state)) {
            const entry = presences[0];
            const id = entry?.user_id || key;
            nextOnline.add(id);
            if (!byId.has(id) && entry) {
              liveMembers.push({
                id,
                name: entry.name || "Membre de l’équipe",
                role: entry.role || "integration_conseiller"
              });
            }
          }
          setOnlineIds(nextOnline);
          if (liveMembers.length) {
            setMembers(current => {
              const knownIds = new Set(current.map(member => member.id));
              return [...current, ...liveMembers.filter(member => !knownIds.has(member.id))];
            });
          }
        })
        .subscribe(async status => {
          if (!mounted) return;
          if (status === "SUBSCRIBED") {
            setConnection("connected");
            const result = await channel?.track({
              user_id: user.id,
              name: byId.get(user.id)?.name || currentMember.name,
              role: byId.get(user.id)?.role || currentMember.role
            }) || { error: new Error("Canal indisponible") };
            if (typeof result === "object" && result !== null && "error" in result && result.error && mounted) setConnection("unavailable");
          } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
            setConnection("unavailable");
            setOnlineIds(new Set());
          }
        });
    };

    void start().catch(() => {
      if (mounted) setConnection("unavailable");
    });

    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const onlineCount = useMemo(() => onlineIds.size, [onlineIds]);
  const statusText = connection === "connected"
    ? `${onlineCount} en ligne · ${members.length} membres`
    : connection === "connecting" ? "Connexion en cours…" : "Présence indisponible";
  const visibleMembers = (expanded ? members : members.filter(member => onlineIds.has(member.id)));

  return (
    <section aria-label="Présence de l’équipe Intégration" style={{
      margin: "0 0 22px",
      padding: "16px 18px",
      border: "1px solid var(--border)",
      borderRadius: 16,
      background: "var(--surface-solid)",
      boxShadow: "var(--shadow-card, 0 8px 24px rgba(0,0,0,.08))"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} aria-hidden="true" style={{ color: "var(--action-bg)" }} />
          <strong style={{ color: "var(--cream)", fontSize: 14, fontWeight: 600 }}>Équipe Intégration</strong>
          <span style={{ color: connection === "connected" ? "var(--green, #4ade80)" : "var(--muted)", fontSize: 12 }} aria-live="polite">
            {statusText}
          </span>
        </div>
        <button type="button" aria-expanded={expanded} aria-controls="integration-presence-members" onClick={() => setExpanded(value => !value)} style={{
          display: "inline-flex", alignItems: "center", gap: 5, border: 0,
          background: "transparent", color: "var(--muted)", cursor: "pointer",
          font: "inherit", fontSize: 11, padding: "4px 2px"
        }}>
          {expanded ? "Masquer" : "Voir l’équipe"}
          <ChevronDown size={14} aria-hidden="true" style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform 160ms ease" }} />
        </button>
      </div>
      {visibleMembers.length > 0 && (
        <div id="integration-presence-members" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {visibleMembers.map(member => {
              const isOnline = connection === "connected" && onlineIds.has(member.id);
              return (
                <span key={member.id} title={`${member.name} — ${isOnline ? "Connecté" : connection === "connected" ? "Hors ligne" : "Statut inconnu"}`} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 9px", borderRadius: 999,
                  background: "var(--bg-deep, rgba(255,255,255,.04))",
                  color: "var(--cream)", fontSize: 11, whiteSpace: "nowrap"
                }}>
                  <Circle size={8} fill={isOnline ? "#4ade80" : "transparent"} color={isOnline ? "#4ade80" : "var(--muted)"} aria-hidden="true" />
                  {member.name}
                </span>
              );
          })}
        </div>
      )}
    </section>
  );
}
