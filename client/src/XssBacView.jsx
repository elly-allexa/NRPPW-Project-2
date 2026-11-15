import { useEffect, useRef, useState } from "react";

const SAMPLE_PAYLOAD = "<img src=x onerror=\"alert('XSS demo')\">";
const PLAIN_MESSAGE = "Hello from user!";

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await response.json();
  return { status: response.status, body };
}

export default function App() {
  const [unsafeXss, setUnsafeXss] = useState(false);
  const [input, setInput] = useState(PLAIN_MESSAGE);
  const [hashMessage, setHashMessage] = useState("");
  const [session, setSession] = useState(null);
  const [bacResult, setBacResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef(null);

  useEffect(() => {
    function readHash() {
      try {
        setHashMessage(decodeURIComponent(window.location.hash.slice(1)));
      } catch {
        setHashMessage(window.location.hash.slice(1));
      }
    }

    readHash();

    window.addEventListener("hashchange", readHash);

    api("/api/session")
      .then(({ body }) => setSession(body))
      .catch(() => {});

    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  //client side: DOM XSS
  useEffect(() => {
    if (!previewRef.current) return;

    if (unsafeXss)
      previewRef.current.innerHTML = hashMessage; //vulnerable
    else previewRef.current.textContent = hashMessage; //protected
  }, [hashMessage, unsafeXss]);

  function testXss() {
    //source is the URL fragment (location.hash), not a React JSX interpolation
    const encoded = encodeURIComponent(input);
    if (window.location.hash === `#${encoded}`) setHashMessage(input);
    else window.location.hash = encoded;
  }

  //server side: Broken Access Control
  async function login(username) {
    setBusy(true);
    setBacResult(null);
    try {
      setSession(
        (
          await api("/api/login", {
            method: "POST",
            body: JSON.stringify({ username }),
          })
        ).body,
      );
    } catch (err) {
      setBacResult({ status: "Network error", body: { error: String(err) } });
    } finally {
      setBusy(false);
    }
  }

  async function setBacMode(unsafe) {
    setBusy(true);
    setBacResult(null);
    try {
      const result = await api("/api/bac-mode", {
        method: "POST",
        body: JSON.stringify({ unsafe }),
      });
      if (result.status === 200)
        setSession((current) => ({
          ...current,
          bacUnsafe: result.body.bacUnsafe,
        }));
      else setBacResult(result);
    } catch (err) {
      setBacResult({ status: "Network error", body: { error: String(err) } });
    } finally {
      setBusy(false);
    }
  }

  async function fetchDocument(id) {
    setBusy(true);
    try {
      setBacResult(await api(`/api/documents/${id}`));
    } catch (err) {
      setBacResult({ status: "Network error", body: { error: String(err) } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header>
        <h1>Security Vulnerability Playground</h1>
        <p>
          Toggle to see vulnerable and protected behavior, launch a test and
          observe the results.
        </p>
      </header>

      <section className="panel">
        <div className="heading">
          <div>
            <span className="eyebrow">01 / CLIENT SIDE</span>
            <h2>DOM-based Cross-Site Scripting</h2>
          </div>
          <span className={`status ${unsafeXss ? "danger" : "success"}`}>
            {unsafeXss ? "Vulnerable" : "Protected"}
          </span>
        </div>
        <p>
          The text comes from <code>location.hash</code>. Vulnerable mode uses{" "}
          <code>innerHTML</code>; protected mode uses <code>textContent</code>.
        </p>
        <label className="toggle">
          <input
            type="checkbox"
            checked={unsafeXss}
            onChange={(e) => setUnsafeXss(e.target.checked)}
          />{" "}
          Ranjivost uključena (Enable vulnerability)
        </label>
        <label htmlFor="payload">Enter your message or payload</label>
        <textarea
          id="payload"
          rows="3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="buttons">
          <button onClick={() => setInput(SAMPLE_PAYLOAD)}>
            Insert demo payload
          </button>
          <button className="primary" onClick={testXss}>
            Render message
          </button>
        </div>
        <div className="result">
          <strong>Browser preview</strong>
          <div ref={previewRef} className="preview" />
          <small>
            The URL fragment can also be edited manually. But I only used these
            demonstration payloads because they are safe and do not steal any
            data. In a real DOM XSS attack, the payload could be crafted to
            extract sensitive information from the page or the user.
          </small>
          <small></small>
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <span className="eyebrow">02 / SERVER SIDE</span>
            <h2>Broken Access Control</h2>
          </div>
          <span
            className={`status ${session?.bacUnsafe ? "danger" : "success"}`}
          >
            {session?.bacUnsafe ? "Vulnerable" : "Protected"}
          </span>
        </div>
        <p>
          Read someone else's document using a predictable resource ID. In
          protected mode, server(written in Express) checks ownership and role
          before returning any document data.
        </p>
        <div className="buttons">
          <button disabled={busy} onClick={() => login("student")}>
            Log in as Student
          </button>
          <button disabled={busy} onClick={() => login("admin")}>
            Log in as Admin
          </button>
        </div>
        <p>
          <strong>Active account:</strong>{" "}
          {session?.user
            ? `${session.user.displayName} (${session.user.role})`
            : "Not logged in"}
        </p>
        <label className="toggle">
          <input
            disabled={!session?.user || busy}
            type="checkbox"
            checked={!!session?.bacUnsafe}
            onChange={(e) => setBacMode(e.target.checked)}
          />{" "}
          Ranjivost uključena (Enable vulnerability)
        </label>
        <div className="buttons">
          <button
            disabled={!session?.user || busy}
            onClick={() => fetchDocument(1)}
          >
            Request student document #1
          </button>
          <button
            disabled={!session?.user || busy}
            className="primary"
            onClick={() => fetchDocument(2)}
          >
            Request admin document #2
          </button>
        </div>
        <div className="result">
          <strong>API response</strong>
          {bacResult ? (
            <>
              <p className={bacResult.status === 200 ? "ok" : "error"}>
                HTTP {bacResult.status}
              </p>
              <pre>{JSON.stringify(bacResult.body, null, 2)}</pre>
            </>
          ) : (
            <p>No request made yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
