-- Master install script. Run while connected as the schema owner:
--   sqlplus placement/<password>@localhost:1521/XE @install.sql
-- Order matches the original setup script (sample data before triggers).
SET DEFINE OFF
WHENEVER SQLERROR CONTINUE
@@schema.sql
@@sample_data.sql
@@triggers.sql
@@procedures.sql
@@functions.sql
@@views.sql
@@extensions.sql
SHOW ERRORS
