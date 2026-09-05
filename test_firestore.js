import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const app = initializeApp({ projectId: 'test-project' });
const db = getFirestore(app);

try {
  setDoc(doc(db, 'col', 'doc'), { location: { city: undefined } });
} catch (e) {
  console.log(e.message);
}
