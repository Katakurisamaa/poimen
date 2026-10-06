export type PollType = "poll" | "quiz" | "open";

export interface PollOption {
  id: string;
  text: string;
}

export interface OpenAnswer {
  id: string;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface LivePoll {
  id: string;
  roomName: string;
  createdAt: number;
  authorName: string;
  type: PollType;
  question: string;
  options: PollOption[];
  correctOptionId?: string;       // Utilisé pour les quizz
  explanation?: string;           // Explication facultative / référence
  isOpen: boolean;                // true = votes ouverts, false = votes verrouillés
  showResults: boolean;           // true = résultats visibles par tous
  showCorrectAnswer: boolean;     // true = bonne réponse affichée aux participants
  votes: Record<string, number>;  // optionId -> nombre de votes
  totalVotes: number;
  openAnswers: OpenAnswer[];
}
