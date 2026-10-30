const { AppError } = require('../middleware/errorHandler');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+]?[0-9][0-9\s-]{5,13}[0-9]$/;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;

/**
 * Small declarative validator. rules: { field: { type, required, max, min, maxNum, enum, label } }
 * Returns a cleaned object containing only declared fields. Throws AppError(400) listing every problem.
 */
function validate(input, rules, { partial = false } = {}) {
  const body = input || {};
  const errors = {};
  const out = {};

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    let value = body[field];
    const present = value !== undefined;
    if (partial && !present) continue;

    if (typeof value === 'string') value = value.trim();
    const empty = value === undefined || value === null || value === '';

    if (empty) {
      if (rule.required) errors[field] = `${label} is required.`;
      else out[field] = null;
      continue;
    }

    switch (rule.type) {
      case 'string':
        value = String(value);
        if (rule.max && value.length > rule.max) errors[field] = `${label} must be at most ${rule.max} characters.`;
        if (rule.min && value.length < rule.min) errors[field] = `${label} must be at least ${rule.min} characters.`;
        break;
      case 'email':
        value = String(value).toLowerCase();
        if (!EMAIL_RE.test(value) || value.length > 100) errors[field] = `${label} must be a valid email address.`;
        break;
      case 'phone':
        value = String(value);
        if (!PHONE_RE.test(value) || value.length > 15) errors[field] = `${label} must be a valid phone number (7-15 digits).`;
        break;
      case 'url':
        value = String(value);
        if (!URL_RE.test(value) || value.length > (rule.max || 200)) errors[field] = `${label} must be a valid http(s) URL.`;
        break;
      case 'number':
      case 'integer': {
        const n = Number(value);
        if (!Number.isFinite(n)) { errors[field] = `${label} must be a number.`; break; }
        if (rule.type === 'integer' && !Number.isInteger(n)) { errors[field] = `${label} must be a whole number.`; break; }
        if (rule.min !== undefined && n < rule.min) errors[field] = `${label} must be at least ${rule.min}.`;
        if (rule.maxNum !== undefined && n > rule.maxNum) errors[field] = `${label} must be at most ${rule.maxNum}.`;
        value = n;
        break;
      }
      case 'date': {
        // Accept YYYY-MM-DD (local midnight) or a full ISO / datetime-local string.
        const s = String(value);
        let d;
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        else d = new Date(s);
        if (Number.isNaN(d.getTime())) errors[field] = `${label} must be a valid date.`;
        value = d;
        break;
      }
      case 'enum':
        value = String(value).toUpperCase();
        if (!rule.enum.includes(value)) errors[field] = `${label} must be one of ${rule.enum.join(', ')}.`;
        break;
      default:
        break;
    }
    if (rule.enum && rule.type !== 'enum' && !rule.enum.includes(value)) {
      errors[field] = `${label} must be one of ${rule.enum.join(', ')}.`;
    }
    out[field] = value;
  }

  if (Object.keys(errors).length) {
    throw new AppError(400, Object.values(errors)[0], { fields: errors });
  }
  return out;
}

function parseId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(400, `Invalid ${label}.`);
  return n;
}

module.exports = { validate, parseId, EMAIL_RE };
