-- SCHEMA EXTENSIONS FOR THE WEB APPLICATION
-- These are ADDITIVE ONLY. No existing table, trigger, procedure, function or
-- view from the supplied script is altered.
--
-- 1. USER_ACCOUNT  - login credentials. The supplied schema has no place to
--                    store passwords, so this table holds a bcrypt hash
--                    (never plain text) for a PERSON plus the role.
-- 2. STUDENT_RESUME - a reference (not file contents) to the resume a student
--                    uploaded. Files are stored on the backend's disk; this
--                    table stores the original file name and the generated
--                    server-side file name.

CREATE TABLE USER_ACCOUNT (
    account_id NUMBER PRIMARY KEY,
    person_id NUMBER NOT NULL,
    password_hash VARCHAR2(100) NOT NULL,
    role VARCHAR2(20) NOT NULL,
    is_active CHAR(1) DEFAULT 'Y' NOT NULL,
    created_on DATE DEFAULT SYSDATE,
    last_login DATE,
    CONSTRAINT fk_account_person FOREIGN KEY (person_id) REFERENCES PERSON(person_id),
    CONSTRAINT uq_account_person UNIQUE (person_id),
    CONSTRAINT chk_account_role CHECK (role IN ('STUDENT','OFFICER')),
    CONSTRAINT chk_account_active CHECK (is_active IN ('Y','N'))
);
CREATE SEQUENCE account_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE STUDENT_RESUME (
    student_id NUMBER PRIMARY KEY,
    original_name VARCHAR2(255) NOT NULL,
    stored_name VARCHAR2(255) NOT NULL,
    uploaded_on DATE DEFAULT SYSDATE,
    CONSTRAINT fk_resume_student FOREIGN KEY (student_id) REFERENCES STUDENT(person_id)
);

COMMIT;
