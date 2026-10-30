class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Friendly messages for the named constraints in the supplied schema.
const CONSTRAINT_MESSAGES = {
  UQ_STUDENT_JOB: 'This student has already applied for this job.',
  UQ_OFFER_APPLICATION: 'An offer already exists for this application.',
  UQ_PLACEMENT_OFFER: 'A placement already exists for this offer.',
  UQ_PLACEMENT_STUDENT: 'This student already has a confirmed placement.',
  UQ_ACCOUNT_PERSON: 'A login account already exists for this person.',
  PK_STUDENT_SKILL: 'This skill is already added to the profile.',
  CHK_STUDENT_CGPA: 'CGPA must be between 0 and 10.',
  CHK_ELIGIBILITY_CGPA: 'Minimum CGPA must be between 0 and 10.',
  CHK_JOB_VACANCIES: 'Vacancies must be greater than zero.',
  CHK_APPLICATION_STATUS: 'Invalid application status.',
  CHK_INTERVIEW_RESULT: 'Interview result must be PENDING, PASS or FAIL.',
  CHK_OFFER_STATUS: 'Offer status must be PENDING, ACCEPTED or REJECTED.',
};

function constraintName(message) {
  const match = /\(([A-Z0-9_$#]+)\.([A-Z0-9_$#]+)\)/.exec(message || '');
  return match ? match[2] : null;
}

// Pull the RAISE_APPLICATION_ERROR text out of "ORA-20001: text\nORA-06512: ..."
function applicationErrorText(message) {
  const first = (message || '').split('\n')[0];
  return first.replace(/^ORA-\d{5}:\s*/, '').trim();
}

function mapOracleError(err) {
  const code = err.errorNum;
  const name = constraintName(err.message);
  switch (code) {
    case 1: {
      if (name && CONSTRAINT_MESSAGES[name]) return new AppError(409, CONSTRAINT_MESSAGES[name], { oracle: 'ORA-00001', constraint: name });
      // Unnamed system constraints (e.g. PERSON.email UNIQUE) get a generic message.
      return new AppError(409, 'A record with the same unique value (such as email, roll number or name) already exists.', { oracle: 'ORA-00001', constraint: name });
    }
    case 2290:
      return new AppError(400, CONSTRAINT_MESSAGES[name] || 'A value violates a database check constraint.', { oracle: 'ORA-02290', constraint: name });
    case 2291:
      return new AppError(400, 'A referenced record (student, job, company, officer or skill) does not exist.', { oracle: 'ORA-02291', constraint: name });
    case 2292:
      return new AppError(409, 'This record cannot be deleted because other records depend on it.', { oracle: 'ORA-02292', constraint: name });
    case 1400:
      return new AppError(400, 'A required value is missing.', { oracle: 'ORA-01400' });
    case 12899:
      return new AppError(400, 'A value is too long for its database column.', { oracle: 'ORA-12899' });
    case 1438:
      return new AppError(400, 'A numeric value is larger than the database column allows.', { oracle: 'ORA-01438' });
    case 20001:
    case 20002:
    case 20003:
      // Raised by the project's PL/SQL triggers.
      return new AppError(422, applicationErrorText(err.message), { oracle: `ORA-${code}`, source: 'trigger' });
    case 4091:
      return new AppError(500, 'Oracle reported a mutating-table error in a trigger.', { oracle: 'ORA-04091' });
    case 1017:
      return new AppError(503, 'The backend could not log in to Oracle. Check ORACLE_USER and ORACLE_PASSWORD.', { oracle: 'ORA-01017' });
    case 12541:
    case 12514:
    case 12505:
    case 12170:
      return new AppError(503, 'The Oracle database is not reachable. Check that the listener and database are running.', { oracle: `ORA-${code}` });
    default:
      return null;
  }
}

function notFound(req, res) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let appErr = err instanceof AppError ? err : null;
  if (!appErr && err && err.errorNum) appErr = mapOracleError(err);
  if (!appErr && err && /^(DPI|NJS)-/.test(err.message || '')) {
    appErr = new AppError(503, 'Database driver error. Check the Oracle client installation and connection settings.');
  }
  if (!appErr && err && err.type === 'entity.parse.failed') appErr = new AppError(400, 'Malformed JSON request body.');
  if (!appErr && err && err.name === 'MulterError') {
    appErr = new AppError(400, err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 5 MB).' : err.message);
  }

  if (!appErr) {
    console.error('[unhandled]', err);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  }
  if (appErr.status >= 500) console.error('[error]', err.message);
  const body = { error: appErr.message };
  if (appErr.details) body.details = appErr.details;
  return res.status(appErr.status).json(body);
}

module.exports = { AppError, errorHandler, notFound, mapOracleError };
