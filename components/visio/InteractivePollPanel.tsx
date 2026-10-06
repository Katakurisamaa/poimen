"use client";

import { useEffect, useState, useRef } from "react";
import { 
  BarChart2, HelpCircle, MessageSquare, Plus, Trash2, Check, 
  Eye, Lock, Unlock, Award, Send, RefreshCw, X 
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LivePoll, PollOption, PollType, OpenAnswer } from "@/types/visio-poll";
import { useFeedback } from "@/components/experience/FeedbackProvider";
import styles from "./InteractivePollPanel.module.css";

interface InteractivePollPanelProps {
  roomName: string;
  isHost?: boolean;
  userName?: string;
  onClose?: () => void;
}

export default function InteractivePollPanel({
  roomName,
  isHost = true,
  userName = "Participant",
  onClose,
}: InteractivePollPanelProps) {
  const { notify } = useFeedback();

  // Current active poll state
  const [activePoll, setActivePoll] = useState<LivePoll | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`poimen_poll_${roomName}`);
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Host creation state
  const [isCreating, setIsCreating] = useState(false);
  const [formType, setFormType] = useState<PollType>("poll");
  const [formQuestion, setFormQuestion] = useState("");
  const [formOptions, setFormOptions] = useState<string[]>([
    "Option 1",
    "Option 2",
  ]);
  const [formCorrectIndex, setFormCorrectIndex] = useState<number>(0);
  const [formExplanation, setFormExplanation] = useState("");

  // Participant vote state
  const [userVotedOptionId, setUserVotedOptionId] = useState<string | null>(null);
  const [openAnswerInput, setOpenAnswerInput] = useState("");
  const [hasSubmittedOpen, setHasSubmittedOpen] = useState(false);

  const channelRef = useRef<any>(null);

  // Sync to localStorage if host
  useEffect(() => {
    if (typeof window !== "undefined" && isHost) {
      if (activePoll) {
        localStorage.setItem(`poimen_poll_${roomName}`, JSON.stringify(activePoll));
      } else {
        localStorage.removeItem(`poimen_poll_${roomName}`);
      }
    }
  }, [activePoll, roomName, isHost]);

  // Setup Supabase Realtime Broadcast Channel
  useEffect(() => {
    const channelName = `poimen-polls-${roomName}`;
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "POLL_STATE" }, ({ payload }) => {
        if (payload?.poll) {
          setActivePoll(payload.poll);
          // If a new poll was sent, reset voter state if poll ID changed
          if (payload.poll.id !== activePoll?.id) {
            setUserVotedOptionId(null);
            setHasSubmittedOpen(false);
            setOpenAnswerInput("");
          }
        } else if (payload?.poll === null) {
          setActivePoll(null);
          setUserVotedOptionId(null);
          setHasSubmittedOpen(false);
        }
      })
      .on("broadcast", { event: "VOTE_CAST" }, ({ payload }) => {
        if (!isHost) return;
        const { optionId, openAnswer } = payload || {};

        setActivePoll((prev) => {
          if (!prev || !prev.isOpen) return prev;

          let updatedVotes = { ...prev.votes };
          let updatedTotal = prev.totalVotes;
          let updatedOpen = prev.openAnswers ? [...prev.openAnswers] : [];

          if (optionId) {
            updatedVotes[optionId] = (updatedVotes[optionId] || 0) + 1;
            updatedTotal += 1;
          } else if (openAnswer) {
            updatedOpen.push(openAnswer);
          }

          const updated: LivePoll = {
            ...prev,
            votes: updatedVotes,
            totalVotes: updatedTotal,
            openAnswers: updatedOpen,
          };

          // Broadcast updated poll state to all participants
          channel.send({
            type: "broadcast",
            event: "POLL_STATE",
            payload: { poll: updated },
          });

          return updated;
        });
      })
      .on("broadcast", { event: "REQUEST_STATE" }, () => {
        if (isHost && activePoll) {
          channel.send({
            type: "broadcast",
            event: "POLL_STATE",
            payload: { poll: activePoll },
          });
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !isHost) {
          // Ask host for current poll state
          channel.send({
            type: "broadcast",
            event: "REQUEST_STATE",
            payload: {},
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [roomName, isHost, activePoll?.id]);

  // Broadcast poll update helper
  const broadcastPoll = (poll: LivePoll | null) => {
    setActivePoll(poll);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "POLL_STATE",
        payload: { poll },
      });
    }
  };

  // Host: Create and Launch Poll
  const handleLaunchPoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim()) {
      notify("Veuillez renseigner votre question.");
      return;
    }

    const cleanOptions: PollOption[] = formOptions
      .map((opt, i) => ({ id: `opt_${i + 1}`, text: opt.trim() }))
      .filter((opt) => Boolean(opt.text));

    if (formType !== "open" && cleanOptions.length < 2) {
      notify("Veuillez renseigner au moins 2 options.");
      return;
    }

    const newPoll: LivePoll = {
      id: `poll_${Date.now()}`,
      roomName,
      createdAt: Date.now(),
      authorName: userName,
      type: formType,
      question: formQuestion.trim(),
      options: cleanOptions,
      correctOptionId:
        formType === "quiz" ? cleanOptions[formCorrectIndex]?.id : undefined,
      explanation: formExplanation.trim() || undefined,
      isOpen: true,
      showResults: true,
      showCorrectAnswer: false,
      votes: {},
      totalVotes: 0,
      openAnswers: [],
    };

    broadcastPoll(newPoll);
    setIsCreating(false);
    setUserVotedOptionId(null);
    setHasSubmittedOpen(false);
    notify("Sondage lancé en direct auprès des participants !");
  };

  // Participant: Vote on option
  const handleVoteOption = (optionId: string) => {
    if (!activePoll || !activePoll.isOpen || userVotedOptionId) return;

    setUserVotedOptionId(optionId);

    if (isHost) {
      // Host votes directly on state
      setActivePoll((prev) => {
        if (!prev) return null;
        const updatedVotes = {
          ...prev.votes,
          [optionId]: (prev.votes[optionId] || 0) + 1,
        };
        const updated: LivePoll = {
          ...prev,
          votes: updatedVotes,
          totalVotes: prev.totalVotes + 1,
        };
        broadcastPoll(updated);
        return updated;
      });
    } else if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "VOTE_CAST",
        payload: { optionId, voterName: userName },
      });
    }
    notify("Votre réponse a été enregistrée !");
  };

  // Participant: Submit Open Answer
  const handleSendOpenAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePoll || !openAnswerInput.trim() || hasSubmittedOpen) return;

    const newAnswer: OpenAnswer = {
      id: `ans_${Date.now()}`,
      authorName: userName,
      text: openAnswerInput.trim(),
      createdAt: Date.now(),
    };

    setHasSubmittedOpen(true);

    if (isHost) {
      setActivePoll((prev) => {
        if (!prev) return null;
        const updated: LivePoll = {
          ...prev,
          openAnswers: [...prev.openAnswers, newAnswer],
        };
        broadcastPoll(updated);
        return updated;
      });
    } else if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "VOTE_CAST",
        payload: { openAnswer: newAnswer, voterName: userName },
      });
    }

    setOpenAnswerInput("");
    notify("Votre réflexion a été partagée !");
  };

  // Host: Toggle Vote Open / Closed
  const handleToggleOpen = () => {
    if (!activePoll) return;
    const updated: LivePoll = {
      ...activePoll,
      isOpen: !activePoll.isOpen,
    };
    broadcastPoll(updated);
    notify(updated.isOpen ? "Votes réouverts." : "Votes clôturés.");
  };

  // Host: Toggle Reveal Correct Answer (Quiz)
  const handleToggleCorrectAnswer = () => {
    if (!activePoll || activePoll.type !== "quiz") return;
    const updated: LivePoll = {
      ...activePoll,
      showCorrectAnswer: !activePoll.showCorrectAnswer,
    };
    broadcastPoll(updated);
    notify(
      updated.showCorrectAnswer
        ? "Bonne réponse révélée aux participants !"
        : "Bonne réponse masquée."
    );
  };

  // Host: Reset / Delete Poll
  const handleResetPoll = () => {
    broadcastPoll(null);
    setIsCreating(false);
    setUserVotedOptionId(null);
    notify("Session réinitialisée.");
  };

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <BarChart2 size={18} color="#d4af37" />
          <span>Interactions & Sondages</span>
          {activePoll && (
            <span
              className={`${styles.statusBadge} ${
                activePoll.isOpen ? styles.statusOpen : styles.statusClosed
              }`}
            >
              {activePoll.isOpen ? "En direct" : "Clôturé"}
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            className={styles.btnAction}
            onClick={onClose}
            aria-label="Fermer le panneau"
          >
            <X size={16} />
          </button>
        )}
      </header>

      <div className={styles.content}>
        {/* MODE CREATION (Pour le responsable) */}
        {isCreating ? (
          <form className={styles.form} onSubmit={handleLaunchPoll}>
            <div className={styles.fieldGroup}>
              <span className={styles.label}>Type d'interaction :</span>
              <div className={styles.typeSelector}>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${
                    formType === "poll" ? styles.typeBtnActive : ""
                  }`}
                  onClick={() => setFormType("poll")}
                >
                  <BarChart2 size={14} /> Sondage
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${
                    formType === "quiz" ? styles.typeBtnActive : ""
                  }`}
                  onClick={() => setFormType("quiz")}
                >
                  <HelpCircle size={14} /> Quizz
                </button>
                <button
                  type="button"
                  className={`${styles.typeBtn} ${
                    formType === "open" ? styles.typeBtnActive : ""
                  }`}
                  onClick={() => setFormType("open")}
                >
                  <MessageSquare size={14} /> Question libre
                </button>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="poll-question-input">
                Votre question :
              </label>
              <textarea
                id="poll-question-input"
                className={styles.textarea}
                rows={2}
                placeholder={
                  formType === "quiz"
                    ? "Ex: Quel est le 1er livre du Nouveau Testament ?"
                    : formType === "open"
                    ? "Ex: Quel verset ou pensée retenez-vous du culte de dimanche ?"
                    : "Ex: Êtes-vous disponible ce samedi pour le service d'accueil ?"
                }
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                required
                autoFocus
              />
            </div>

            {formType !== "open" && (
              <div className={styles.fieldGroup}>
                <span className={styles.label}>
                  Options de réponse{" "}
                  {formType === "quiz" && "(Cochez la bonne réponse)"} :
                </span>
                <div className={styles.optionsList}>
                  {formOptions.map((opt, idx) => (
                    <div key={idx} className={styles.optionRow}>
                      {formType === "quiz" && (
                        <button
                          type="button"
                          className={`${styles.correctCheckBtn} ${
                            formCorrectIndex === idx
                              ? styles.correctCheckBtnActive
                              : ""
                          }`}
                          onClick={() => setFormCorrectIndex(idx)}
                          title={
                            formCorrectIndex === idx
                              ? "Bonne réponse"
                              : "Cocher comme bonne réponse"
                          }
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <input
                        type="text"
                        className={styles.input}
                        placeholder={`Option ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const updated = [...formOptions];
                          updated[idx] = e.target.value;
                          setFormOptions(updated);
                        }}
                        required
                      />
                      {formOptions.length > 2 && (
                        <button
                          type="button"
                          className={styles.removeOptionBtn}
                          onClick={() => {
                            const updated = formOptions.filter((_, i) => i !== idx);
                            setFormOptions(updated);
                            if (formCorrectIndex >= updated.length) {
                              setFormCorrectIndex(0);
                            }
                          }}
                          title="Supprimer l'option"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className={styles.btnAddOption}
                  onClick={() => setFormOptions([...formOptions, `Option ${formOptions.length + 1}`])}
                >
                  <Plus size={14} /> Ajouter une option
                </button>
              </div>
            )}

            {formType === "quiz" && (
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="quiz-explanation-input">
                  Explication ou référence biblique (facultatif) :
                </label>
                <input
                  id="quiz-explanation-input"
                  type="text"
                  className={styles.input}
                  placeholder="Ex: Évangile de Matthieu, chapitre 1"
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                />
              </div>
            )}

            <div className={styles.toolbar}>
              <button type="submit" className={`${styles.btnAction} ${styles.btnPrimary}`}>
                Lancer en direct
              </button>
              <button
                type="button"
                className={styles.btnAction}
                onClick={() => setIsCreating(false)}
              >
                Annuler
              </button>
            </div>
          </form>
        ) : activePoll ? (
          /* SONDAGE ACTIF */
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className={styles.pollQuestionBox}>
              <h4 className={styles.pollQuestionText}>{activePoll.question}</h4>
              <div className={styles.pollMeta}>
                <span>
                  {activePoll.type === "quiz"
                    ? "Quizz"
                    : activePoll.type === "open"
                    ? "Question ouverte"
                    : "Sondage"}
                </span>
                <span>•</span>
                <span>
                  {activePoll.type === "open"
                    ? `${activePoll.openAnswers.length} réponse${
                        activePoll.openAnswers.length > 1 ? "s" : ""
                      }`
                    : `${activePoll.totalVotes} vote${
                        activePoll.totalVotes > 1 ? "s" : ""
                      }`}
                </span>
              </div>
            </div>

            {/* VOTE CHOIX (Poll & Quiz) */}
            {activePoll.type !== "open" ? (
              <div className={styles.votingOptions}>
                {activePoll.options.map((opt) => {
                  const count = activePoll.votes[opt.id] || 0;
                  const percent =
                    activePoll.totalVotes > 0
                      ? Math.round((count / activePoll.totalVotes) * 100)
                      : 0;

                  const isSelected = userVotedOptionId === opt.id;
                  const isCorrect =
                    activePoll.showCorrectAnswer &&
                    activePoll.correctOptionId === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`${styles.voteOptionBtn} ${
                        isSelected ? styles.voteOptionSelected : ""
                      } ${isCorrect ? styles.correctResult : ""}`}
                      onClick={() => handleVoteOption(opt.id)}
                      disabled={!activePoll.isOpen || Boolean(userVotedOptionId)}
                    >
                      <div
                        className={`${styles.progressBar} ${
                          isCorrect ? styles.correctProgressBar : ""
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                      <span className={styles.optionLabel}>
                        {isCorrect && <Check size={16} color="#10b981" />}
                        {opt.text}
                      </span>
                      <span className={styles.optionCount}>
                        {percent}% ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* REPONSES OUVERTES */
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {activePoll.isOpen && !hasSubmittedOpen && (
                  <form onSubmit={handleSendOpenAnswer} style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Votre réponse ou témoignage..."
                      value={openAnswerInput}
                      onChange={(e) => setOpenAnswerInput(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className={`${styles.btnAction} ${styles.btnPrimary}`}
                    >
                      <Send size={15} />
                    </button>
                  </form>
                )}

                {hasSubmittedOpen && (
                  <p style={{ fontSize: 13, color: "#10b981", margin: 0 }}>
                    ✓ Votre réponse a été envoyée avec succès.
                  </p>
                )}

                <div className={styles.openResponsesList}>
                  {activePoll.openAnswers.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--ux-muted)" }}>
                      Aucune réponse partagée pour le moment.
                    </p>
                  ) : (
                    activePoll.openAnswers.map((ans) => (
                      <div key={ans.id} className={styles.openCard}>
                        <span className={styles.openCardAuthor}>{ans.authorName}</span>
                        <p className={styles.openCardText}>{ans.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* EXPLICATION DU QUIZZ SI REVELEE */}
            {activePoll.showCorrectAnswer && activePoll.explanation && (
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  fontSize: 13,
                  color: "#e2e8f0",
                }}
              >
                <strong style={{ color: "#10b981" }}>Explication : </strong>
                {activePoll.explanation}
              </div>
            )}

            {/* ACTIONS DU RESPONSABLE (HOST) */}
            {isHost && (
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.btnAction}
                  onClick={handleToggleOpen}
                >
                  {activePoll.isOpen ? <Lock size={14} /> : <Unlock size={14} />}
                  <span>{activePoll.isOpen ? "Clôturer les votes" : "Rouvrir les votes"}</span>
                </button>

                {activePoll.type === "quiz" && (
                  <button
                    type="button"
                    className={`${styles.btnAction} ${styles.btnPrimary}`}
                    onClick={handleToggleCorrectAnswer}
                  >
                    <Award size={14} />
                    <span>
                      {activePoll.showCorrectAnswer
                        ? "Masquer la bonne réponse"
                        : "Révéler la bonne réponse"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className={styles.btnAction}
                  onClick={() => setIsCreating(true)}
                >
                  <Plus size={14} /> Nouvelle question
                </button>

                <button
                  type="button"
                  className={`${styles.btnAction} ${styles.btnDanger}`}
                  onClick={handleResetPoll}
                >
                  <RefreshCw size={14} /> Réinitialiser
                </button>
              </div>
            )}
          </div>
        ) : (
          /* AUCUN SONDAGE EN COURS */
          <div className={styles.emptyState}>
            <BarChart2 size={36} color="var(--ux-muted)" />
            <h4>Aucune interaction en cours</h4>
            <p>
              {isHost
                ? "Créez votre propre sondage, quizz biblique ou question ouverte pour faire participer votre équipe."
                : "En attente d'une question lancée par l'animateur de la réunion..."}
            </p>
            {isHost && (
              <button
                type="button"
                className={`${styles.btnAction} ${styles.btnPrimary}`}
                onClick={() => setIsCreating(true)}
              >
                <Plus size={15} /> Rédiger une question
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
