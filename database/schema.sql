-- PLACEMENT MANAGEMENT SYSTEM - TABLES AND SEQUENCES
-- Taken unchanged from Placement_Management_Oracle_Setup.sql

CREATE TABLE PERSON (
    person_id NUMBER PRIMARY KEY,
    name VARCHAR2(100) NOT NULL,
    email VARCHAR2(100) UNIQUE NOT NULL,
    phone VARCHAR2(15),
    address VARCHAR2(200)
);
CREATE SEQUENCE person_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE DEPARTMENT (
    dept_id NUMBER PRIMARY KEY,
    dept_name VARCHAR2(100) NOT NULL UNIQUE,
    hod_name VARCHAR2(100),
    hod_email VARCHAR2(100),
    contact_no VARCHAR2(15)
);
CREATE SEQUENCE department_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE STUDENT (
    person_id NUMBER PRIMARY KEY,
    roll_no VARCHAR2(30) UNIQUE NOT NULL,
    cgpa NUMBER(3,2),
    batch_year NUMBER(4),
    gender VARCHAR2(10),
    dept_id NUMBER NOT NULL,
    CONSTRAINT fk_student_person FOREIGN KEY (person_id) REFERENCES PERSON(person_id),
    CONSTRAINT fk_student_department FOREIGN KEY (dept_id) REFERENCES DEPARTMENT(dept_id),
    CONSTRAINT chk_student_cgpa CHECK (cgpa BETWEEN 0 AND 10)
);

CREATE TABLE PLACEMENT_OFFICER (
    person_id NUMBER PRIMARY KEY,
    employee_id VARCHAR2(30) UNIQUE NOT NULL,
    designation VARCHAR2(50),
    CONSTRAINT fk_officer_person FOREIGN KEY (person_id) REFERENCES PERSON(person_id)
);

CREATE TABLE COMPANY (
    company_id NUMBER PRIMARY KEY,
    company_name VARCHAR2(150) NOT NULL,
    industry VARCHAR2(100),
    website VARCHAR2(200),
    location VARCHAR2(150),
    contact_person VARCHAR2(100),
    contact_email VARCHAR2(100),
    phone VARCHAR2(15)
);
CREATE SEQUENCE company_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE SKILL (
    skill_id NUMBER PRIMARY KEY,
    skill_name VARCHAR2(100) UNIQUE NOT NULL,
    category VARCHAR2(100),
    description VARCHAR2(300)
);
CREATE SEQUENCE skill_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE STUDENT_SKILL (
    student_id NUMBER,
    skill_id NUMBER,
    proficiency_level VARCHAR2(30),
    certification VARCHAR2(150),
    CONSTRAINT pk_student_skill PRIMARY KEY (student_id, skill_id),
    CONSTRAINT fk_ss_student FOREIGN KEY (student_id) REFERENCES STUDENT(person_id),
    CONSTRAINT fk_ss_skill FOREIGN KEY (skill_id) REFERENCES SKILL(skill_id)
);

CREATE TABLE JOB_POSTING (
    job_id NUMBER PRIMARY KEY,
    company_id NUMBER NOT NULL,
    job_title VARCHAR2(150) NOT NULL,
    job_type VARCHAR2(50),
    description VARCHAR2(500),
    salary_lpa NUMBER(6,2),
    location VARCHAR2(150),
    vacancies NUMBER NOT NULL,
    drive_date DATE,
    application_deadline DATE,
    CONSTRAINT fk_job_company FOREIGN KEY (company_id) REFERENCES COMPANY(company_id),
    CONSTRAINT chk_job_vacancies CHECK (vacancies > 0)
);
CREATE SEQUENCE job_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE ELIGIBILITY (
    job_id NUMBER PRIMARY KEY,
    min_cgpa NUMBER(3,2),
    eligible_branches VARCHAR2(300),
    skills_required VARCHAR2(300),
    backlogs_allowed NUMBER DEFAULT 0,
    CONSTRAINT fk_eligibility_job FOREIGN KEY (job_id) REFERENCES JOB_POSTING(job_id),
    CONSTRAINT chk_eligibility_cgpa CHECK (min_cgpa BETWEEN 0 AND 10)
);

CREATE TABLE APPLICATION (
    application_id NUMBER PRIMARY KEY,
    student_id NUMBER NOT NULL,
    job_id NUMBER NOT NULL,
    apply_date DATE DEFAULT SYSDATE,
    status VARCHAR2(30) DEFAULT 'APPLIED',
    resume_path VARCHAR2(300),
    CONSTRAINT fk_application_student FOREIGN KEY (student_id) REFERENCES STUDENT(person_id),
    CONSTRAINT fk_application_job FOREIGN KEY (job_id) REFERENCES JOB_POSTING(job_id),
    CONSTRAINT uq_student_job UNIQUE (student_id, job_id),
    CONSTRAINT chk_application_status CHECK (status IN ('APPLIED','SHORTLISTED','REJECTED','SELECTED','WITHDRAWN'))
);
CREATE SEQUENCE application_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE INTERVIEW (
    interview_id NUMBER PRIMARY KEY,
    application_id NUMBER NOT NULL,
    officer_id NUMBER NOT NULL,
    interview_date DATE,
    interview_type VARCHAR2(50),
    round_no NUMBER,
    result VARCHAR2(30),
    feedback VARCHAR2(500),
    CONSTRAINT fk_interview_application FOREIGN KEY (application_id) REFERENCES APPLICATION(application_id),
    CONSTRAINT fk_interview_officer FOREIGN KEY (officer_id) REFERENCES PLACEMENT_OFFICER(person_id),
    CONSTRAINT chk_interview_result CHECK (result IN ('PENDING','PASS','FAIL'))
);
CREATE SEQUENCE interview_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE OFFER (
    offer_id NUMBER PRIMARY KEY,
    application_id NUMBER NOT NULL,
    offer_date DATE DEFAULT SYSDATE,
    joining_date DATE,
    offered_salary_lpa NUMBER(6,2),
    ctc NUMBER(6,2),
    offer_status VARCHAR2(30) DEFAULT 'PENDING',
    CONSTRAINT fk_offer_application FOREIGN KEY (application_id) REFERENCES APPLICATION(application_id),
    CONSTRAINT uq_offer_application UNIQUE (application_id),
    CONSTRAINT chk_offer_status CHECK (offer_status IN ('PENDING','ACCEPTED','REJECTED'))
);
CREATE SEQUENCE offer_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE PLACEMENT (
    placement_id NUMBER PRIMARY KEY,
    offer_id NUMBER NOT NULL,
    student_id NUMBER NOT NULL,
    company_id NUMBER NOT NULL,
    placed_on DATE DEFAULT SYSDATE,
    joining_date DATE,
    package_lpa NUMBER(6,2),
    placement_status VARCHAR2(30) DEFAULT 'CONFIRMED',
    CONSTRAINT fk_placement_offer FOREIGN KEY (offer_id) REFERENCES OFFER(offer_id),
    CONSTRAINT fk_placement_student FOREIGN KEY (student_id) REFERENCES STUDENT(person_id),
    CONSTRAINT fk_placement_company FOREIGN KEY (company_id) REFERENCES COMPANY(company_id),
    CONSTRAINT uq_placement_offer UNIQUE (offer_id),
    CONSTRAINT uq_placement_student UNIQUE (student_id)
);
CREATE SEQUENCE placement_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE APPLICATION_AUDIT (
    audit_id NUMBER PRIMARY KEY,
    application_id NUMBER,
    old_status VARCHAR2(30),
    new_status VARCHAR2(30),
    changed_on DATE,
    changed_by VARCHAR2(100)
);
CREATE SEQUENCE audit_seq START WITH 1 INCREMENT BY 1;
