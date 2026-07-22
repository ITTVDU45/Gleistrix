import FinanceCategory from '@/lib/models/FinanceCategory'

export const DEFAULT_FINANCE_CATEGORIES = [
  { slug: 'umsatz', name: 'Umsatz', direction: 'income', color: '#2563eb' },
  { slug: 'personalkosten', name: 'Interne Personalkosten', direction: 'expense', color: '#7c3aed' },
  { slug: 'subunternehmer', name: 'Subunternehmer', direction: 'expense', color: '#db2777' },
  { slug: 'fahrzeuge', name: 'Fahrzeuge', direction: 'expense', color: '#ea580c' },
  { slug: 'material', name: 'Material', direction: 'expense', color: '#ca8a04' },
  { slug: 'miete', name: 'Miete & Standorte', direction: 'expense', color: '#0891b2' },
  { slug: 'versicherung', name: 'Versicherungen', direction: 'expense', color: '#0d9488' },
  { slug: 'sonstiges', name: 'Sonstiges', direction: 'both', color: '#64748b' },
] as const

export async function ensureDefaultFinanceCategories() {
  await Promise.all(DEFAULT_FINANCE_CATEGORIES.map(category => FinanceCategory.updateOne(
    { slug: category.slug },
    { $setOnInsert: { ...category, isSystem: true, isActive: true } },
    { upsert: true }
  )))
}
