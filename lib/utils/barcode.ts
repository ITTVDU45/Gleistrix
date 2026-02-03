import { customAlphabet } from 'nanoid'

const alphanumeric = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const nanoid8 = customAlphabet(alphanumeric, 8)

export function generateArticleBarcode(): string {
  return `ART-${nanoid8()}`
}
