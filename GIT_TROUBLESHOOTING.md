# 🛠️ Hotel Kapila IMS — Enterprise Git & GitHub Troubleshooting Guide

This guide is the complete operational and troubleshooting reference for synchronizing the **Hotel Kapila Inventory Management System** codebase with GitHub.

---

## ⚡ Quick Start Automation Scripts

We provide 1-click batch scripts and advanced PowerShell engines in the repository root:

| Action | 1-Click Launcher | PowerShell Engine | What It Does |
|---|---|---|---|
| **Push to GitHub** | [`Push to GitHub.bat`](file:///c:/Kapila_store/Push%20to%20GitHub.bat) | [`scripts/git_push.ps1`](file:///c:/Kapila_store/scripts/git_push.ps1) | Analyzes changes, displays subsystem impact matrix, scans for secret leaks, stages, commits, and pushes. |
| **Pull from GitHub** | [`Pull from GitHub.bat`](file:///c:/Kapila_store/Pull%20from%20GitHub.bat) | [`scripts/git_pull.ps1`](file:///c:/Kapila_store/scripts/git_pull.ps1) | Inspects incoming commits and diffstat, guards local dirty files with auto-stash, and alerts on database migrations or dependency updates. |
| **Run Health Check** | [`Git Troubleshoot.bat`](file:///c:/Kapila_store/Git%20Troubleshoot.bat) | [`scripts/git_diagnose.ps1`](file:///c:/Kapila_store/scripts/git_diagnose.ps1) | 10-point automated diagnostic checking remotes, network, credentials, conflict markers, large files, and secrets. |

---

## 📊 Visual Change & Impact Analysis

Both the Push and Pull scripts output an **Enterprise Change Dashboard** that explicitly shows **what changes are getting effected**:

### Push Impact Dashboard Example:
```text
========================================================================
                 [📊 WHAT CHANGES ARE GETTING EFFECTED]
========================================================================
  Files Changed Summary:
    • New / Untracked : 3
    • Modified Files  : 4
    • Staged Additions: 0
    • Deleted Files   : 0
    • Total Files     : 7

  Subsystem Impact Breakdown:
    [2 files] Frontend UI/UX [MODIFIED]
    [3 files] Backend & APIs [MODIFIED]
    [1 files] Database & Migrations [MODIFIED]
    [1 files] Documentation [MODIFIED]

  Detailed Line Changes (Diffstat):
    frontend/src/api/client.js            | 14 +++++++---
    backend/services/inventoryReport.js   | 42 ++++++++++++++++++++++++++++++
```

### Pull Impact Dashboard Example:
```text
========================================================================
             [📊 WHAT CHANGES ARE GETTING EFFECTED ON PULL]
========================================================================
  Sync Status:
    • Local is ahead by  : 0 commit(s)
    • Local is behind by : 2 commit(s)

  Incoming Commits (2):
    ▼ a1b2c3d feat(stock): add multi-language voice parser
    ▼ e4f5g6h fix(issuance): attach x-api-key header

  Subsystems Affected by Incoming Pull:
    [2 files] Frontend UI/UX
    [1 files] Database & Migrations

  Incoming Files Diffstat:
    backend/migrations/20260905_add_voice_tokens.js | 28 ++++++++++++++++++++++
```

---

## 🧭 Troubleshooting Scenarios & Step-by-Step Fixes

### 1. First-Time Setup: Linking Local Project to GitHub

If you have created a new empty repository on GitHub and want to upload your project for the first time:

#### Automatic Method:
Simply double-click [`Push to GitHub.bat`](file:///c:/Kapila_store/Push%20to%20GitHub.bat). It will automatically detect that Git is uninitialized, initialize `main`, prompt for your GitHub URL, and perform the initial push!

#### Manual CLI Method:
```powershell
# 1. Navigate to project root
cd c:\Kapila_store

# 2. Initialize Git with default branch main
git init -b main

# 3. Configure author identity
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 4. Link your remote GitHub repository
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# 5. Stage, commit, and push
git add -A
git commit -m "feat(init): initial commit of Kapila Inventory Management System"
git push -u origin main
```

---

### 2. Authentication Errors: `403 Forbidden` or `401 Bad Credentials`

#### Cause:
GitHub discontinued password authentication for Git operations. You must use a **GitHub Personal Access Token (PAT)** or **SSH key**.

#### Solution A: Generate and Use a Personal Access Token (PAT)
1. Go to GitHub: **Settings** -> **Developer Settings** -> **Personal Access Tokens** -> **Tokens (classic)**.
2. Click **Generate new token (classic)**.
3. Note: `Kapila-IMS-Token`, Expiration: `90 days` or `No expiration`.
4. Select Scopes: Check `repo` (Full control of private repositories) and `workflow`.
5. Click **Generate Token** and copy the token string (`ghp_...`).
6. When Git prompts for your password in terminal, paste this `ghp_...` token as the password.

#### Solution B: Update Windows Credential Manager
If Windows cached an old or invalid password:
1. Press `Windows Key + R`, type `control keymgr.dll`, and press **Enter**.
2. Click **Windows Credentials**.
3. Under **Generic Credentials**, find `git:https://github.com`.
4. Click **Edit**, enter your GitHub username, and paste your new Personal Access Token as the password.
5. Click **Save**.

#### Solution C: Switch to SSH Key Authentication
```powershell
# 1. Check if you have an SSH key
Get-Content ~/.ssh/id_ed25519.pub

# 2. If missing, generate one
ssh-keygen -t ed25519 -C "your.email@example.com"

# 3. Copy public key and add it to GitHub (Settings -> SSH and GPG Keys)
Get-Content ~/.ssh/id_ed25519.pub | Set-Clipboard

# 4. Change Git remote URL to SSH format
git remote set-url origin git@github.com:<YOUR-USERNAME>/<YOUR-REPO-NAME>.git
```

---

### 3. "Failed to push some refs" / Non-Fast-Forward Rejected

#### Symptoms:
```text
! [rejected]        main -> main (fetch first)
error: failed to push some refs to 'https://github.com/...'
hint: Updates were rejected because the remote contains work that you do
hint: not have locally. This is usually caused by another repository pushing...
```

#### Cause:
The remote repository on GitHub has commits that do not exist in your local branch (for example, someone else pushed, or a `README.md` or `.gitignore` was created directly on GitHub).

#### Solution:
1. Run [`Pull from GitHub.bat`](file:///c:/Kapila_store/Pull%20from%20GitHub.bat) to inspect and merge incoming changes.
2. Or in PowerShell:
   ```powershell
   git pull --rebase origin main
   git push origin main
   ```

---

### 4. Resolving Merge Conflicts

#### Symptoms:
```text
CONFLICT (content): Merge conflict in frontend/src/screens/StoreManagerHome.jsx
Automatic merge failed; fix conflicts and then commit the result.
```

#### How Conflicts Work:
Git places conflict markers directly inside the conflicting files:
```javascript
<<<<<<< HEAD (Your Local Version)
const REFRESH_INTERVAL = 30000;
=======
const REFRESH_INTERVAL = 15000;
>>>>>>> origin/main (Remote GitHub Version)
```

#### Step-by-Step Resolution:
1. Open [`Git Troubleshoot.bat`](file:///c:/Kapila_store/Git%20Troubleshoot.bat) to list all files with conflict markers.
2. Open the conflicting files in VS Code or your IDE.
3. Decide which code to keep:
   - **Accept Current Change**: Keeps your local code.
   - **Accept Incoming Change**: Keeps the remote code from GitHub.
   - **Accept Both Changes**: Keeps both blocks.
   - **Custom Edit**: Delete the markers (`<<<<<<<`, `=======`, `>>>>>>>`) and manually edit the lines.
4. Save the file.
5. Stage the resolved file:
   ```powershell
   git add frontend/src/screens/StoreManagerHome.jsx
   ```
6. Finalize the merge:
   ```powershell
   git commit -m "fix(merge): resolve merge conflict in StoreManagerHome"
   git push origin main
   ```

#### Emergency: How to Abort a Bad Merge
If the merge becomes too messy and you want to return to your clean pre-merge state:
```powershell
git merge --abort
```

---

### 5. Preventing & Remedying Secret Leaks (`.env`, Passwords, Dumps)

#### Automatic Protection:
The [`scripts/git_push.ps1`](file:///c:/Kapila_store/scripts/git_push.ps1) script contains **Agent 3: Security Guard**, which scans all files for sensitive patterns (`.env`, `*.pem`, `*.key`, `*.dump`) and halts the push if detected!

#### How to Remove an Accidentally Staged Secret Without Deleting the File:
```powershell
# Stop tracking the secret file in Git, keeping it on your local disk:
git rm --cached backend/.env

# Verify that .gitignore includes backend/.env
# Commit the removal
git commit -m "chore: remove backend/.env from version control"
git push origin main
```

---

### 6. Working Tree Dirty State & Stashing Work

If you want to pull updates from GitHub, but you have half-finished local edits:

#### Automatic Method:
When you run [`Pull from GitHub.bat`](file:///c:/Kapila_store/Pull%20from%20GitHub.bat), it detects uncommitted changes and asks if you want to **Safe Stash**. If you select `1`, it safely stashes your work, pulls from GitHub, and automatically reapplies your work!

#### Manual CLI Method:
```powershell
# 1. Save work to temporary stash
git stash save "work-in-progress"

# 2. Pull remote updates
git pull origin main

# 3. Restore your stashed changes
git stash pop
```

---

### 7. Windows Line Ending Warnings (`LF will be replaced by CRLF`)

#### Cause:
Windows uses Carriage Return + Line Feed (`\r\n`), while Linux and Git servers use Line Feed (`\n`).

#### Recommended Fix:
Configure Git to automatically normalize line endings:
```powershell
git config --global core.autocrlf true
```

---

### 8. Recovering from Detached HEAD State

#### Cause:
You checked out a specific commit hash rather than a named branch.

#### Solution:
```powershell
# Return to the main branch safely:
git switch main

# Or if you made commits in detached HEAD that you want to keep:
git switch -c my-saved-work
```

---

### 9. Post-Pull Operational Checklist

Whenever you pull code from GitHub, check the terminal output from [`Pull from GitHub.bat`](file:///c:/Kapila_store/Pull%20from%20GitHub.bat):

1. **If `package.json` changed:**
   ```powershell
   cd frontend && npm install
   cd ..\backend && npm install
   ```
2. **If `backend/migrations/` changed:**
   ```powershell
   cd backend && npx knex migrate:latest
   ```
3. **Restart application servers:**
   Double-click [`Start Kapila.bat`](file:///c:/Kapila_store/Start%20Kapila.bat) to reload the running services.

---

## 📞 Interactive Health Check Command
Whenever in doubt, run:
```powershell
.\scripts\git_diagnose.ps1
```
or double-click **`Git Troubleshoot.bat`** for instant automated diagnosis.
