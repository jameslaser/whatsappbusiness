import { CLINIC } from '../config.js';
import { fmtDate, fmtTime } from './dates.js';

export const VARS = ['name', 'date', 'time', 'areas', 'clinic'];

export function varsIn(body) {
  return [...String(body || '').matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)].map((m) => m[1]);
}

export function unknownVars(body) {
  return [...new Set(varsIn(body).filter((v) => !VARS.includes(v)))];
}

export function render(body, vars) {
  return String(body || '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (all, k) => (VARS.includes(k) ? String(vars[k] ?? '') : all));
}

export function areaNames(codes, areas, lang) {
  const by = new Map(areas.map((a) => [a.code, a]));
  return (codes || [])
    .map((c) => by.get(c))
    .filter(Boolean)
    .map((a) => (lang === 'ar' ? a.name_ar : a.name_en))
    .join(lang === 'ar' ? '، ' : ', ');
}

// Values for {{name}} {{date}} {{time}} {{areas}} {{clinic}}. Appointment fields are empty when there is no appointment.
export function buildVars({ client, appointment, areas }, lang) {
  return {
    name: client ? client.full_name : '',
    date: appointment && appointment.scheduled_at ? fmtDate(appointment.scheduled_at, lang) : '',
    time: appointment && appointment.scheduled_at ? fmtTime(appointment.scheduled_at, lang) : '',
    areas: appointment ? areaNames(appointment.area_codes, areas || [], lang) : '',
    clinic: CLINIC.brand
  };
}

export function sampleVars(lang) {
  const iso = '2026-12-01T17:30:00+03:00';
  return {
    name: lang === 'ar' ? 'محمد' : 'Mohammed',
    date: fmtDate(iso, lang),
    time: fmtTime(iso, lang),
    areas: lang === 'ar' ? 'خط اللحية، الإبطان' : 'Beard line, Underarms',
    clinic: CLINIC.brand
  };
}
