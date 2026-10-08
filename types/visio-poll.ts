export type PollType = "poll" | "quiz" | "open";
export type PollOption = { id: string; text: string };
export type PollDraft = {
  id?: string; type: PollType; question: string; options: PollOption[];
  correctOptionId?: string; explanation: string; durationSeconds: number;
};
export type PollVote = { voterId: string; name: string; optionId?: string; text?: string; at: number };
/** Server storage only; use PollSnapshot for client responses. */
export type StoredPoll = PollDraft & {
  id: string; status: "draft" | "open" | "closed"; createdAt: number;
  startedAt?: number; closesAt?: number; revealResults: boolean; revealAnswer: boolean; ballots: PollVote[];
};
export type PollState = { polls: StoredPoll[] };
export type PollView = Omit<StoredPoll, "ballots"> & {
  totalVotes: number; counts?: Record<string, number>; answers?: { name: string; text: string }[];
  myVote?: { optionId?: string; text?: string };
};
export type PollSnapshot = { canManage: boolean; polls: PollView[]; serverTime: number; score: { correct: number; answered: number } };
export type PollCommand =
  | { action: "save"; draft: PollDraft }
  | { action: "launch" | "close" | "reopen" | "results" | "answer" | "duplicate" | "remove"; pollId: string }
  | { action: "vote"; pollId: string; optionId?: string; text?: string; name: string };
