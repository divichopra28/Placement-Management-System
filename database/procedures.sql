-- PROCEDURES (unchanged from Placement_Management_Oracle_Setup.sql)
CREATE OR REPLACE PROCEDURE APPLY_FOR_JOB (
    p_student_id NUMBER,
    p_job_id NUMBER,
    p_resume VARCHAR2
)
AS
BEGIN
    INSERT INTO APPLICATION
    (application_id,student_id,job_id,apply_date,status,resume_path)
    VALUES
    (application_seq.NEXTVAL,p_student_id,p_job_id,SYSDATE,'APPLIED',p_resume);
    COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE SCHEDULE_INTERVIEW (
    p_application_id NUMBER,
    p_officer_id NUMBER,
    p_interview_date DATE,
    p_interview_type VARCHAR2,
    p_round NUMBER
)
AS
BEGIN
    INSERT INTO INTERVIEW
    (interview_id,application_id,officer_id,interview_date,interview_type,round_no,result)
    VALUES
    (interview_seq.NEXTVAL,p_application_id,p_officer_id,p_interview_date,p_interview_type,p_round,'PENDING');
    COMMIT;
END;
/

CREATE OR REPLACE PROCEDURE CREATE_OFFER (
    p_application_id NUMBER,
    p_salary NUMBER,
    p_ctc NUMBER,
    p_joining_date DATE
)
AS
BEGIN
    INSERT INTO OFFER
    (offer_id,application_id,offer_date,joining_date,offered_salary_lpa,ctc,offer_status)
    VALUES
    (offer_seq.NEXTVAL,p_application_id,SYSDATE,p_joining_date,p_salary,p_ctc,'PENDING');
    COMMIT;
END;
/
