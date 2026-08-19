import PublicClient from './PublicClient';

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <PublicClient slug={slug} />;
}
