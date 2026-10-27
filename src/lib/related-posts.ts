interface TaggedPost {
  id: string;
  data: { tags: string[]; pubDate: Date; draft?: boolean };
}

export function getRelatedPosts<T extends TaggedPost>(current: T, posts: T[], limit = 3, now = new Date()): T[] {
  const normalize = (tag: string) => tag.trim().toLowerCase();
  const tags = new Set(current.data.tags.map(normalize));
  if (!tags.size) return [];
  return posts
    .filter(post => post.id !== current.id && !post.data.draft && post.data.pubDate <= now)
    .map(post => ({ post, score: [...new Set(post.data.tags.map(normalize))].filter(tag => tags.has(tag)).length }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.post.data.pubDate.getTime() - a.post.data.pubDate.getTime() || a.post.id.localeCompare(b.post.id))
    .slice(0, limit)
    .map(item => item.post);
}
