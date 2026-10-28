import './v2.css';
import Shell from '@/components/v2/Shell';

/** Every V2 screen sits in the same shell: navigation on the left, work on the right. */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>;
}
