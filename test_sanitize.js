function sanitizeFirestoreData(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === "object" && item !== null ? sanitizeFirestoreData(item) : item));
  }
  if (typeof obj === "object") {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        continue;
      }
      if (value !== null && typeof value === "object") {
        cleaned[key] = sanitizeFirestoreData(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
  return obj;
}
console.log(sanitizeFirestoreData({ location: undefined }));
