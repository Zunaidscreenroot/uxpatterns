"use client";

import { useMemo, useState } from "react";

const flows = [
  "Personal Loan", "Credit Card", "Account Opening / KYC", "UPI Payment",
  "Fixed Deposit", "Investment / Mutual Fund", "Insurance / Add-on", "Other Banking Flow",
];

const patterns = [
  ["Fee opacity", "Important fees, charges or costs become clear only later in the journey.", "Pricing"],
  ["Consent manipulation", "Optional consent is made difficult to distinguish from the core action.", "Consent"],
  ["Basket sneaking", "An add-on, product or service enters the decision without clear opt-in.", "Choice"],
  ["Forced action", "An unrelated action blocks progress through the primary banking journey.", "Control"],
  ["False urgency", "Time pressure or scarcity is used around a financial decision without adequate context.", "Pressure"],
  ["Interface interference", "Visual hierarchy makes one choice materially easier to select than another.", "Choice"],
  ["Cancellation friction", "Exit, decline or cancellation requires materially more effort than entry.", "Control"],
  ["Trick wording", "Financial, consent or disclosure copy creates avoidable ambiguity.", "Language"],
];

const sampleFindings = [
  { title: "Fee disclosure", type: "Fee opacity", level: "High", text: "A processing-fee detail appears only after the customer has progressed into the application." },
  { title: "Consent clarity", type: "Consent manipulation", level: "High", text: "Marketing or data-sharing consent should be visually and semantically separated from the core application action." },
  { title: "CTA hierarchy", type: "Interface interference", level: "Medium", text: "The primary action receives substantially stronger visual emphasis than the alternative path." },
];

export default function Home() {
  const [file, setFile] = useState(null);
  const [flow, setFlow] = useState("Personal Loan");
  const [running, setRunning] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const duration = useMemo(() => {
    if (!file) return "No journey selected";
    return file.size > 50 * 1024 * 1024
      ? "Large file · keep early tests under 50 MB"
      : "Ready for evidence analysis";
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
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {}

      if (!response.ok || !data?.ok) {
        const detail = Array.isArray(data?.details) ? data.details.join(" | ") : "";
        throw new Error(
          [data?.error, detail].filter(Boolean).join(": ") ||
          `Analysis request failed (HTTP ${response.status}).`
        );
      }

      setReport(data.report);
      setShowReport(true);
      requestAnimationFrame(() =>
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not analyze this journey.");
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
        const scale = Math.min(
          1,
          960 / Math.max(video.videoWidth || 960, video.videoHeight || 540)
        );

        canvas.width = Math.max(1, Math.round((video.videoWidth || 960) * scale));
        canvas.height = Math.max(1, Math.round((video.videoHeight || 540) * scale));

        const ctx = canvas.getContext("2d");
        const times = Array.from({ length: count }, (_, i) =>
          count === 1
            ? 0
            : Math.min(Math.max(0, duration - 0.05), (duration * i) / (count - 1))
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

            frames.push({
              timestamp,
              data: canvas.toDataURL("image/jpeg", 0.5).split(",")[1],
            });
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
        <a className="brand" href="#">Banking Experience <span>Risk</span></a>
        <nav className="nav">
          <a href="#patterns">Patterns</a>
          <a href="#coverage">Coverage</a>
          <a href="#analyse">Analyse</a>
          <a href="#method">Method</a>
        </nav>
      </header>

      <div className="container">
        <section className="hero">
          <div className="hero-copy">
            <div className="kicker">India · Banking · Customer experience risk</div>
            <h1>Find the patterns hiding inside your banking experience.</h1>
            <p className="lead">
              Analyse digital banking journeys for deceptive patterns, disclosure gaps
              and potential regulatory relevance — backed by screen-level evidence.
            </p>

            <div className="actions">
              <a className="btn primary" href="#analyse">Analyse your experience <span>↗</span></a>
              <a className="btn" href="#patterns">Explore patterns</a>
            </div>

            <div className="trustline">
              <span>●</span> Evidence-first · Human review · India-focused
            </div>
          </div>

          <div className="hero-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="risk-preview panel">
              <div className="eyebrow">EXPERIENCE REVIEW</div>
              <div className="preview-title">
                <div>
                  <b>Personal loan</b>
                  <div className="muted">Customer journey · 17 screens</div>
                </div>
                <span className="review-state">REVIEW</span>
              </div>
              <div className="preview-lines">
                {sampleFindings.map((item) => (
                  <div className="preview-line" key={item.title}>
                    <span className="line-dot" />
                    <div>
                      <b>{item.title}</b>
                      <div className="muted">{item.type}</div>
                    </div>
                    <span className={item.level === "Medium" ? "tag medium" : "tag"}>{item.level}</span>
                  </div>
                ))}
              </div>
              <div className="preview-footer">
                <span>3 review areas</span>
                <span>Evidence mapped</span>
              </div>
            </div>
          </div>
        </section>

        <section className="statement">
          <div className="statement-mark">“</div>
          <div>
            <div className="eyebrow">Why this matters</div>
            <h2>A financial interface can be technically functional and still make a customer's choice harder to understand.</h2>
          </div>
        </section>

        <section className="section" id="patterns">
          <div className="section-head">
            <div>
              <div className="kicker">01 · Pattern library</div>
              <h2>The patterns we look for.</h2>
            </div>
            <p className="copy">
              A banking-specific pattern library for examining choice, consent, pricing,
              disclosure and customer control across digital journeys.
            </p>
          </div>

          <div className="pattern-grid">
            {patterns.map(([title, desc, category], i) => (
              <article className="pattern-card" key={title}>
                <div className="pattern-top">
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <span>{category}</span>
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
                <span className="learn">How we identify it →</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section coverage-section" id="coverage">
          <div className="section-head">
            <div>
              <div className="kicker">02 · Three lenses</div>
              <h2>One journey. Three questions.</h2>
            </div>
            <p className="copy">
              We separate what the interface shows from what the pattern may mean and
              what requirements may be relevant.
            </p>
          </div>

          <div className="lens-grid">
            <article className="lens-card">
              <span className="lens-number">01</span>
              <div className="lens-icon">◌</div>
              <h3>Deceptive patterns</h3>
              <p>What is the interface doing to shape the customer's choice?</p>
              <div className="lens-list">Choice architecture · Consent · Pressure · Language</div>
            </article>

            <article className="lens-card featured">
              <span className="lens-number">02</span>
              <div className="lens-icon">◎</div>
              <h3>Customer transparency</h3>
              <p>What does the customer actually see, understand and agree to?</p>
              <div className="lens-list">Fees · Terms · Data use · Eligibility · Offers</div>
            </article>

            <article className="lens-card">
              <span className="lens-number">03</span>
              <div className="lens-icon">⌁</div>
              <h3>Regulatory relevance</h3>
              <p>Which Indian requirements or guidance may warrant a closer review?</p>
              <div className="lens-list">Source mapping · Evidence · Scope · Human review</div>
            </article>
          </div>
        </section>

        <section className="research-band">
          <div>
            <div className="kicker">Built for financial experiences</div>
            <h2>Make customer choice easier to see.</h2>
          </div>
          <div className="research-stats">
            <div><strong>08</strong><span>core patterns</span></div>
            <div><strong>03</strong><span>review lenses</span></div>
            <div><strong>01</strong><span>evidence trail</span></div>
          </div>
        </section>

        <section className="section analyse-section" id="analyse">
          <div className="section-head">
            <div>
              <div className="kicker">03 · Analyse</div>
              <h2>Put a banking journey under the lens.</h2>
            </div>
            <p className="copy">
              Upload a screen recording. The analysis extracts visual evidence and
              produces reviewable findings rather than declaring legal compliance.
            </p>
          </div>

          <div className="audit-grid">
            <label className={"upload panel " + (file ? "selected" : "")}>
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div className="upload-icon">↑</div>
              <div className="upload-kicker">{file ? "Journey selected" : "Upload journey"}</div>
              <h3>{file ? file.name : "Drop a banking flow video"}</h3>
              <p className="muted">
                {file ? duration : "MP4, MOV or WebM · screen recording · sanitized data only"}
              </p>
              <span className="upload-link">{file ? "Choose another video" : "Browse files"}</span>
            </label>

            <div className="panel setup">
              <div className="eyebrow">REVIEW SETUP</div>
              <label className="field-label" htmlFor="journey">Journey type</label>
              <select id="journey" value={flow} onChange={(e) => setFlow(e.target.value)}>
                {flows.map((item) => <option key={item}>{item}</option>)}
              </select>

              <div className="scope">
                <div className="scope-row"><span>01</span><b>Visual evidence</b></div>
                <div className="scope-row"><span>02</span><b>Pattern classification</b></div>
                <div className="scope-row"><span>03</span><b>Regulatory relevance</b></div>
              </div>

              <button className="btn primary full" onClick={analyze} disabled={!file || running}>
                {running ? "Analysing journey…" : "Analyse journey"}
              </button>

              <div className="muted center">
                {file ? "Reviewing: " + flow : "Choose a video to begin"}
              </div>
              {error && <div className="error-note">{error}</div>}
            </div>
          </div>
        </section>

        {showReport && (
          <section className="section" id="results">
            <div className="section-head">
              <div>
                <div className="kicker">04 · Review output</div>
                <h2>What we found in this journey.</h2>
              </div>
              <p className="copy">
                Review areas are evidence-backed hypotheses for product, UX and compliance
                teams. They are not legal conclusions.
              </p>
            </div>

            <div className="results-overview">
              <div className="overview-number">
                <span className="eyebrow">REVIEW AREAS</span>
                <strong>{report?.findings?.length ?? 0}</strong>
                <p>Potential areas requiring closer review.</p>
              </div>
              <div className="overview-copy">
                <span className="eyebrow">JOURNEY</span>
                <h3>{flow}</h3>
                <p>{report?.summary || "Evidence extracted from the supplied journey and mapped to the banking pattern framework."}</p>
                <div className="review-chips">
                  <span>Evidence mapped</span>
                  <span>Pattern classified</span>
                  <span>Human review required</span>
                </div>
              </div>
            </div>

            <div className="findings-list">
              {(report?.findings || []).map((item, i) => (
                <article className="finding-card" key={item.timestamp + "-" + i}>
                  <div className="finding-time">{item.timestamp}</div>
                  <div className="finding-body">
                    <div className="finding-heading">
                      <div>
                        <span className="finding-type">{item.pattern}</span>
                        <h3>{item.title}</h3>
                      </div>
                      <span className={item.severity === "Medium" ? "tag medium" : item.severity === "Low" ? "tag low" : "tag"}>{item.severity}</span>
                    </div>
                    <p><b>Observed:</b> {item.evidence}</p>
                    <p><b>Why it matters:</b> {item.rationale}</p>
                    <div className="regulatory-box">
                      <span>Potential regulatory relevance</span>
                      <p>{item.regulatory_relevance}</p>
                    </div>
                    <div className="confidence">AI confidence · {Math.round(item.confidence * 100)}%</div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="section" id="method">
          <div className="section-head">
            <div>
              <div className="kicker">05 · Evidence model</div>
              <h2>Designed to make every finding explainable.</h2>
            </div>
            <p className="copy">
              The system does not jump from screenshot to verdict. Every review area has
              an evidence trail.
            </p>
          </div>

          <div className="method-grid">
            <div className="method-card"><span>01</span><h3>Observed evidence</h3><p>What the recording actually shows: screen state, copy, sequence and timestamp.</p></div>
            <div className="method-card"><span>02</span><h3>Pattern classification</h3><p>The potential customer-control or deceptive-design pattern, with rationale and confidence.</p></div>
            <div className="method-card"><span>03</span><h3>Regulatory mapping</h3><p>Potentially relevant Indian requirement or guidance, linked to a source for human review.</p></div>
          </div>
        </section>

        <section className="closing">
          <div className="kicker">For banks · NBFCs · fintechs · financial services</div>
          <h2>Know what your customer is being asked to accept.</h2>
          <a className="btn primary" href="#analyse">Analyse a journey <span>↗</span></a>
        </section>

        <footer className="footer">
          <b>Banking Experience Risk</b>
          <span>Evidence-backed UX review · not legal or regulatory certification.</span>
        </footer>
      </div>
    </main>
  );
}
