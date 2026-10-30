-- Run once as SYSDBA to create the schema owner for the application:
--   sqlplus / as sysdba @create_user.sql <password>
-- The password is passed as an argument so it is never stored in this file.
CREATE USER placement IDENTIFIED BY "&1"
  DEFAULT TABLESPACE users
  TEMPORARY TABLESPACE temp
  QUOTA UNLIMITED ON users;
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE TRIGGER,
      CREATE PROCEDURE, CREATE VIEW TO placement;
EXIT
