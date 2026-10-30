# Placement Management System

A full-stack college placement portal built on **Oracle Database**, with a Node.js/Express REST API and a React (Vite) frontend. It is an ADBMS project, so the database does the real work. Placements are created by triggers. Applications, interviews and offers are inserted through PL/SQL procedures. The placement percentage comes from a PL/SQL function, and two of the screens read from views.

```
placement-management-system/
├── backend/     Express API: config/, controllers/, middleware/, routes/, services/, validators/, scripts/
├── frontend/    React + Vite: components/, layouts/, pages/, services/, hooks/, routes/, styles/
├── database/    Oracle SQL scripts (schema, data, triggers, procedures, function, views, extensions)
└── start-dev.bat  Starts backend and frontend in two windows (Windows)
```

---

## 1. Prerequisites (Windows)

| Software | Version | Notes |
|---|---|---|
| Node.js | 18+ (tested on 24) | https://nodejs.org |
| Oracle Database | 11g XE or later | Tested on **Oracle Database 11g XE 11.2.0.2** |
| Oracle Client libraries | — | Oracle XE already includes them at `C:\oraclexe\app\oracle\product\11.2.0\server\bin` |

> **Why "thick" mode?** node-oracledb's default Thin mode needs Oracle 12.1 or later. For 11g, the backend loads the Oracle Client libraries that ship with XE. If your database is 12c or newer, set `ORACLE_DRIVER_MODE=thin` in `backend/.env` and leave `ORACLE_CLIENT_LIB_DIR` empty.

> **Oracle Live SQL** worksheets cannot be reached from a Node.js server. You need a database with a listener, such as a local XE install or a cloud Autonomous Database.

## 2. Database setup

The scripts in `database/` are your original `Placement_Management_Oracle_Setup.sql` split into files without changes, plus one additive extension file.

| File | Contents |
|---|---|
| `schema.sql` | 14 tables + sequences (unchanged) |
| `sample_data.sql` | Sample departments, students, companies, jobs, applications (unchanged) |
| `triggers.sql` | `TRG_CHECK_ELIGIBILITY`, `TRG_OFFER_APPLICATION`, `TRG_CREATE_PLACEMENT`, `TRG_APPLICATION_AUDIT`, `TRG_ONE_PLACEMENT_PER_STUDENT` (unchanged) |
| `procedures.sql` | `APPLY_FOR_JOB`, `SCHEDULE_INTERVIEW`, `CREATE_OFFER` (unchanged) |
| `functions.sql` | `PLACEMENT_PERCENTAGE` (unchanged) |
| `views.sql` | `STUDENT_APPLICATION_VIEW`, `PLACEMENT_DETAILS` (unchanged) |
| `extensions.sql` | **New, additive only.** `USER_ACCOUNT` and `STUDENT_RESUME` (see §7) |
| `create_user.sql` | Creates the `PLACEMENT` schema owner (run as SYSDBA) |
| `install.sql` | Runs all of the above in order |

From a Command Prompt in the `database` folder:

```bat
REM 1. Create the schema owner (choose your own password)
sqlplus / as sysdba @create_user.sql YourStrongPassword1

REM 2. Install tables, data, triggers, procedures, function, views and extensions
sqlplus placement/YourStrongPassword1@localhost:1521/XE @install.sql
```

You can also open `install.sql` in **SQL Developer** while connected as `placement` and run it with **F5**.

## 3. Backend setup

```bat
cd backend
npm install
copy .env.example .env
```

Edit `backend/.env`:

```ini
ORACLE_USER=placement
ORACLE_PASSWORD=YourStrongPassword1
ORACLE_CONNECT_STRING=localhost:1521/XE
ORACLE_DRIVER_MODE=thick
ORACLE_CLIENT_LIB_DIR=C:\oraclexe\app\oracle\product\11.2.0\server\bin
JWT_SECRET=<paste output of: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

Next, verify the database objects and create login accounts:

```bat
npm run check-db        REM lists every table/sequence/trigger/procedure/function/view and its status
npm run seed-accounts   REM creates a login for every student & officer, prints random passwords ONCE
```

To set or reset a single password later:

```bat
npm run create-account -- amit@college.edu MyNewPass123
```

Passwords are never stored in plain text. Only a bcrypt hash is saved in `USER_ACCOUNT`. Officers can also set student passwords from **Students → key icon**.

## 4. Run the application

**Easiest:** double-click `start-dev.bat` in the project root. Or start each server in its own terminal:

```bat
cd backend  && npm start          REM API on http://localhost:5000/api
cd frontend && npm install && npm run dev   REM UI on http://localhost:5173
```

Open **http://localhost:5173**. Choose the **Student** or **Placement Officer** tab and sign in with your email or college ID: the roll number (e.g. `CE001`) for students, or the employee ID (e.g. `PO001`) for officers.

**Production-style single server:** run `npm run build` in `frontend`, then `npm start` in `backend`. The backend serves the built app at http://localhost:5000.

## 5. Testing against Oracle

With the backend running:

```bat
cd backend
npm run test:flow
```

This end-to-end test makes 45 HTTP checks against the real database. It creates its own temporary officer, company, jobs and students (prefixed `ZZTEST…`) and deletes them afterwards, so the sample data is not touched. It verifies:

- **Authentication and roles:** login, wrong password, wrong role tab, unauthenticated access, and student-vs-officer authorization.
- **Data validation:** company and student validation, plus unique-constraint handling.
- **Eligibility:**
  - A missing required skill blocks the application.
  - `TRG_CHECK_ELIGIBILITY` rejects a student whose CGPA is too low (ORA-20001).
  - Backlogs are reported as unverifiable, never assumed.
- **Applications:** `APPLY_FOR_JOB` inserts the application, and `UQ_STUDENT_JOB` blocks a duplicate.
- **Interviews:** `SCHEDULE_INTERVIEW` creates the interview, and duplicate rounds and past dates are rejected. Interview feedback is hidden from students.
- **Offers and placements:**
  - `CREATE_OFFER` creates the offer, and `TRG_OFFER_APPLICATION` sets the application to `SELECTED`.
  - Accepting the offer makes `TRG_CREATE_PLACEMENT` create the placement.
  - `TRG_ONE_PLACEMENT_PER_STUDENT` blocks a second placement (ORA-20003), and the failed update is rolled back.
- **Audit:** `TRG_APPLICATION_AUDIT` writes the status history.
- **Dashboard and reports:** the dashboard uses `PLACEMENT_PERCENTAGE()`, and filtered reports return the right rows.
- **Delete protection:** records that other records depend on cannot be deleted.

### Manual test walkthrough

1. Sign in as the officer. Open **Applications** and **Shortlist** Aarav's Java Developer application. **Audit Logs** now shows the change.
2. Open **Interviews**, click **Schedule interview**, then use **Record result** to set it to Pass.
3. Open **Offers**, click **Create offer**, and choose the shortlisted application. The application becomes `SELECTED` through the trigger.
4. Sign in as Aarav. Open **Offers** and click **Accept**. **My Placement** now shows the placement created by `TRG_CREATE_PLACEMENT`.
5. Sign in as Rohan (CGPA 6.9). Add SQL under **My Skills** and try to apply to Java Developer. Oracle's trigger rejects the application, and the page shows the reason.

## 6. Oracle objects and where they are used

| Object | Used by |
|---|---|
| `APPLY_FOR_JOB` | `POST /api/applications` (`BEGIN APPLY_FOR_JOB(...)`) |
| `SCHEDULE_INTERVIEW` | `POST /api/interviews` |
| `CREATE_OFFER` | `POST /api/offers` |
| `PLACEMENT_PERCENTAGE` | `GET /api/dashboard/admin` (`BEGIN :pct := PLACEMENT_PERCENTAGE(); END;`) |
| `STUDENT_APPLICATION_VIEW` | Student dashboard "Recent applications" |
| `PLACEMENT_DETAILS` | Placements page, student placement, placement report |
| `TRG_CHECK_ELIGIBILITY` | Fires on every application insert. ORA-20001/20002 is shown to the student as a readable message |
| `TRG_OFFER_APPLICATION` | Fires on offer insert and sets the application to SELECTED |
| `TRG_CREATE_PLACEMENT` | Fires when an offer is ACCEPTED. **The backend never inserts placements itself** |
| `TRG_APPLICATION_AUDIT` | Fires on every status change and feeds the Audit Logs page and status history |
| `TRG_ONE_PLACEMENT_PER_STUDENT` | Blocks a second placement. ORA-20003 is shown as a readable message |

Oracle errors are translated in `backend/middleware/errorHandler.js`. For example, ORA-00001 on `UQ_STUDENT_JOB` becomes "This student has already applied for this job". The original ORA code is still included in the response `details`.

## 7. Design decisions and schema notes

- **Authentication (`USER_ACCOUNT`).** The supplied schema has nowhere to store credentials, so `extensions.sql` adds `USER_ACCOUNT`. It holds `person_id`, a bcrypt `password_hash`, a `role` of STUDENT or OFFICER, and `is_active`. The role is derived from the STUDENT and PLACEMENT_OFFICER tables, never taken from user input.
  - Sessions are signed JWTs in an `httpOnly`, `SameSite=Strict` cookie. They expire after 8 hours, or 7 days with "Keep me signed in".
  - Logins are rate-limited.
- **Resumes (`STUDENT_RESUME`).** Files are stored on disk in `backend/uploads` under random server-generated names. Only PDF, DOC and DOCX up to 5 MB are accepted. The table stores the original and stored file names; no file contents go into the database. When a student applies, `APPLICATION.resume_path` records the stored file name.
- **Drive open/closed status** is derived from `application_deadline` rather than a new column. A drive is open through the end of the deadline day. "Close drive" sets the deadline to yesterday, and you reopen a drive by editing the deadline.
- **Eligible branches and required skills** stay comma-separated text, as in the supplied schema. The UI picks the values from the DEPARTMENT and SKILL tables, so the text always matches real department and skill names exactly. A future improvement would be normalized `ELIGIBILITY_BRANCH` and `ELIGIBILITY_SKILL` tables.
- **Backlogs** are not stored for students anywhere in the schema. The eligibility checker therefore reports them as **"cannot be verified"** and never assumes zero. They do not block applications; the placement cell verifies them manually.
- **CGPA** is checked by Oracle (`TRG_CHECK_ELIGIBILITY`). The backend checks deadline, branch and skills before calling the procedure. If a student's CGPA is not recorded, the checker shows it as unknown instead of passing it.
- **Application status rules:**
  - Officers move applications between APPLIED, SHORTLISTED and REJECTED.
  - SELECTED is only reached through an offer, via the trigger.
  - WITHDRAWN can only be set by the student.
  - Offers can only be created for SHORTLISTED applications.
- **Offer decisions** can be recorded by the officer, or by the student for their own pending offer.
- **Interview feedback** is internal and is never sent to student accounts.
- **Audit "changed by"** is the Oracle `USER` recorded by the original trigger, which is the application's DB account. The trigger was left unchanged on purpose.
- **Deletes** are blocked when dependent rows exist. This covers companies with jobs, jobs with applications, and students with applications. Audit rows cannot be edited or deleted through the app.
- **Oracle 11g compatibility:** no `FETCH FIRST` or identity columns. Paging uses `ROWNUM` where needed, and sequences generate the IDs.

## 8. REST API

All endpoints are under `/api`. Every endpoint except `/health` and `/auth/login` requires a session. **(O)** marks officer-only endpoints. Students are always limited to their own records; the student ID comes from the session, never from the browser.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | DB connectivity check |
| POST | `/auth/login` | `{ identifier, password, role, remember }` |
| POST | `/auth/logout` | Clear session |
| GET | `/auth/me` | Current user |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` |
| GET | `/departments`, `/skills` | Lookups |
| POST | `/skills` (O) | Add skill to catalog |
| GET | `/officers` (O) | Placement officers |
| GET | `/students` (O) | All students with counts |
| POST | `/students` (O) | Create PERSON + STUDENT (+ optional login) in one transaction |
| GET | `/students/:id` | Full profile (`me` for the logged-in student) |
| PUT | `/students/:id` | Officers: all fields; students: phone & address only |
| DELETE | `/students/:id` (O) | Only if no applications/placements |
| PUT | `/students/:id/account` (O) | Set/reset login password |
| GET | `/students/:id/skills` | Skills |
| PUT/DELETE | `/students/:id/skills/:skillId` | Add/update (MERGE) or remove a skill |
| POST/GET | `/students/:id/resume` | Upload (multipart `resume`) / download |
| GET/POST | `/companies` | List / create (O) |
| GET/PUT/DELETE | `/companies/:id` | Detail with jobs & stats / update (O) / delete (O) |
| GET/POST | `/jobs` | List (students also get eligibility + own status) / create with eligibility (O) |
| GET/PUT/DELETE | `/jobs/:id` | Detail (+ applicants for O) / update (O) / delete (O) |
| PATCH | `/jobs/:id/close` (O) | Close drive |
| GET/PUT | `/jobs/:id/eligibility` | Criteria / update (O) |
| GET | `/jobs/:id/eligibility/:studentId` | Eligibility check (`me` for students) |
| GET | `/jobs/:id/eligibility-matrix` (O) | Every student's eligibility for a job |
| GET/POST | `/applications` | List (own for students; `?jobId=&status=`) / apply (student) |
| GET | `/applications/:id` | Detail with audit history |
| PATCH | `/applications/:id/status` | `{ status }` (rules in §7) |
| GET/POST | `/interviews` | List / schedule (O) |
| PUT/DELETE | `/interviews/:id` (O) | Update incl. result & feedback / cancel pending |
| GET/POST | `/offers` | List / create (O) |
| PUT | `/offers/:id` (O) | Edit pending offer |
| PATCH | `/offers/:id/status` | `{ status: ACCEPTED or REJECTED }` |
| GET | `/placements`, `/placements/:id` | From PLACEMENT_DETAILS |
| GET | `/dashboard/admin` (O), `/dashboard/student` | Dashboard data |
| GET | `/reports` (O) | Report catalog |
| GET | `/reports/:type` (O) | `?from=&to=&deptId=&companyId=&jobId=&status=` |
| GET | `/audit-logs` (O) | APPLICATION_AUDIT with context |

Report types: `students`, `department-students`, `company-jobs`, `job-applications`, `eligibility`, `shortlist-reject`, `interviews`, `pending-offers`, `offer-decisions`, `placements`, `package-wise`, `department-placement`, `audit`. You can export each report to CSV or print it from the Reports page.

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `DPI-1047: Cannot locate a 64-bit Oracle Client library` | Set `ORACLE_CLIENT_LIB_DIR` to the folder containing `oci.dll`, or add that folder to `PATH` |
| `ORA-12541: TNS:no listener` | Start the `OracleXETNSListener` and `OracleServiceXE` Windows services |
| `ORA-01017: invalid username/password` | Check `ORACLE_USER` / `ORACLE_PASSWORD` in `backend/.env` |
| Frontend shows "Cannot reach the server" | The backend is not running on port 5000 |
| Login says "account not found" | Run `npm run seed-accounts` or `npm run create-account` |

## 10. Security notes

- `.env` files and `backend/uploads/` are git-ignored. Only `.env.example` files with placeholders belong in the repository.
- All SQL uses bind variables. The only values interpolated into SQL text are fixed column names chosen by the server.
- The browser never connects to Oracle, and database credentials never reach the frontend.
- Authorization is enforced on the server for every endpoint. The frontend route guards are only for user experience.
