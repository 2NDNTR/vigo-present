import { redirect } from 'next/navigation';

/** The V1 dashboard now lives at Overview. Old links and the editor's back button land there. */
export default function Dashboard(): never {
  return redirect('/');
}
