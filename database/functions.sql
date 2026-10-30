-- FUNCTION (unchanged from Placement_Management_Oracle_Setup.sql)
CREATE OR REPLACE FUNCTION PLACEMENT_PERCENTAGE
RETURN NUMBER
AS
    v_total NUMBER;
    v_placed NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_total FROM STUDENT;
    SELECT COUNT(*) INTO v_placed FROM PLACEMENT;
    IF v_total = 0 THEN RETURN 0; END IF;
    RETURN ROUND((v_placed / v_total) * 100,2);
END;
/
