/*
  Created by: Akash Saranathan
  Created on: 04/12/2026
  Modified on: 04/27/2026
  Purpose: Main React UI — chat, image upload, knowledge-base uploads (PDF, Word, text, etc.), mic (speech-to-text), read-aloud.
  How to run: Install deps (React, Axios), run the backend, then start the Vite dev server or use the built dist.
*/

import { useState, useEffect, useRef } from "react";
import axios from "axios";

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState("");

  const API_URL = import.meta.env.VITE_API_URL || "";

  const mapApiMessages = (rows) =>
    (rows || []).map((m) => ({
      role: m.role === "assistant" ? "bot" : "user",
      content: m.content,
      fileName: m.file_name || undefined,
    }));

  const loadSessionMessages = async (id) => {
    if (!id) return;
    try {
      const r = await axios.get(`${API_URL}/api/sessions/${id}/messages`);
      setMessages(mapApiMessages(r.data.messages));
    } catch {
      setMessages([]);
    }
  };

  const refreshSessions = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/sessions`);
      setSessions(r.data.sessions || []);
    } catch {
      setSessions([]);
    }
  };

  useEffect(() => {
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.body.style.overflow = "hidden";
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSessionsLoading(true);
      try {
        const listRes = await axios.get(`${API_URL}/api/sessions`);
        if (cancelled) return;
        const list = listRes.data.sessions || [];
        setSessions(list);
        if (list.length > 0) {
          const id = list[0].id;
          setSessionId(id);
          await loadSessionMessages(id);
        } else {
          const cr = await axios.post(`${API_URL}/api/sessions`, {});
          if (cancelled) return;
          const row = cr.data.session;
          setSessionId(row.id);
          setSessions([row]);
          setMessages([]);
        }
      } catch {
        if (!cancelled) {
          setSessions([]);
          setSessionId(null);
          setMessages([]);
        }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const speakText = (text) => {
    if (!text?.trim() || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    window.speechSynthesis.speak(u);
  };

  const toggleVoiceInput = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceHint("Voice typing needs Chrome or Edge (speech recognition is not available in this browser).");
      return;
    }
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setVoiceHint(
        "Voice needs a secure context. Use https://, or http://localhost / http://127.0.0.1 — not http://192.168.x.x (browsers block the mic there)."
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceHint("This browser does not expose the microphone API.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setVoiceHint(
          "Microphone blocked: click the lock or tune icon in the address bar → Site settings → Microphone → Allow, then reload and try again."
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setVoiceHint("No microphone was found. Plug in a mic or enable the built-in mic.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setVoiceHint("Microphone is in use by another app. Close other apps using the mic and try again.");
      } else {
        setVoiceHint(err?.message || "Could not access the microphone.");
      }
      return;
    }

    setVoiceHint("");
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const text = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join("");
      setInput((prev) => (prev ? `${prev} ${text}` : text).trim());
    };
    rec.onerror = (e) => {
      const code = e.error;
      if (code === "not-allowed") {
        setVoiceHint(
          "Speech recognition was denied. Allow microphone for this site (address bar → lock → Permissions)."
        );
      } else if (code === "no-speech") {
        setVoiceHint("No speech detected — wait for the mic to turn red, then speak clearly.");
      } else if (code === "audio-capture") {
        setVoiceHint("No microphone input — check the mic and system privacy settings.");
      } else if (code === "network") {
        setVoiceHint("Speech service network error — check your internet connection.");
      } else if (code !== "aborted") {
        setVoiceHint(`Voice error: ${code || "unknown"}`);
      }
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      setListening(false);
    };
    rec.onend = () => {
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      setListening(false);
    };
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      try {
        stream?.getTracks().forEach((t) => t.stop());
      } catch {
        /* ignore */
      }
      setVoiceHint(err?.message || "Could not start voice recognition.");
      setListening(false);
    }
  };

  const handleNewChat = async () => {
    setMessages([]);
    setFile(null);
    setInput("");
    setVoiceHint("");
    try {
      const r = await axios.post(`${API_URL}/api/sessions`, {});
      const row = r.data.session;
      setSessionId(row.id);
      setSessions((prev) => [row, ...prev.filter((s) => s.id !== row.id)]);
    } catch {
      /* ignore */
    }
  };

  const selectSession = async (id) => {
    if (id === sessionId) return;
    setSessionId(id);
    setFile(null);
    setInput("");
    await loadSessionMessages(id);
  };

  const deleteSession = async (e, id) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API_URL}/api/sessions/${id}`);
      await refreshSessions();
      if (sessionId === id) {
        const r = await axios.post(`${API_URL}/api/sessions`, {});
        const row = r.data.session;
        setSessionId(row.id);
        setSessions((prev) => [row, ...prev.filter((s) => s.id !== row.id)]);
        setMessages([]);
      }
    } catch {
      /* ignore */
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && !file) return;
    if (!sessionId) return;

    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);

    const userMessage = { role: "user", content: input, fileName: file?.name };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    const currentInput = input;
    const currentFile = file;
    setInput("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    const formData = new FormData();
    formData.append("query", currentInput);
    formData.append("session_id", sessionId);
    if (currentFile) formData.append("file", currentFile);

    try {
      const res = await axios.post(`${API_URL}/multimodal-agent`, formData);
      setMessages([...updatedMessages, { role: "bot", content: res.data.response }]);
      await refreshSessions();
    } catch (err) {
      setMessages([...updatedMessages, { role: "bot", content: "System error: Unable to process request." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.appWrapper}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={{ padding: "20px 15px" }}>
          <button style={styles.newChatBtn} onClick={handleNewChat}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span> New Chat
          </button>

          <div style={styles.historyContainer}>
            <div style={styles.navLabel}>Chats</div>
            {sessionsLoading ? (
              <div style={styles.sessionHint}>Loading…</div>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => selectSession(s.id)}
                  onKeyDown={(e) => e.key === "Enter" && selectSession(s.id)}
                  style={{
                    ...styles.sessionItem,
                    ...(s.id === sessionId ? styles.sessionItemActive : {}),
                  }}
                >
                  <span style={styles.sessionTitle}>
                    {s.title?.length > 32 ? s.title.substring(0, 32) + "…" : s.title || "Chat"}
                  </span>
                  <button
                    type="button"
                    style={styles.sessionDelete}
                    title="Delete chat"
                    onClick={(e) => deleteSession(e, s.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={styles.sidebarBottom}>
          <div style={styles.bottomLink}>Settings</div>
        </div>
      </aside>

      {/* Main Panel */}
      <main style={styles.mainPanel}>
        <header style={styles.header}>
          <div style={styles.brandTitle}>
            AI Assistant <span style={styles.vTag}>v3.0</span>
          </div>
        </header>

        {/* Messages Area */}
        <div style={styles.scrollArea} ref={scrollRef}>
          <div style={styles.messageList}>
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                <h1 style={styles.emptyHeading}>How can I help you today?</h1>
                <p style={styles.emptySubtext}>Upload a file, type, or use the mic to speak your question.</p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    ...styles.messageRow,
                    flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  }}
                >
                  <div
                    style={{
                      ...styles.avatar,
                      backgroundColor: msg.role === "user" ? "#1a1a1a" : "#3b82f6",
                    }}
                  >
                    {msg.role === "user" ? "U" : "AI"}
                  </div>

                  <div
                    style={{
                      ...styles.bubbleWrapper,
                      alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div style={styles.senderRow}>
                      <div style={styles.senderLabel}>
                        {msg.role === "user" ? "You" : "Assistant"}
                      </div>
                      {msg.role === "bot" && msg.content ? (
                        <button
                          type="button"
                          title="Read answer aloud"
                          onClick={() => speakText(msg.content)}
                          style={styles.speakBtn}
                        >
                          🔊
                        </button>
                      ) : null}
                    </div>
                    <div
                      style={{
                        ...styles.bubble,
                        backgroundColor: msg.role === "user" ? "#1a1a1a" : "#f3f4f6",
                        color: msg.role === "user" ? "#fff" : "#1a1a1a",
                        borderRadius:
                          msg.role === "user"
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                      }}
                    >
                      {msg.fileName && (
                        <div
                          style={{
                            ...styles.fileBox,
                            backgroundColor:
                              msg.role === "user"
                                ? "rgba(255,255,255,0.15)"
                                : "#e5e7eb",
                            borderColor:
                              msg.role === "user"
                                ? "rgba(255,255,255,0.2)"
                                : "#d1d5db",
                            color: msg.role === "user" ? "#fff" : "#374151",
                          }}
                        >
                          📎 {msg.fileName}
                        </div>
                      )}
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div style={styles.typingRow}>
                <div style={{ ...styles.avatar, backgroundColor: "#3b82f6" }}>AI</div>
                <div style={styles.typingBubble}>
                  <span style={styles.dot} />
                  <span style={{ ...styles.dot, animationDelay: "0.2s" }} />
                  <span style={{ ...styles.dot, animationDelay: "0.4s" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Bar */}
        <footer style={styles.footer}>
          <div style={styles.inputBox}>
            <label style={styles.attachBtn} title="Attach file">
              <input
                type="file"
                hidden
                ref={fileInputRef}
                accept="image/*,.pdf,.txt,.md,.docx,.csv,.json,.html,.htm,.rst,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/csv,text/html,application/json"
                onChange={(e) => setFile(e.target.files[0])}
              />
              {file ? "✅" : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              )}
            </label>
            <button
              type="button"
              style={{
                ...styles.micBtn,
                color: listening ? "#dc2626" : "#888",
              }}
              title={listening ? "Stop listening" : "Speak your question (voice to text)"}
              onClick={toggleVoiceInput}
              aria-pressed={listening}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <textarea
              style={styles.textArea}
              rows="1"
              placeholder="Type or tap the mic…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())
              }
            />
            <button
              style={{
                ...styles.sendBtn,
                backgroundColor: input.trim() || file ? "#1a1a1a" : "#e0e0e0",
                cursor: input.trim() || file ? "pointer" : "default",
              }}
              onClick={sendMessage}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </button>
          </div>
          {voiceHint ? <div style={styles.voiceHint}>{voiceHint}</div> : null}
          <div style={styles.copyText}>Custom Multimodal Engine</div>
        </footer>
      </main>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const styles = {
  appWrapper: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    backgroundColor: "#fff",
    position: "fixed",
    top: 0,
    left: 0,
  },

  sidebar: {
    width: "260px",
    backgroundColor: "#f9f9f9",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #eee",
    justifyContent: "space-between",
    flexShrink: 0,
  },

  newChatBtn: {
    width: "100%",
    padding: "10px 15px",
    borderRadius: "10px",
    border: "1px solid #e0e0e0",
    backgroundColor: "#fff",
    cursor: "pointer",
    fontWeight: "600",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "14px",
  },

  historyContainer: { marginTop: "30px" },
  navLabel: {
    fontSize: "11px",
    color: "#999",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "15px",
    paddingLeft: "5px",
  },
  historyItemActive: {
    padding: "10px",
    backgroundColor: "#ececec",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#444",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  sessionHint: { fontSize: "13px", color: "#999", padding: "6px 5px" },
  sessionItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    padding: "10px 8px",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#444",
    cursor: "pointer",
    marginBottom: "4px",
    border: "1px solid transparent",
  },
  sessionItemActive: {
    backgroundColor: "#e8f0fe",
    borderColor: "#c7d7f6",
  },
  sessionTitle: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sessionDelete: {
    border: "none",
    background: "transparent",
    color: "#999",
    cursor: "pointer",
    fontSize: "18px",
    lineHeight: 1,
    padding: "0 4px",
    flexShrink: 0,
  },

  sidebarBottom: { padding: "20px", borderTop: "1px solid #eee" },
  bottomLink: { fontSize: "14px", color: "#666", cursor: "pointer" },

  mainPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    height: "100%",
    backgroundColor: "#fff",
  },

  header: { padding: "18px 30px", borderBottom: "1px solid #f0f0f0" },
  brandTitle: { fontSize: "18px", fontWeight: "700", color: "#111" },
  vTag: { color: "#3b82f6", fontSize: "12px", fontWeight: "500" },

  scrollArea: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },

  messageList: {
    width: "100%",
    maxWidth: "820px",
    margin: "0 auto",
    padding: "32px 24px",
    boxSizing: "border-box",
    flexGrow: 1,
  },

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    minHeight: "300px",
    textAlign: "center",
  },
  emptyHeading: { fontSize: "26px", fontWeight: "600", color: "#1a1a1a", margin: "0 0 8px" },
  emptySubtext: { color: "#888", fontSize: "15px", margin: 0 },

  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    marginBottom: "24px",
  },

  avatar: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "11px",
    fontWeight: "700",
    flexShrink: 0,
  },

  bubbleWrapper: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "72%",
  },

  senderLabel: {
    fontWeight: "600",
    fontSize: "11px",
    color: "#aaa",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  senderRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "4px",
  },

  speakBtn: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: "14px",
    padding: "0 4px",
    lineHeight: 1,
    opacity: 0.85,
  },

  micBtn: {
    cursor: "pointer",
    marginRight: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "transparent",
    padding: "4px",
    flexShrink: 0,
  },

  voiceHint: {
    fontSize: "12px",
    color: "#b91c1c",
    marginTop: "6px",
    textAlign: "center",
  },

  bubble: {
    padding: "12px 16px",
    fontSize: "15px",
    lineHeight: "1.6",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },

  fileBox: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    marginBottom: "8px",
    border: "1px solid",
  },

  typingRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "10px",
    marginBottom: "24px",
  },

  typingBubble: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    backgroundColor: "#f3f4f6",
    padding: "12px 16px",
    borderRadius: "18px 18px 18px 4px",
  },

  dot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#999",
    animation: "bounce 1.2s infinite ease-in-out",
  },

  footer: {
    padding: "12px 24px 24px",
    backgroundColor: "#fff",
    borderTop: "1px solid #f0f0f0",
    maxWidth: "820px",
    width: "100%",
    alignSelf: "center",
    boxSizing: "border-box",
  },

  inputBox: {
    width: "100%",
    backgroundColor: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: "14px",
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    boxSizing: "border-box",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
  },

  textArea: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: "15px",
    background: "transparent",
    resize: "none",
    fontFamily: "inherit",
    lineHeight: "1.5",
    color: "#1a1a1a",
  },

  attachBtn: {
    cursor: "pointer",
    marginRight: "10px",
    color: "#888",
    display: "flex",
    alignItems: "center",
  },

  sendBtn: {
    width: "34px",
    height: "34px",
    borderRadius: "8px",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background-color 0.15s",
    flexShrink: 0,
  },

  copyText: {
    fontSize: "11px",
    color: "#ccc",
    marginTop: "8px",
    textAlign: "center",
  },
};

export default App;