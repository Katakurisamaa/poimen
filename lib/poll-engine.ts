import type { PollCommand, PollDraft, PollSnapshot, PollState, StoredPoll } from "@/types/visio-poll";

export class PollError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new PollError(message);
}
function text(value: unknown, max: number) {
  check(typeof value === "string" && value.trim().length <= max, `Texte invalide (maximum ${max} caractères).`);
  return value.trim();
}
export function validateDraft(value: PollDraft): PollDraft {
  check(value && ["poll", "quiz", "open"].includes(value.type), "Type de question invalide.");
  const question = text(value.question, 300);
  check(question, "Renseignez la question.");
  const options = value.type === "open" ? [] : value.options;
  check(Array.isArray(options) && (value.type === "open" || (options.length >= 2 && options.length <= 8)), "Prévoyez entre 2 et 8 réponses.");
  const cleaned = options.map(option => {
    check(option && typeof option === "object", "Réponse invalide.");
    return { id: text(option.id, 80), text: text(option.text, 160) };
  });
  check(cleaned.every(option => option.id && option.text), "Complétez chaque réponse.");
  check(new Set(cleaned.map(option => option.id)).size === cleaned.length, "Identifiants de réponses invalides.");
  check(new Set(cleaned.map(option => option.text.toLocaleLowerCase("fr"))).size === cleaned.length, "Les réponses doivent être différentes.");
  if (value.type === "quiz") check(cleaned.some(option => option.id === value.correctOptionId), "Choisissez la bonne réponse.");
  check([0, 30, 60, 120, 300, 600].includes(value.durationSeconds), "Durée invalide.");
  return { type: value.type, question, options: cleaned, correctOptionId: value.type === "quiz" ? value.correctOptionId : undefined, explanation: value.type === "quiz" ? text(value.explanation || "", 1000) : "", durationSeconds: value.durationSeconds };
}
export function effectiveStatus(poll: StoredPoll, now: number): StoredPoll["status"] {
  return poll.status === "open" && poll.closesAt && now >= poll.closesAt ? "closed" : poll.status;
}

/** Pure transition, committed by the API using a compare-and-swap version check. */
export function transition(state: PollState, command: PollCommand, actor: { voterId: string; canManage: boolean }, now: number, newId: string): PollState {
  check(command && typeof command.action === "string", "Action invalide.");
  if (command.action !== "vote" && !actor.canManage) throw new PollError("Seul l’animateur peut modifier les questions.", 403);
  const next: PollState = structuredClone(state);
  if (command.action === "save") {
    const draft = validateDraft(command.draft);
    const existing = next.polls.find(poll => poll.id === command.draft.id);
    if (command.draft.id) check(existing?.status === "draft", "Seuls les brouillons peuvent être modifiés.");
    if (existing) Object.assign(existing, draft);
    else {
      check(next.polls.length < 100, "Cette salle contient déjà 100 questions. Utilisez une nouvelle salle pour une nouvelle série.");
      next.polls.push({ ...draft, id: newId, status: "draft", createdAt: now, revealResults: false, revealAnswer: false, ballots: [] });
    }
    return next;
  }
  const poll = next.polls.find(item => item.id === command.pollId);
  check(poll, "Cette question n’existe plus.");
  poll.status = effectiveStatus(poll, now);
  switch (command.action) {
    case "vote": {
      // A retry after a lost HTTP response acknowledges the existing vote.
      if (poll.ballots.some(vote => vote.voterId === actor.voterId)) return next;
      check(poll.status === "open", "Les votes sont clôturés pour cette question.");
      check(poll.ballots.length < 2000, "La limite de participants de cette question est atteinte.");
      const name = text(command.name, 80) || "Participant";
      if (poll.type === "open") {
        const answer = text(command.text, 1000);
        check(answer, "Écrivez votre réponse.");
        poll.ballots.push({ voterId: actor.voterId, name, text: answer, at: now });
      } else {
        check(poll.options.some(option => option.id === command.optionId), "Cette réponse n’est pas proposée.");
        poll.ballots.push({ voterId: actor.voterId, name, optionId: command.optionId, at: now });
      }
      break;
    }
    case "launch":
    case "reopen":
      check(command.action === "launch" ? poll.status === "draft" : poll.status === "closed", "Cette question ne peut pas être ouverte dans cet état.");
      for (const other of next.polls) if (other.status === "open") other.status = "closed";
      poll.status = "open";
      poll.startedAt = now;
      poll.closesAt = poll.durationSeconds ? now + poll.durationSeconds * 1000 : undefined;
      break;
    case "close": check(poll.status === "open", "Les votes sont déjà clôturés."); poll.status = "closed"; break;
    case "results": check(poll.status !== "draft", "Lancez la question avant de publier ses résultats."); poll.revealResults = !poll.revealResults; break;
    case "answer": check(poll.type === "quiz" && poll.status === "closed", "Clôturez le quiz avant de révéler la bonne réponse."); poll.revealAnswer = !poll.revealAnswer; break;
    case "duplicate":
      check(next.polls.length < 100, "Limite de 100 questions atteinte.");
      next.polls.push({ ...poll, id: newId, createdAt: now, status: "draft", startedAt: undefined, closesAt: undefined, revealResults: false, revealAnswer: false, ballots: [] });
      break;
    case "remove": check(poll.status === "draft", "Seuls les brouillons peuvent être supprimés."); next.polls = next.polls.filter(item => item.id !== poll.id); break;
    default: throw new PollError("Action inconnue.");
  }
  return next;
}

export function snapshot(state: PollState, canManage: boolean, voterId: string, now: number): PollSnapshot {
  const published = state.polls.filter(poll => poll.status !== "draft");
  const current = published.find(poll => effectiveStatus(poll, now) === "open") ?? [...published].sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0))[0];
  const revealed = published.filter(poll => poll.type === "quiz" && poll.revealAnswer && effectiveStatus(poll, now) === "closed");
  const answered = revealed.filter(poll => poll.ballots.some(vote => vote.voterId === voterId));
  return {
    canManage, serverTime: now,
    score: { answered: answered.length, correct: answered.filter(poll => poll.ballots.some(vote => vote.voterId === voterId && vote.optionId === poll.correctOptionId)).length },
    polls: (canManage ? state.polls : current ? [current] : []).map(poll => {
      const showResults = canManage || poll.revealResults;
      const showAnswer = canManage || (poll.revealAnswer && effectiveStatus(poll, now) === "closed");
      const vote = poll.ballots.find(ballot => ballot.voterId === voterId);
      // Explicit allowlist: voter identities and hidden quiz solutions never leave the server.
      return {
        id: poll.id, type: poll.type, question: poll.question, options: poll.options,
        status: effectiveStatus(poll, now), createdAt: poll.createdAt, startedAt: poll.startedAt,
        closesAt: poll.closesAt, durationSeconds: poll.durationSeconds,
        revealResults: poll.revealResults, revealAnswer: poll.revealAnswer,
        correctOptionId: showAnswer ? poll.correctOptionId : undefined,
        explanation: showAnswer ? poll.explanation : "",
        totalVotes: poll.ballots.length,
        counts: showResults ? Object.fromEntries(poll.options.map(option => [option.id, poll.ballots.filter(ballot => ballot.optionId === option.id).length])) : undefined,
        answers: showResults ? poll.ballots.filter(ballot => ballot.text).map(ballot => ({ name: ballot.name, text: ballot.text! })) : undefined,
        myVote: vote ? { optionId: vote.optionId, text: vote.text } : undefined,
      };
    }),
  };
}

export function exportPollsCsv(data: PollSnapshot): string {
  const cell = (value: string | number) => {
    const raw = String(value);
    const safe = /^[=+\-@\t\r\n]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows: (string | number)[][] = [["Question", "Type", "État", "Date", "Réponse", "Votes", "Pourcentage", "Participant", "Bonne réponse", "Explication"]];
  for (const poll of data.polls.filter(item => item.status !== "draft")) {
    const prefix = [poll.question, poll.type, poll.status, new Date(poll.startedAt || poll.createdAt).toISOString()];
    if (poll.type === "open") {
      for (const answer of poll.answers || []) rows.push([...prefix, answer.text, "", "", answer.name, "", ""]);
      if (!poll.answers?.length) rows.push([...prefix, "Aucune réponse", 0, "", "", "", ""]);
    } else for (const option of poll.options) {
      const count = poll.counts?.[option.id] || 0;
      rows.push([...prefix, option.text, count, poll.totalVotes ? Math.round(count * 100 / poll.totalVotes) : 0, "", option.id === poll.correctOptionId ? "Oui" : "", poll.explanation]);
    }
  }
  return "\uFEFF" + rows.map(row => row.map(cell).join(";")).join("\r\n");
}
