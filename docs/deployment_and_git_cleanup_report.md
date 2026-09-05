# Deployment & Git Cleanup Report

## Part 1: Git Changes — What to Commit vs. What to Ignore

Your Git workspace is currently cluttered with many one-off data processing scripts, PDF invoices, and JSON data dumps. Here is a clear breakdown of what you should commit and what you should ignore or delete.

### ✅ Essential (MUST Commit)
These files contain actual application logic, UI bug fixes, backend routing fixes, and database migrations.
1. **Frontend Code (UI Fixes):**
   - `frontend/src/screens/GoodsReceipt/index.jsx`
   - `frontend/src/screens/Indent/index.jsx`
   - `frontend/src/screens/Issuance/components/IssuanceHistory.jsx`
   - `frontend/src/screens/Issuance/index.jsx`
2. **Backend Code (Routing & Cron fixes):**
   - `backend/routes/menu.js` (New)
   - `backend/routes/recipes.js`
   - `backend/server.ts`
   - `backend/cron/*.js` (All modified cron jobs)
3. **Database Migrations:**
   - `backend/db/migrations/054_add_indent_cutoff_permissions.js`
   - `backend/db/migrations/054_sync_indent_templates.js`
4. **Dependencies:**
   - `backend/package.json` & `backend/package-lock.json`
   - `frontend/package-lock.json`
5. **Documentation:**
   - All `.md` files inside the `docs/` folder.

### ❌ Useless / Should be Ignored (DO NOT Commit)
These files are temporary artifacts, data dumps, and one-off scripts we used for data entry. Committing them will bloat your repository size.
1. **Data Dumps & JSON logs:**
   - `backend/stock_dump.json`, `backend/verification_results.json`, `backend/templates.json`, `backend/scripts/ocr_extractions.json`
2. **One-Off Scripts (Over 40 files):**
   - Everything inside `backend/scripts/` that was used for PDF parsing, fixing negative stock, or running OCR (e.g., `execute_11th_transfers.js`, `test_pdf.js`, `import_aug10_db.js`, `fix_negative_stock.js`, etc.).
3. **Documents & PDFs:**
   - Everything inside the `Documentation/` folder (PDFs, Excel sheets like `INDENT SHEET UPDATED.xlsx`).
   - The `tmp/` and `backend/exports/` folders.

**Action Plan for Git:**
1. Unstage everything: `git restore --staged .`
2. Add only the essentials: `git add frontend/src backend/routes backend/server.ts backend/cron backend/db/migrations package.json docs/`
3. Commit them: `git commit -m "Fix UI layouts, fix backend API routing, and apply database constraints"`
4. Add the rest to a `.gitignore` file or simply delete them if you no longer need the PDF scripts.

---

## Part 2: Installing on the Client Machine (With Live Database)

Because Kapila uses **SQLite** as its database, the entire database (all POs, GRNs, Ledger, Indents, Issuances, Stock, etc.) is stored in a single physical file on your hard drive: `backend/data.db`.

You do **not** need to run complex SQL export/import commands. You just need to safely transfer that file. Here is the step-by-step guide to installing it on the client machine:

### Step 1: Prepare the Client Machine
1. Install **Node.js** (v20+) on the client computer.
2. Install **Git** (optional, but helpful for pulling the code).
3. Copy your entire repository code to the client machine (via a flash drive, zip file, or `git clone`). *Do not copy the `node_modules` folders.*

### Step 2: Transfer the Live Database & Secrets
1. **The Database:** Copy the `backend/data.db` file from your current machine and paste it into the exact same `backend/` folder on the client machine. This file contains **100% of your current application state**.
2. **The Environment File:** Copy your `backend/.env` file to the client machine. This file contains critical secrets (like your `JWT_SECRET` for login and your `GEMINI_API_KEY`). Without this, logins will fail.

### Step 3: Install & Build
On the client machine, open a terminal:
1. **Backend:**
   - `cd backend`
   - `npm install`
2. **Frontend:**
   - `cd ../frontend`
   - `npm install`
   - `npm run build` *(This compiles the React app into optimized, static HTML/JS/CSS files for production).*

### Step 4: Run the App as a Background Service
You should not run `npm run dev` in production because it will crash and stay down if the terminal closes. Instead, use a production process manager like **PM2**:
1. Install PM2 globally on the client machine: `npm install -g pm2`
2. Start the backend: 
   - `cd backend`
   - `pm2 start server.ts --name kapila-backend --interpreter tsx`
3. Serve the frontend (using a static server package like `serve`):
   - `npm install -g serve`
   - `cd ../frontend`
   - `pm2 start "serve -s dist -l 5173" --name kapila-frontend`
4. Make it run on computer startup (Windows):
   - `npm install -g pm2-windows-startup`
   - Run `pm2-startup` and then `pm2 save`.

By following this guide, the client machine will boot up with the exact same data, stock levels, and history that you are seeing on your machine right now!
