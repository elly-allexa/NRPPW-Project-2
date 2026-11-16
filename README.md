# NRPPW Project 2 — Security Vulnerability Playground

An educational full-stack web application for **Napredni razvoj programske potpore za web (NRPPW)** at FER. It demonstrates two intentionally switchable web vulnerabilities, each with **Vulnerable (Unsafe)** and **Protected (Safe)** modes.

- **Live application:** https://nrppw-project-2-op56243-security.onrender.com
- **Source repository:** https://github.com/elly-allexa/NRPPW-Project-2
- **Frontend:** React + Vite (JavaScript)
- **Backend:** Node.js + Express (JavaScript)
- **Storage:** in-memory demonstration documents and sessions; no database or real user data

> **Educational use only.** Both vulnerabilities are deliberately enabled for demonstrations. The identities and documents are fictional. Never use these unsafe patterns with real accounts or confidential information.

## Assigned vulnerabilities

According to the task details, I was assigned to do:

1. **Cross-Site Scripting (XSS)** — DOM-based XSS
2. **Broken Access Control (BAC)** — IDOR / Broken Object Level Authorization (BOLA) demonstration

## 1. DOM-based XSS

### Implementation

- **Source of input:** the user-controllable URL fragment, `window.location.hash`. The input field and **Render message** button conveniently write the message to the URL fragment.
- **Vulnerable mode:** React's effect assigns the fragment-derived message to `previewRef.current.innerHTML`. This parses untrusted HTML and allows an event-handler demonstration payload to run.
- **Protected mode:** the effect assigns the same value to `previewRef.current.textContent`. It is displayed as literal text; no HTML element or event handler is created.
- **Toggle:** **Ranjivost uključena** changes a React state boolean (`unsafeXss`). The effect reruns immediately when the toggle or message changes. On a full page reload the XSS mode resets to Protected.

The URL encoder/decoder prepares and reads the fragment; **URL encoding is not an XSS defense**. The key security difference is `innerHTML` versus `textContent`.

### Test through the UI

1. Open the live application and scroll to **DOM-based Cross-Site Scripting**.
2. Click **Insert demo payload** to fill the message field with the educational payload:

   ```html
   <img src="x" onerror="alert('XSS demo — no data was stolen')" />
   ```

3. Keep **Ranjivost uključena** unchecked (Protected) and click **Render message**. The payload appears literally in the preview; there is no alert.
4. Check **Ranjivost uključena** (Vulnerable). The browser alert appears. The same previously loaded message is immediately rerendered; another click on **Render message** is **not necessary**.
5. Uncheck the switch. The payload is again displayed as literal text without execution.

The alert is only a visible proof of code execution; dismissing it with **OK** does not install anything or perform another action.

### Extra test: URL fragment without page reload

1. Enable the XSS vulnerability in the already-open tab.
2. Open the browser's Developer Tools (`F12`) → **Console**.
3. Execute:

   ```javascript
   window.location.hash = encodeURIComponent(
     "<img src=x onerror=\"alert('XSS demo')\">",
   );
   ```

4. The `hashchange` listener reads the new fragment and the alert appears. In Protected mode, the same fragment displays as text.

**Note:** Pasting a complete URL into the address bar may reload the app and reset the frontend toggle to Protected. Changing `window.location.hash` within the already-open tab avoids that reset.

## 2. Broken Access Control (BAC)

### Implementation

The backend exposes fictional identities and documents:

| Demo identity | Role    | Document                      |
| ------------- | ------- | ----------------------------- |
| `student`     | `USER`  | `1` — Student notes           |
| `admin`       | `ADMIN` | `2` — Admin planning document |

The **Log in as Student** and **Log in as Admin** buttons select a fictional identity; **no passwords are required**. This is not real production authentication.

- `POST /api/login` creates a random session token and stores `{ userId, bacUnsafe: false }` in an in-memory Map. The browser receives an `HttpOnly` `demo_session` cookie containing the token.
- `GET /api/session` restores the demo identity/mode while the server session remains valid.
- `POST /api/bac-mode` changes `bacUnsafe` **on the server**, rather than merely changing a React label.
- `GET /api/documents/:id` requires a valid session and looks up the requested document.
- **Protected mode:** the server returns the document only if the session user is its owner or an `ADMIN`. Otherwise it returns **403 Forbidden** without document content.
- **Vulnerable mode:** the object authorization check is intentionally bypassed, allowing `student` to obtain the fictional admin document with **200 OK**.
- **No valid session:** the document endpoint returns **401 Unauthorized**.

The example illustrates IDOR/BOLA: modifying the referenced object ID can lead to unauthorized access when object-level authorization is not enforced. The real access decision is in Express, not just in the interface.

### BAC test matrix

| Session   | Mode            | Request                | Expected                           |
| --------- | --------------- | ---------------------- | ---------------------------------- |
| None      | Either          | `GET /api/documents/2` | `401`                              |
| `student` | Protected       | Document `1`           | `200 OK`, Student notes            |
| `student` | Protected       | Document `2`           | `403 Forbidden`, no document body  |
| `student` | Vulnerable      | Document `2`           | `200 OK`, fictional admin document |
| `student` | Protected again | Document `2`           | `403 Forbidden`                    |
| `admin`   | Protected       | Document `2`           | `200 OK`                           |

**UI test:** log in as Student, request both documents with the checkbox OFF, enable the BAC checkbox, request admin document `2` again, then disable the checkbox and repeat. Switch to Admin for the legitimate access comparison. Use Developer Tools → **Network** → **Fetch/XHR** to inspect actual HTTP statuses and response bodies.

**Direct API check without a session:** open a fresh Incognito window, do **not** log in, open Developer Tools → Console, and run:

```javascript
fetch("/api/documents/2").then(async (response) => {
  console.log("Status:", response.status);
  console.log("Response:", await response.json());
});
```

Expected result: HTTP `401`. The document-request buttons are disabled when logged out, but the backend independently rejects direct requests.

**Direct API check as Student:** while logged in, use:

```javascript
fetch("/api/documents/2", { credentials: "same-origin" }).then(
  async (response) => {
    console.log("Status:", response.status);
    console.log("Response:", await response.json());
  },
);
```

Expected: `403` in Protected mode and `200` in Vulnerable mode. This establishes that the backend, not the visibility of the React buttons, controls the response.

## Installation and local running

**Prerequisites:** Node.js 20+ and npm.

From the repository root (the directory with the root `package.json`):

```bash
npm install
npm run dev
```

- Vite frontend: http://localhost:5173 (or the port shown in the terminal if 5173 is occupied)
- Express API: http://localhost:3001
- In development, Vite proxies `/api` calls to Express.

To use the **production-style single-server build**, stop `npm run dev` and run:

```bash
npm run build
npm start
```

Open http://localhost:3001. In production mode, **Express serves both the compiled React frontend and the API**, so `npm start` starts only one server. The application must be built before starting production mode.

Health check: http://localhost:3001/api/health should respond with:

```json
{ "status": "ok" }
```

No database, external API keys, email service, or demo account passwords are required.

## Deployment on Render

The deployed application runs as **one Render Node Web Service**, with the GitHub repository root as its working directory.

| Setting              | Value                                        |
| -------------------- | -------------------------------------------- |
| Branch               | `main`                                       |
| Root Directory       | Empty (repository root)                      |
| Build Command        | `npm install --include=dev && npm run build` |
| Start Command        | `npm start`                                  |
| Environment variable | `NODE_ENV=production`                        |

The `--include=dev` flag ensures Vite is available during the build. Render launches the backend entry point using the repository's root `package.json` start script (in this deployment, `server/server.js`). Express must listen on `process.env.PORT` and `0.0.0.0`.

Live URL: https://nrppw-project-2-op56243-security.onrender.com

Verify the public `/api/health` endpoint and repeat the Safe/Unsafe tests for both vulnerabilities on the deployed application.

## Limitations and security notes

- **Deliberate vulnerabilities:** vulnerable modes exist solely to demonstrate insecure behavior. The protected renderer uses `textContent`; the BAC backend enforces object-level authorization in Protected mode.
- **Not a real login system:** demonstration users can be selected without passwords. It is an identity selector for the lab, not a secure authentication mechanism.
- **Fictional data only:** no real personal, university, or confidential documents are used.
- **In-memory sessions:** a Render instance restart clears sessions. Log in again if the demo session is lost. BAC mode may persist across a browser reload only while the server session still exists; DOM XSS mode resets on reload.
- **Cookies:** `HttpOnly` prevents direct JavaScript access to the demo session cookie, but it is not a substitute for preventing XSS. In the production deployment, the session cookie uses the `Secure` attribute over HTTPS.
- **Do not reuse unsafe modes in production:** real applications must safely render untrusted data, enforce authentication and authorization server-side, and apply defense-in-depth controls.
