-- TRIGGERS (unchanged from Placement_Management_Oracle_Setup.sql)
CREATE OR REPLACE TRIGGER trg_check_eligibility
BEFORE INSERT ON APPLICATION
FOR EACH ROW
DECLARE
    v_cgpa STUDENT.cgpa%TYPE;
    v_min_cgpa ELIGIBILITY.min_cgpa%TYPE;
BEGIN
    SELECT cgpa INTO v_cgpa FROM STUDENT WHERE person_id = :NEW.student_id;
    SELECT min_cgpa INTO v_min_cgpa FROM ELIGIBILITY WHERE job_id = :NEW.job_id;
    IF v_cgpa < v_min_cgpa THEN
        RAISE_APPLICATION_ERROR(-20001,'Student is not eligible. Minimum CGPA required: ' || v_min_cgpa);
    END IF;
EXCEPTION
    WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20002,'Student or eligibility record not found.');
END;
/

CREATE OR REPLACE TRIGGER trg_offer_application
AFTER INSERT ON OFFER
FOR EACH ROW
BEGIN
    UPDATE APPLICATION SET status = 'SELECTED'
    WHERE application_id = :NEW.application_id;
END;
/

CREATE OR REPLACE TRIGGER trg_create_placement
AFTER UPDATE OF offer_status ON OFFER
FOR EACH ROW
DECLARE
    v_student_id NUMBER;
    v_company_id NUMBER;
BEGIN
    IF :NEW.offer_status = 'ACCEPTED' AND NVL(:OLD.offer_status,'PENDING') <> 'ACCEPTED' THEN
        SELECT a.student_id, j.company_id
        INTO v_student_id, v_company_id
        FROM APPLICATION a
        JOIN JOB_POSTING j ON a.job_id = j.job_id
        WHERE a.application_id = :NEW.application_id;

        INSERT INTO PLACEMENT
        (placement_id, offer_id, student_id, company_id, placed_on, joining_date, package_lpa, placement_status)
        VALUES
        (placement_seq.NEXTVAL, :NEW.offer_id, v_student_id, v_company_id,
         SYSDATE, :NEW.joining_date, :NEW.offered_salary_lpa, 'CONFIRMED');
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_application_audit
AFTER UPDATE OF status ON APPLICATION
FOR EACH ROW
BEGIN
    IF NVL(:OLD.status,'#') <> NVL(:NEW.status,'#') THEN
        INSERT INTO APPLICATION_AUDIT
        VALUES (audit_seq.NEXTVAL,:NEW.application_id,:OLD.status,:NEW.status,SYSDATE,USER);
    END IF;
END;
/

CREATE OR REPLACE TRIGGER trg_one_placement_per_student
BEFORE INSERT ON PLACEMENT
FOR EACH ROW
DECLARE
    v_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM PLACEMENT WHERE student_id = :NEW.student_id;
    IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20003,'Student already has a placement.');
    END IF;
END;
/
