import { Article } from '@/lib/models/Article'
import { ArticleUnit } from '@/lib/models/ArticleUnit'

export async function recalculateArticleStock(artikelId: string): Promise<number> {
  const count = await ArticleUnit.countDocuments({ artikelId, status: 'verfuegbar' })
  await Article.findByIdAndUpdate(artikelId, { bestand: count })
  return count
}
