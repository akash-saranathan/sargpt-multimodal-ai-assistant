import { useState, useEffect, useRef } from "react";
import axios from "axios";

/* ─── design tokens ────────────────────────────────────────── */
const T = {
  bg:          "#0d0f14",
  bgPanel:     "#13161e",
  bgSurface:   "#1a1d28",
  bgHover:     "#21253a",
  bgInput:     "#181b26",
  border:      "rgba(255,255,255,0.07)",
  borderMid:   "rgba(255,255,255,0.12)",
  accent:      "#7c6af7",
  accentGlow:  "rgba(124,106,247,0.18)",
  accentDim:   "#4f46a8",
  teal:        "#2dd4bf",
  textPrimary: "#eeedf5",
  textSec:     "#8b8fa8",
  textMuted:   "#525670",
  userBubble:  "#1e2235",
  botBubble:   "#161926",
  danger:      "#f87171",
};

/* ─── global styles injected once ──────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Space+Grotesk:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${T.bg};
    color: ${T.textPrimary};
    font-family: 'DM Sans', sans-serif;
    overflow: hidden;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }

  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
    40%            { transform: translateY(-5px); opacity: 1; }
  }
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0 rgba(124,106,247,0.5); }
    70%  { box-shadow: 0 0 0 8px rgba(124,106,247,0); }
    100% { box-shadow: 0 0 0 0 rgba(124,106,247,0); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }

  .msg-enter { animation: fadeSlideUp 0.25s ease both; }

  .session-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 9px 10px;
    border-radius: 8px;
    font-size: 13px;
    color: ${T.textSec};
    cursor: pointer;
    margin-bottom: 2px;
    border: 1px solid transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .session-item:hover { background: ${T.bgHover}; color: ${T.textPrimary}; }
  .session-item.active {
    background: ${T.bgHover};
    border-color: ${T.border};
    color: ${T.textPrimary};
  }
  .session-delete {
    border: none; background: transparent;
    color: ${T.textMuted}; cursor: pointer;
    font-size: 16px; line-height: 1; padding: 2px 4px;
    border-radius: 4px; opacity: 0; transition: opacity 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .session-item:hover .session-delete { opacity: 1; }
  .session-delete:hover { color: ${T.danger}; }

  .new-chat-btn {
    width: 100%;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid ${T.borderMid};
    background: linear-gradient(135deg, ${T.bgSurface} 0%, ${T.bgHover} 100%);
    color: ${T.textPrimary};
    cursor: pointer;
    font-weight: 500;
    font-size: 13.5px;
    font-family: 'DM Sans', sans-serif;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: border-color 0.2s, background 0.2s;
  }
  .new-chat-btn:hover {
    border-color: ${T.accent};
    background: linear-gradient(135deg, ${T.bgHover} 0%, #2a2640 100%);
  }

  .send-btn {
    width: 36px; height: 36px;
    border-radius: 9px; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
    flex-shrink: 0;
  }
  .send-btn:hover { transform: scale(1.05); }
  .send-btn.active {
    background: linear-gradient(135deg, ${T.accent}, ${T.accentDim});
    box-shadow: 0 0 12px ${T.accentGlow};
  }
  .send-btn.inactive { background: ${T.bgHover}; cursor: default; }

  .icon-btn {
    cursor: pointer; background: transparent; border: none;
    color: ${T.textMuted}; display: flex; align-items: center;
    justify-content: center; padding: 6px; border-radius: 7px;
    transition: background 0.15s, color 0.15s;
  }
  .icon-btn:hover { background: ${T.bgHover}; color: ${T.textPrimary}; }
  .icon-btn.listening {
    color: ${T.danger};
    animation: pulse-ring 1.4s infinite;
  }

  .speak-btn {
    border: none; background: transparent;
    cursor: pointer; padding: 2px 4px;
    border-radius: 4px; opacity: 0.5;
    font-size: 13px; transition: opacity 0.15s;
  }
  .speak-btn:hover { opacity: 1; }

  .textarea-input {
    flex: 1; border: none; outline: none;
    font-size: 14.5px; background: transparent;
    resize: none; font-family: 'DM Sans', sans-serif;
    line-height: 1.55; color: ${T.textPrimary};
  }
  .textarea-input::placeholder { color: ${T.textMuted}; }

  .pill-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: ${T.accentGlow};
    border: 1px solid rgba(124,106,247,0.3);
    color: #a89ef5;
    font-size: 11px; font-weight: 500;
    padding: 3px 9px; border-radius: 20px;
    letter-spacing: 0.3px;
  }

  .shimmer-loading {
    background: linear-gradient(90deg,
      ${T.bgSurface} 25%,
      ${T.bgHover} 50%,
      ${T.bgSurface} 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 6px; height: 10px;
  }
`;

const App = () => {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [file, setFile]                 = useState(null);
  const [loading, setLoading]           = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessions, setSessions]         = useState([]);
  const [sessionId, setSessionId]       = useState(null);
  const [listening, setListening]       = useState(false);
  const [voiceHint, setVoiceHint]       = useState("");
  const [sidebarOpen, setSidebarOpen]   = useState(true);

  const scrollRef       = useRef(null);
  const fileInputRef    = useRef(null);
  const recognitionRef  = useRef(null);
  const textareaRef     = useRef(null);

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
    } catch { setMessages([]); }
  };

  const refreshSessions = async () => {
    try {
      const r = await axios.get(`${API_URL}/api/sessions`);
      setSessions(r.data.sessions || []);
    } catch { setSessions([]); }
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = GLOBAL_CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
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
          setSessionId(list[0].id);
          await loadSessionMessages(list[0].id);
        } else {
          const cr = await axios.post(`${API_URL}/api/sessions`, {});
          if (cancelled) return;
          const row = cr.data.session;
          setSessionId(row.id);
          setSessions([row]);
          setMessages([]);
        }
      } catch {
        if (!cancelled) { setSessions([]); setSessionId(null); setMessages([]); }
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} }, []);

  /* auto-grow textarea */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
  };

  const speakText = (text) => {
    if (!text?.trim() || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  };

  const toggleVoiceInput = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceHint("Voice needs Chrome or Edge."); return; }
    if (listening) {
      try { recognitionRef.current?.stop(); } catch {}
      setListening(false); return;
    }
    if (!window.isSecureContext) { setVoiceHint("Voice needs HTTPS or localhost."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setVoiceHint("Microphone API not available."); return; }

    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (err) {
      const n = err?.name || "";
      if (n === "NotAllowedError" || n === "PermissionDeniedError")
        setVoiceHint("Mic blocked — allow in browser settings, then reload.");
      else if (n === "NotFoundError") setVoiceHint("No microphone detected.");
      else setVoiceHint(err?.message || "Could not access microphone.");
      return;
    }

    setVoiceHint("");
    const rec = new SR();
    rec.lang = "en-US"; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (ev) => {
      const text = Array.from(ev.results).map((r) => r[0].transcript).join("");
      setInput((p) => (p ? `${p} ${text}` : text).trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") setVoiceHint("Mic permission denied.");
      else if (e.error === "no-speech") setVoiceHint("No speech detected — try again.");
      else if (e.error !== "aborted") setVoiceHint(`Voice error: ${e.error}`);
      stream?.getTracks().forEach((t) => t.stop());
      setListening(false);
    };
    rec.onend = () => { stream?.getTracks().forEach((t) => t.stop()); setListening(false); };
    recognitionRef.current = rec;
    try { rec.start(); setListening(true); }
    catch (err) {
      stream?.getTracks().forEach((t) => t.stop());
      setVoiceHint(err?.message || "Could not start voice recognition.");
      setListening(false);
    }
  };

  const handleNewChat = async () => {
    setMessages([]); setFile(null); setInput(""); setVoiceHint("");
    try {
      const r = await axios.post(`${API_URL}/api/sessions`, {});
      const row = r.data.session;
      setSessionId(row.id);
      setSessions((p) => [row, ...p.filter((s) => s.id !== row.id)]);
    } catch {}
  };

  const selectSession = async (id) => {
    if (id === sessionId) return;
    setSessionId(id); setFile(null); setInput("");
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
        setSessions((p) => [row, ...p.filter((s) => s.id !== row.id)]);
        setMessages([]);
      }
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() && !file) return;
    if (!sessionId) return;
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);

    const userMsg = { role: "user", content: input, fileName: file?.name };
    const updated = [...messages, userMsg];
    setMessages(updated);

    const currentInput = input;
    const currentFile  = file;
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setLoading(true);

    const fd = new FormData();
    fd.append("query", currentInput);
    fd.append("session_id", sessionId);
    if (currentFile) fd.append("file", currentFile);

    try {
      const res = await axios.post(`${API_URL}/multimodal-agent`, fd);
      setMessages([...updated, { role: "bot", content: res.data.response }]);
      await refreshSessions();
    } catch {
      setMessages([...updated, { role: "bot", content: "System error — unable to process request." }]);
    } finally {
      setLoading(false);
    }
  };

  /* ─── render ───────────────────────────────────────────────── */
  return (
    <div style={S.root}>

      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside style={S.sidebar}>
          {/* Logo area */}
          <div style={S.sideTop}>
            <div style={S.logoRow}>
              <div style={S.logoMark}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
              </div>
              <span style={S.logoText}>SAR <span style={S.logoDim}>AI</span></span>
            </div>

            <button className="new-chat-btn" onClick={handleNewChat}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New conversation
            </button>
          </div>

          {/* Sessions list */}
          <div style={S.sessionList}>
            <div style={S.sectionLabel}>Recent</div>
            {sessionsLoading ? (
              <div style={{ padding: "8px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
                {[70, 50, 85].map((w, i) => (
                  <div key={i} className="shimmer-loading" style={{ width: `${w}%` }} />
                ))}
              </div>
            ) : sessions.map((s) => (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                className={`session-item${s.id === sessionId ? " active" : ""}`}
                onClick={() => selectSession(s.id)}
                onKeyDown={(e) => e.key === "Enter" && selectSession(s.id)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.title?.length > 28 ? s.title.substring(0, 28) + "…" : s.title || "New chat"}
                </span>
                <button
                  type="button"
                  className="session-delete"
                  title="Delete"
                  onClick={(e) => deleteSession(e, s.id)}
                >×</button>
              </div>
            ))}
          </div>

          {/* Sidebar bottom */}
          <div style={S.sideBottom}>
            <div style={S.bottomRow}>
              <div style={S.pill}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.teal, display: "inline-block" }} />
                System online
              </div>
              <div style={{ fontSize: 11, color: T.textMuted }}>v3.0</div>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main ── */}
      <main style={S.main}>

        {/* Header */}
        <header style={S.header}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="icon-btn"
              onClick={() => setSidebarOpen((p) => !p)}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            {!sidebarOpen && <span style={S.logoText}>SAR <span style={S.logoDim}>AI</span></span>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pill-badge">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.teal, display: "inline-block" }} />
              SARGPT
            </span>
          </div>
        </header>

        {/* Messages */}
        <div style={S.scrollArea} ref={scrollRef}>
          <div style={S.msgList}>

            {messages.length === 0 ? (
              <div style={S.emptyState}>
                <div style={S.emptyIcon}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <h2 style={S.emptyH}>Welcome Back! How can I help today?</h2>
                <p style={S.emptySub}>Upload a doc, type, or use the mic.</p>
                <div style={S.chipRow}>
                {[
                  "Summarize this document: ", 
                  "Explain the concept of ", 
                  "Draft a response to ", 
                  "Analyze this data: "
                ].map((c) => (
                  <button 
                    key={c} 
                    style={S.chip} 
                    onClick={() => {
                      setInput(c);
                      // This makes the cursor instantly appear in the text box
                      textareaRef.current?.focus(); 
                    }}
                  >
                    {/* This keeps the button labels looking clean and normal */}
                    {c.trim().replace(/:$/, "")}
                  </button>
                ))}
              </div>
              </div>
            ) : messages.map((msg, i) => (
              <div
                key={i}
                className="msg-enter"
                style={{ ...S.msgRow, flexDirection: msg.role === "user" ? "row-reverse" : "row" }}
              >
                {/* Avatar */}
                <div style={{
                  ...S.avatar,
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, #2e3151, #3d4270)"
                    : `linear-gradient(135deg, ${T.accentDim}, ${T.accent})`,
                }}>
                  {msg.role === "user" ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                  )}
                </div>

                {/* Bubble */}
                <div style={{
                  ...S.bubbleWrap,
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                }}>
                  <div style={S.senderRow}>
                    <span style={S.senderLabel}>{msg.role === "user" ? "You" : "Assistant"}</span>
                    {msg.role === "bot" && msg.content && (
                      <button className="speak-btn" title="Read aloud" onClick={() => speakText(msg.content)}>🔊</button>
                    )}
                  </div>
                  <div style={{
                    ...S.bubble,
                    background: msg.role === "user" ? T.userBubble : T.botBubble,
                    borderColor: msg.role === "user" ? "rgba(124,106,247,0.2)" : T.border,
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  }}>
                    {msg.fileName && (
                      <div style={S.filePill}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        {msg.fileName}
                      </div>
                    )}
                    <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div style={{ ...S.msgRow, flexDirection: "row" }} className="msg-enter">
                <div style={{
                  ...S.avatar,
                  background: `linear-gradient(135deg, ${T.accentDim}, ${T.accent})`,
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </div>
                <div style={S.typingBubble}>
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} style={{ ...S.dot, animationDelay: `${d}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input footer */}
        <footer style={S.footer}>
          {file && (
            <div style={S.fileChip}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, color: T.textSec }}>
                {file.name}
              </span>
              <button
                style={{ border: "none", background: "transparent", color: T.textMuted, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}
                onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              >×</button>
            </div>
          )}

          <div style={S.inputBox}>
            {/* Attach */}
            <label className="icon-btn" title="Attach file" style={{ cursor: "pointer", marginRight: 2 }}>
              <input
                type="file"
                hidden
                ref={fileInputRef}
                accept="image/*,.pdf,.txt,.md,.docx,.csv,.json,.html,.htm,.rst"
                onChange={(e) => setFile(e.target.files[0])}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </label>

            {/* Mic */}
            <button
              className={`icon-btn${listening ? " listening" : ""}`}
              title={listening ? "Stop" : "Voice input"}
              onClick={toggleVoiceInput}
              aria-pressed={listening}
              style={{ marginRight: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </button>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: T.border, marginRight: 10, flexShrink: 0 }} />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              className="textarea-input"
              rows={1}
              placeholder="Ask anything…"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
            />

            {/* Send */}
            <button
              className={`send-btn${input.trim() || file ? " active" : " inactive"}`}
              onClick={sendMessage}
              aria-label="Send message"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>

          {voiceHint && <div style={S.hint}>{voiceHint}</div>}
          <div style={S.footNote}>
            Built by Akash Saranathan · © 2026
          </div>
        </footer>
      </main>
    </div>
  );
};

/* ─── layout styles ─────────────────────────────────────────── */
const S = {
  root: {
    display: "flex",
    height: "100vh",
    width: "100vw",
    background: T.bg,
    position: "fixed",
    top: 0, left: 0,
    overflow: "hidden",
  },

  sidebar: {
    width: 252,
    background: T.bgPanel,
    borderRight: `1px solid ${T.border}`,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    overflow: "hidden",
  },

  sideTop: {
    padding: "20px 14px 16px",
    borderBottom: `1px solid ${T.border}`,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },

  logoMark: {
    width: 32, height: 32,
    borderRadius: 8,
    background: T.accentGlow,
    border: `1px solid rgba(124,106,247,0.3)`,
    display: "flex", alignItems: "center", justifyContent: "center",
  },

  logoText: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    color: T.textPrimary,
    letterSpacing: "0.5px",
  },

  logoDim: { color: T.textMuted, fontWeight: 400 },

  sessionList: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 10px",
  },

  sectionLabel: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
    marginBottom: 8,
    paddingLeft: 4,
  },

  sideBottom: {
    padding: "12px 14px",
    borderTop: `1px solid ${T.border}`,
  },

  bottomRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    color: T.teal,
    fontWeight: 500,
  },

  /* main */
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    height: "100%",
    background: T.bg,
  },

  header: {
    padding: "14px 22px",
    borderBottom: `1px solid ${T.border}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },

  scrollArea: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
  },

  msgList: {
    width: "100%",
    maxWidth: 800,
    margin: "0 auto",
    padding: "28px 22px",
    boxSizing: "border-box",
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
  },

  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "60px 20px",
    gap: 14,
  },

  emptyIcon: {
    width: 56, height: 56,
    borderRadius: 16,
    background: T.accentGlow,
    border: `1px solid rgba(124,106,247,0.25)`,
    display: "flex", alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },

  emptyH: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 22,
    fontWeight: 500,
    color: T.textPrimary,
  },

  emptySub: {
    fontSize: 14,
    color: T.textSec,
    maxWidth: 380,
    lineHeight: 1.6,
  },

  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
  },

  chip: {
    padding: "7px 14px",
    borderRadius: 20,
    border: `1px solid ${T.border}`,
    background: T.bgSurface,
    color: T.textSec,
    fontSize: 13,
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.15s, color 0.15s, background 0.15s",
  },

  msgRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: 10,
    marginBottom: 20,
  },

  avatar: {
    width: 30, height: 30,
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  bubbleWrap: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "73%",
  },

  senderRow: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginBottom: 5,
  },

  senderLabel: {
    fontSize: 10,
    color: T.textMuted,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },

  bubble: {
    padding: "11px 15px",
    fontSize: 14.5,
    lineHeight: 1.65,
    border: "1px solid",
    borderRadius: 16,
    color: T.textPrimary,
  },

  filePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(124,106,247,0.12)",
    border: "1px solid rgba(124,106,247,0.2)",
    color: "#a89ef5",
    borderRadius: 6,
    padding: "4px 9px",
    fontSize: 12,
    marginBottom: 8,
  },

  typingBubble: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: T.botBubble,
    border: `1px solid ${T.border}`,
    padding: "13px 16px",
    borderRadius: "16px 16px 16px 4px",
  },

  dot: {
    display: "inline-block",
    width: 6, height: 6,
    borderRadius: "50%",
    background: T.accent,
    animation: "bounce 1.2s infinite ease-in-out",
  },

  footer: {
    padding: "10px 20px 18px",
    borderTop: `1px solid ${T.border}`,
    maxWidth: 800,
    width: "100%",
    alignSelf: "center",
    boxSizing: "border-box",
    flexShrink: 0,
  },

  fileChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: T.bgSurface,
    border: `1px solid ${T.border}`,
    borderRadius: 7,
    padding: "5px 10px",
    marginBottom: 8,
    maxWidth: "60%",
  },

  inputBox: {
    width: "100%",
    background: T.bgInput,
    border: `1px solid ${T.borderMid}`,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    padding: "9px 12px",
    boxSizing: "border-box",
    gap: 4,
  },

  hint: {
    fontSize: 12,
    color: T.danger,
    marginTop: 6,
    textAlign: "center",
  },

  footNote: {
    fontSize: 11,
    color: T.textMuted,
    marginTop: 8,
    textAlign: "center",
    letterSpacing: "0.3px",
  },
};

export default App;
