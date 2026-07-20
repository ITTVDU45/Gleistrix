import { MongoClient } from 'mongodb'
import { readFileSync } from 'fs'

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
const MONGODB_URI = envText
  .split('\n')
  .find((l) => l.startsWith('MONGODB_URI'))
  ?.split('=')
  .slice(1)
  .join('=')
  .replace(/^"|"$/g, '')

if (!MONGODB_URI) {
  console.error('MONGODB_URI not found in .env.local')
  process.exit(1)
}

function getEasterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmt(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getGermanHolidays(year) {
  const easter = getEasterSunday(year)
  const holidays = []

  const fixed = [
    { date: `${year}-01-01`, name: 'Neujahr', bundesland: 'ALL' },
    { date: `${year}-01-06`, name: 'Heilige Drei Könige', bundesland: 'BW,BY,ST' },
    { date: `${year}-03-08`, name: 'Internationaler Frauentag', bundesland: 'BE,MV' },
    { date: `${year}-05-01`, name: 'Tag der Arbeit', bundesland: 'ALL' },
    { date: `${year}-08-08`, name: 'Friedensfest', bundesland: 'BY' },
    { date: `${year}-08-15`, name: 'Mariä Himmelfahrt', bundesland: 'BY,SL' },
    { date: `${year}-09-20`, name: 'Weltkindertag', bundesland: 'TH' },
    { date: `${year}-10-03`, name: 'Tag der Deutschen Einheit', bundesland: 'ALL' },
    { date: `${year}-10-31`, name: 'Reformationstag', bundesland: 'BB,HB,HH,MV,NI,SN,SH,TH' },
    { date: `${year}-11-01`, name: 'Allerheiligen', bundesland: 'BW,BY,NW,RP,SL' },
    { date: `${year}-12-25`, name: '1. Weihnachtstag', bundesland: 'ALL' },
    { date: `${year}-12-26`, name: '2. Weihnachtstag', bundesland: 'ALL' },
  ]

  const easterBased = [
    { offset: -2, name: 'Karfreitag', bundesland: 'ALL' },
    { offset: 1, name: 'Ostermontag', bundesland: 'ALL' },
    { offset: 39, name: 'Christi Himmelfahrt', bundesland: 'ALL' },
    { offset: 50, name: 'Pfingstmontag', bundesland: 'ALL' },
    { offset: 60, name: 'Fronleichnam', bundesland: 'BW,BY,HE,NW,RP,SL' },
  ]

  holidays.push(...fixed)

  for (const { offset, name, bundesland } of easterBased) {
    holidays.push({ date: fmt(addDays(easter, offset)), name, bundesland })
  }

  // Buß- und Bettag (Mittwoch vor dem 23.11.)
  const nov23 = new Date(year, 10, 23)
  const dayOfWeek = nov23.getDay()
  const daysBack = dayOfWeek >= 3 ? dayOfWeek - 3 : dayOfWeek + 4
  const bbt = addDays(nov23, -daysBack)
  holidays.push({ date: fmt(bbt), name: 'Buß- und Bettag', bundesland: 'SN' })

  return holidays.sort((a, b) => a.date.localeCompare(b.date))
}

async function main() {
  const client = new MongoClient(MONGODB_URI)
  await client.connect()
  const db = client.db()
  const col = db.collection('holidays')

  const years = [2026, 2027]
  let inserted = 0

  for (const year of years) {
    const holidays = getGermanHolidays(year)
    for (const h of holidays) {
      const exists = await col.findOne({ date: h.date, name: h.name })
      if (!exists) {
        await col.insertOne(h)
        inserted++
        console.log(`+ ${h.date} ${h.name} (${h.bundesland})`)
      } else {
        console.log(`  ${h.date} ${h.name} (bereits vorhanden)`)
      }
    }
  }

  console.log(`\n${inserted} Feiertage eingefügt.`)
  console.log('Total in DB:', await col.countDocuments())
  await client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
