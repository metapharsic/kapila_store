# Database Backup and Migration Guide (Corrected for PostgreSQL)

## Why was `data.db` empty?
You were **100% correct to be suspicious**, and I sincerely apologize for my previous mistake. 

The `data.db` file you clicked on was completely empty because **your application does not use SQLite**. That file is an old, unused leftover file in your folder. Your Kapila application is actually powered by a professional **PostgreSQL** database running on your local machine! 

Because PostgreSQL is an external database service, your data isn't stored in a single simple file in your project folder—it is managed by the PostgreSQL server itself. 

## The Backup Has Been Created!
Your manager was completely right. To move this to a client machine, you MUST take a full SQL database export dump. 

I have just run the PostgreSQL export command (`pg_dump`) on your machine. I successfully extracted your entire live database (including every single table, PO, GRN, Indent, and Stock history) and saved it here:
**`backend/exports/kapila_database_backup.sql`**

Because it is a `.sql` file, it is plain text. **You can open this file directly in VS Code right now** to physically see all of your data and prove to yourself that it's all there!

---

## Step-by-Step Guide for Client Installation

### Step 1: Exporting the Code
1. Open your File Explorer.
2. Navigate to your `Kapila_Project` folder.
3. Select the entire folder, right-click, and choose **Compress to ZIP file**.
4. Transfer this ZIP file to the client machine.

### Step 2: Preparing the Client Machine
1. Install **Node.js** (v20+) on the client computer.
2. Install **PostgreSQL** on the client computer (make sure to set the password to something you know, e.g., `hamza200426`).
3. Open a terminal on the client machine and create the blank database:
   ```bash
   createdb -U postgres kapila
   ```
4. Unzip your project folder on the client machine.

### Step 3: Importing the Database (Crucial Step)
Now you will import the backup file I generated for you into the client's PostgreSQL server.
1. On the client machine, open a terminal inside the unzipped `backend` folder.
2. Run this command to inject the backup data into the database:
   ```bash
   psql -U postgres -d kapila -f ./exports/kapila_database_backup.sql
   ```
   *(It will ask for the Postgres password, type it in).*
   
By doing this, the client's PostgreSQL database will now be an exact, 100% accurate clone of your machine's database.

### Step 4: Start the Servers
1. Ensure the `backend/.env` file on the client machine has the correct `DATABASE_URL` pointing to their Postgres setup.
2. Open a terminal in the `backend` folder, run `npm install`, then run `npm run dev`.
3. Open a terminal in the `frontend` folder, run `npm install`, then run `npm run dev`.

Everything will now load perfectly with all of your live data!
