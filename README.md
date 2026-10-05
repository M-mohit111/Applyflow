# ApplyFlow 🚀

ApplyFlow is a smart, privacy-first Chrome Extension designed to instantly auto-fill complex job applications and forms with zero manual effort. It transforms the tedious process of applying for jobs into a single-click experience.

Unlike traditional autofill tools that rely on basic browser history, ApplyFlow uses a highly structured **Master Profile** powered by AI extraction, coupled with a robust **Trust & Provenance Layer** to ensure data accuracy and contextual scoping across different employer portals.

## ✨ Key Features

### 🧠 AI-Powered Setup (No Manual Entry)
Users don't manually type their details. They provide their Resume/CV alongside a strict JSON schema to an AI (like ChatGPT/Gemini). The AI accurately extracts the user's data into the exact format required, which is then imported directly into the extension.

### ⚡ Instant, Smart Auto-Fill
When a user visits a job portal (e.g., Workday, Greenhouse, Lever), the content script scans the DOM, maps the form fields to the Master Profile using advanced Regex matching, and instantly fills the page. 
- **Smart Filtering:** Safely skips hidden, disabled, or sensitive controls (like passwords or legal consent fields).
- **Non-Destructive:** Never overwrites fields the user has already answered manually.

### 🛡️ Trust & Provenance Layer (Enterprise Grade)
Data integrity is critical when applying for jobs. ApplyFlow includes a sophisticated provenance engine:
- **Unverified Data Gating:** AI-imported answers are flagged as *unverified*. Autofill will skip unverified matches and prompt the user to review them, preventing hallucinations from being submitted.
- **Contextual Domain Scoping:** Answers can be scoped to specific domains (employers). A custom answer for one company (e.g., "Why do you want to work here?") will not accidentally leak or autofill on a competitor's application.

### 🔄 Self-Learning Custom Fields
If an application asks a new question not present in the Master Profile, ApplyFlow intercepts the form submission. It learns the new field and answer, saving it locally. 
- **Smart Defaulting:** Learned answers default to employer-scoped, preventing highly specific answers from bleeding into other applications.

### 🔒 Privacy by Default
All data is stored securely in `chrome.storage.local`. The extension operates entirely on the client side. The backend server (Express) is completely decoupled and is only intended for optional AI-drafting endpoints.

## 🛠️ Tech Stack

- **Frontend / UI:** React 18, Vite, Tailwind CSS, Lucide Icons
- **Extension Architecture:** Manifest V3, Content Scripts, Local Storage API
- **Tooling:** TypeScript, Node.js, Express (Backend API)

## 🚀 How to Run Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/applyflow.git
   cd applyflow/extension
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

4. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable **Developer mode** in the top right corner.
   - Click **Load unpacked** and select the `applyflow/extension/dist` folder.
   - Pin the extension and open its Options page to get started!

## 📸 Screenshots

*(Add screenshots of the Dashboard UI, Light/Dark Mode, and the Auto-fill action here)*

---
*Built with passion to help candidates apply faster and get closer to their dream jobs.*
