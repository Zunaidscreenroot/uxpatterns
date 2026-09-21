"use client";

import { useMemo, useState } from "react";

const flows = [
  "Personal Loan", "Credit Card", "Account Opening / KYC", "UPI Payment",
  "Fixed Deposit", "Investment / Mutual Fund", "Insurance / Add-on", "Other Banking Flow",
];

const patterns = [
  ["Drip pricing", "Important charges or costs appear late in the journey."],
  ["Consent manipulation", "Optional consent looks mandatory or is difficult to distinguish."],
  ["Basket sneaking", "A paid add-on or optional product enters the decision without clear opt-in."],
  ["Forced action", "An unrelated action blocks progress through the core banking journey."],
  ["False urgency", "Time pressure is used around a financial decision without adequate context."],
  ["Interface interference", "Visual hierarchy makes one choice materially easier to select."],
  ["Cancellation friction", "Exit, decline or cancellation requires materially more effort."],
  ["Trick wording", "Financial, consent or disclosure copy creates avoidable ambiguity."],
];

const sampleFindings = [
  { time: "00:18", title: "Fee disclosure", type: "Drip pricing", level: "High", text: "A processing-fee detail becomes visible only after the user has progressed into the application." },
  { time: "00:41", title: "Consent clarity", type: "Consent manipulation", level: "High", text: "Marketing or data-sharing consent should be visually and semantically separated from the core application action." },
  { time: "01:07", title: "CTA hierarchy", type: "Interface interference", level: "Medium", text: "The primary action receives substantially stronger visual emphasis than the alternative path." },
];

export default function Home() {
  const [file, setFile] = useState(null);
  const [flow, setFlow] = useState("Personal Loan");
  const [running, setRunning] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const duration = useMemo(() => {
    if (!file) return "No video selected";
    return file.size > 50 * 1024 * 1024 ? "Large file · keep early tests under 50 MB" : "Ready for local analysis";
  }, [file]);

  async function analyze() {
    if (!file || running) return;
    setRunning(true);
    setShowReport(false);
    setReport(null);
    setError("");
    try {
      const frames = await extractFrames(file, 4);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow, frames }),
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch {}
      if (!response.ok || !data?.ok) {
        const detail = Array.isArray(data?.details) ? data.details.join(" | ") : "";
        throw new Error(data?.error || detail || `Analysis request failed (HTTP ${response.status}).`);
      }
      setReport(data.report);
      setShowReport(true);
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this video.");
    } finally {
      setRunning(false);
    }
  }

  function extractFrames(videoFile, count = 4) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(videoFile);
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.onloadedmetadata = async () => {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) {
          URL.revokeObjectURL(url);
          reject(new Error("Could not read video duration."));
          return;
        }
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 960 / Math.max(video.videoWidth || 960, video.videoHeight || 540));
        canvas.width = Math.max(1, Math.round((video.videoWidth || 960) * scale));
        canvas.height = Math.max(1, Math.round((video.videoHeight || 540) * scale));
        const ctx = canvas.getContext("2d");
        const times = Array.from({ length: count }, (_, i) =>
          count === 1 ? 0 : Math.min(Math.max(0, duration - 0.05), (duration * i) / (count - 1))
        );
        const frames = [];
        try {
          for (const time of times) {
            await new Promise((res, rej) => {
              video.currentTime = time;
              video.onseeked = res;
              video.onerror = () => rej(new Error("Could not seek video."));
            });
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const timestamp = new Date(time * 1000).toISOString().slice(14, 19);
            frames.push({ timestamp, data: canvas.toDataURL("image/jpeg", 0.5).split(",")[1] });
          }
          URL.revokeObjectURL(url);
          resolve(frames);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load this video."));
      };
      video.src = url;
    });
  }

  return (
    <main>
      <header className="container topbar">
        <a className="brand" href="#">Banking UX Auditor <span>India</span></a>
        <nav className="nav"><a href="#audit">Audit</a><a href="#results">Findings</a><a href="#framework">Framework</a><a href="#method">Method</a></nav>
      </header>

      <div className="container">
        <section className="hero">
          <div>
            <div className="kicker">India · Banking · UX risk</div>
            <h1>See what a banking flow is really asking the customer to do.</h1>
            <p className="lead">Upload a screen recording and turn a financial journey into timestamped UX evidence, potential dark-pattern classifications and regulatory-relevance checks.</p>
            <div className="actions"><a className="btn primary" href="#audit">Start a flow audit <span>↗</span></a><a className="btn" href="#framework">Explore framework</a></div>
            <div className="trustline"><span>●</span> Evidence-first · Human review · India-focused</div>
          </div>

          <div className="panel preview">
            <div className="eyebrow">AUDIT PREVIEW</div>
            <div className="preview-score"><div><b>Personal loan journey</b><div className="muted">17 screens · 2m 14s</div></div><div className="score">82</div></div>
            {sampleFindings.map((item) => <div className="finding-mini" key={item.title}><div className="row"><b>{item.title}</b><span className={item.level === "Medium" ? "tag medium" : "tag"}>{item.level}</span></div><div className="muted">{item.text}</div></div>)}
          </div>
        </section>

        <section className="section" id="audit">
          <div className="section-head"><div><div className="kicker">01 · Upload</div><h2>Start with the flow, not a screenshot.</h2></div><p className="copy">The product is designed around temporal evidence: screen changes, text, interactions and the moment a decision or disclosure appears.</p></div>
          <div className="audit-grid">
            <label className={"upload panel " + (file ? "selected" : "")}>
              <input type="file" accept="video/mp4,video/quicktime,video/webm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <div className="upload-icon">▶</div>
              <h3>{file ? file.name : "Drop a banking flow video"}</h3>
              <p className="muted">{file ? duration : "MP4, MOV or WebM · screen recording · sanitized data only"}</p>
              <span className="upload-link">{file ? "Choose another video" : "Browse files"}</span>
            </label>

            <div className="panel setup">
              <div className="eyebrow">AUDIT SETUP</div>
              <label className="field-label" htmlFor="journey">Banking journey</label>
              <select id="journey" value={flow} onChange={(e) => setFlow(e.target.value)}>{flows.map((item) => <option key={item}>{item}</option>)}</select>
              <div className="setup-note"><span>✓</span><div><b>Current scope</b><div className="muted">UX evidence + pattern classification + regulatory relevance</div></div></div>
              <button className="btn primary full" onClick={analyze} disabled={!file || running}>{running ? "Analyzing…" : "Analyze flow"}</button>
              <div className="muted center">{file ? "Selected: " + flow : "Choose a video to enable analysis"}</div>{error && <div className="error-note">{error}</div>}
            </div>
          </div>
        </section>

        {showReport && (
          <section className="section" id="results">
            <div className="section-head"><div><div className="kicker">02 · Results</div><h2>Evidence timeline</h2></div><p className="copy">Prototype output for <b>{flow}</b>. Findings are hypotheses for review, not legal conclusions.</p></div>
            <div className="results-grid">
              <div className="panel risk-card"><div className="eyebrow">TRANSPARENCY SIGNAL</div><div className="big-number">{report?.findings?.length ?? 0}</div><p>potential issues detected</p><div className="bar"><span style={{ width: `${Math.min(100, (report?.findings?.length ?? 0) * 20)}%` }} /></div><div className="muted">AI-generated hypotheses · human review required</div></div>
              <div className="timeline">{report?.summary && <div className="panel report-summary"><b>AI summary</b><p className="muted">{report.summary}</p></div>}{(report?.findings || []).map((item, i) => <div className="timeline-item" key={`${item.timestamp}-${i}`}><div className="time">{item.timestamp}</div><div className="timeline-dot" /><div className="panel"><div className="row"><div><b>{item.title}</b><div className="muted">{item.pattern} · {Math.round(item.confidence * 100)}% confidence</div></div><span className={item.severity === "Medium" ? "tag medium" : item.severity === "Low" ? "tag low" : "tag"}>{item.severity}</span></div><p className="muted"><b>Evidence:</b> {item.evidence}</p><p className="muted"><b>Rationale:</b> {item.rationale}</p><p className="muted"><b>Regulatory relevance:</b> {item.regulatory_relevance}</p><a className="evidence-link" href="#method">View evidence model →</a></div></div>)}</div>
            </div>
          </section>
        )}

        <section className="section" id="framework">
          <div className="section-head"><div><div className="kicker">03 · Pattern library</div><h2>Banking-specific pattern library.</h2></div><p className="copy">Start with known deceptive-design patterns, then add banking-specific interpretations and source-backed regulatory relevance.</p></div>
          <div className="tax">{patterns.map(([title, desc], i) => <div className="item" key={title}><div className="pattern-num">{String(i + 1).padStart(2, "0")}</div><div><b>{title}</b><div className="muted">{desc}</div></div></div>)}</div>
        </section>

        <section className="section" id="method">
          <div className="section-head"><div><div className="kicker">04 · Evidence model</div><h2>Three layers keep the audit defensible.</h2></div></div>
          <div className="grid">
            <div className="item"><div className="step">01</div><h3>Observed UX evidence</h3><div className="muted">What the recording actually shows: screen state, copy, sequence, interaction and timestamp.</div></div>
            <div className="item"><div className="step">02</div><h3>Pattern classification</h3><div className="muted">Potential deceptive-design or customer-control pattern with confidence and rationale.</div></div>
            <div className="item"><div className="step">03</div><h3>Regulatory relevance</h3><div className="muted">Potentially relevant Indian requirement, linked to a source and scoped to the journey.</div></div>
          </div>
        </section>

        <footer className="footer"><b>Banking UX Auditor</b><span>Prototype · UX audit aid, not legal or regulatory certification.</span></footer>
      </div>
    </main>
  );
}
