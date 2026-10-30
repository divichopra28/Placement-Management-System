-- SAMPLE DATA (unchanged from Placement_Management_Oracle_Setup.sql)
INSERT INTO DEPARTMENT VALUES (department_seq.NEXTVAL,'Computer Engineering','Dr. Sharma','hodce@college.edu','0253-123456');
INSERT INTO DEPARTMENT VALUES (department_seq.NEXTVAL,'Information Technology','Dr. Patil','hodit@college.edu','0253-123457');
INSERT INTO DEPARTMENT VALUES (department_seq.NEXTVAL,'Electronics Engineering','Dr. Mehta','hodec@college.edu','0253-123458');

INSERT INTO PERSON VALUES (person_seq.NEXTVAL,'Aarav Sharma','aarav@gmail.com','9876543210','Mumbai');
INSERT INTO PERSON VALUES (person_seq.NEXTVAL,'Priya Patil','priya@gmail.com','9876543211','Nashik');
INSERT INTO PERSON VALUES (person_seq.NEXTVAL,'Rohan Deshmukh','rohan@gmail.com','9876543212','Pune');
INSERT INTO PERSON VALUES (person_seq.NEXTVAL,'Neha Joshi','neha@gmail.com','9876543213','Mumbai');
INSERT INTO PERSON VALUES (person_seq.NEXTVAL,'Dr. Amit Kulkarni','amit@college.edu','9876543299','Nashik');

INSERT INTO STUDENT VALUES (1,'CE001',8.50,2027,'F',1);
INSERT INTO STUDENT VALUES (2,'IT002',7.80,2027,'F',2);
INSERT INTO STUDENT VALUES (3,'CE003',6.90,2027,'M',1);
INSERT INTO STUDENT VALUES (4,'IT004',9.10,2027,'F',2);
INSERT INTO PLACEMENT_OFFICER VALUES (5,'PO001','Placement Coordinator');

INSERT INTO SKILL VALUES (skill_seq.NEXTVAL,'Java','Programming','Object oriented programming');
INSERT INTO SKILL VALUES (skill_seq.NEXTVAL,'Python','Programming','Python programming');
INSERT INTO SKILL VALUES (skill_seq.NEXTVAL,'SQL','Database','SQL and database management');
INSERT INTO SKILL VALUES (skill_seq.NEXTVAL,'DBMS','Database','Database management systems');
INSERT INTO SKILL VALUES (skill_seq.NEXTVAL,'HTML/CSS','Web Development','Frontend development');
INSERT INTO SKILL VALUES (skill_seq.NEXTVAL,'JavaScript','Web Development','Web programming');

INSERT INTO STUDENT_SKILL VALUES (1,1,'Advanced','Java Certification');
INSERT INTO STUDENT_SKILL VALUES (1,3,'Advanced','SQL Certification');
INSERT INTO STUDENT_SKILL VALUES (2,2,'Intermediate',NULL);
INSERT INTO STUDENT_SKILL VALUES (2,3,'Advanced','SQL Certification');
INSERT INTO STUDENT_SKILL VALUES (3,1,'Intermediate',NULL);
INSERT INTO STUDENT_SKILL VALUES (4,2,'Advanced','Python Certification');
INSERT INTO STUDENT_SKILL VALUES (4,6,'Advanced','JavaScript Certification');

INSERT INTO COMPANY VALUES (company_seq.NEXTVAL,'TCS','IT Services','https://www.tcs.com','Mumbai','Rahul Mehta','rahul@tcs.com','9000000001');
INSERT INTO COMPANY VALUES (company_seq.NEXTVAL,'Infosys','IT Services','https://www.infosys.com','Pune','Sneha Rao','sneha@infosys.com','9000000002');
INSERT INTO COMPANY VALUES (company_seq.NEXTVAL,'Accenture','Consulting','https://www.accenture.com','Mumbai','Karan Shah','karan@accenture.com','9000000003');

INSERT INTO JOB_POSTING VALUES (job_seq.NEXTVAL,1,'Java Developer','Full Time','Java developer role',8.5,'Mumbai',5,DATE '2026-10-20',DATE '2026-10-15');
INSERT INTO JOB_POSTING VALUES (job_seq.NEXTVAL,2,'Software Engineer','Full Time','Software development role',7.5,'Pune',10,DATE '2026-10-22',DATE '2026-10-17');
INSERT INTO JOB_POSTING VALUES (job_seq.NEXTVAL,3,'Web Developer','Full Time','Frontend and backend development',9.0,'Mumbai',4,DATE '2026-10-25',DATE '2026-10-20');

INSERT INTO ELIGIBILITY VALUES (1,7.00,'Computer Engineering,Information Technology','Java,SQL',0);
INSERT INTO ELIGIBILITY VALUES (2,7.50,'Computer Engineering,Information Technology','Python,SQL',0);
INSERT INTO ELIGIBILITY VALUES (3,8.00,'Computer Engineering,Information Technology','HTML/CSS,JavaScript',0);

INSERT INTO APPLICATION VALUES (application_seq.NEXTVAL,1,1,SYSDATE,'APPLIED','aarav_resume.pdf');
INSERT INTO APPLICATION VALUES (application_seq.NEXTVAL,2,1,SYSDATE,'APPLIED','priya_resume.pdf');
INSERT INTO APPLICATION VALUES (application_seq.NEXTVAL,4,2,SYSDATE,'APPLIED','neha_resume.pdf');
COMMIT;
