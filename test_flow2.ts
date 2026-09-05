function sanitizeFirestoreData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === "object" && item !== null ? sanitizeFirestoreData(item) : item));
  }
  if (typeof obj === "object") {
    const cleaned: any = {};
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

const entry = { location: { city: undefined, name: "Test" }, id: '123' };
const payloadToStore = sanitizeFirestoreData({
  ...entry,
  userId: 'user1'
});

console.log(payloadToStore);
