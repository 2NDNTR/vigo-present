import PresentClient from './PresentClient';

export default async function PresentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PresentClient id={id} />;
}
