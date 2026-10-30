-- VIEWS (unchanged from Placement_Management_Oracle_Setup.sql)
CREATE OR REPLACE VIEW STUDENT_APPLICATION_VIEW AS
SELECT s.person_id AS student_id, p.name AS student_name, s.roll_no,
       c.company_name, j.job_title, a.apply_date, a.status
FROM STUDENT s
JOIN PERSON p ON s.person_id = p.person_id
JOIN APPLICATION a ON s.person_id = a.student_id
JOIN JOB_POSTING j ON a.job_id = j.job_id
JOIN COMPANY c ON j.company_id = c.company_id;

CREATE OR REPLACE VIEW PLACEMENT_DETAILS AS
SELECT pl.placement_id, per.name AS student_name, c.company_name,
       j.job_title, pl.package_lpa, pl.joining_date, pl.placement_status
FROM PLACEMENT pl
JOIN STUDENT s ON pl.student_id = s.person_id
JOIN PERSON per ON s.person_id = per.person_id
JOIN COMPANY c ON pl.company_id = c.company_id
JOIN OFFER o ON pl.offer_id = o.offer_id
JOIN APPLICATION a ON o.application_id = a.application_id
JOIN JOB_POSTING j ON a.job_id = j.job_id;

COMMIT;
