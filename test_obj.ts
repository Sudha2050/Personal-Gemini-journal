const sanitize = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.filter(i => i !== undefined).map(i => typeof i === "object" && i !== null ? sanitize(i) : i);
  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) continue;
      if (value !== null && typeof value === "object") cleaned[key] = sanitize(value);
      else cleaned[key] = value;
    }
    return cleaned;
  }
  return obj;
};

const entry = { location: undefined, id: '123' };
const payload = sanitize({ ...entry });
console.log('payload keys:', Object.keys(payload));
