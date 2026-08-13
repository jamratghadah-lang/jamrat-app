import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { ImportGuestRow, formatZodIssues } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { badRequest, forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

interface ImportRow { name: string; phone: string; email: string; companions: number }

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { out.push(cur.trim()); cur = '' }
    else cur += ch
  }
  out.push(cur.trim())
  return out
}

function parseCsv(content: string): ImportRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim())
  const nameIdx = header.indexOf('name')
  if (nameIdx === -1) return []
  const phoneIdx = header.indexOf('phone')
  const emailIdx = header.indexOf('email')
  const companionsIdx = header.indexOf('companions')
  const rows: ImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const name = (cols[nameIdx] || '').trim()
    if (!name) continue
    rows.push({
      name,
      phone: phoneIdx >= 0 ? (cols[phoneIdx] || '').trim() : '',
      email: emailIdx >= 0 ? (cols[emailIdx] || '').trim() : '',
      companions: companionsIdx >= 0 ? parseInt(cols[companionsIdx] || '0', 10) || 0 : 0,
    })
  }
  return rows
}

function parseJsonGuests(content: string): ImportRow[] {
  const data = JSON.parse(content)
  const arr = Array.isArray(data) ? data : []
  return arr.map((item: Record<string, unknown>) => ({
    name: String(item.name || '').trim(),
    phone: String(item.phone || '').trim(),
    email: String(item.email || '').trim(),
    companions: parseInt(String(item.companions || '0'), 10) || 0,
  })).filter((r) => r.name.length > 0)
}

async function parseExcel(buffer: ArrayBuffer): Promise<ImportRow[]> {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  return jsonData.map((item) => ({
    name: String(item.name || item['الاسم'] || item['Name'] || '').trim(),
    phone: String(item.phone || item['الهاتف'] || item['Phone'] || '').trim(),
    email: String(item.email || item['البريد'] || item['Email'] || '').trim(),
    companions: parseInt(String(item.companions || item['المرافقين'] || item['Companions'] || '0'), 10) || 0,
  })).filter((r) => r.name.length > 0)
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const eventIdFromBody = formData.get('eventId') as string | null
    const mergeDuplicatesStr = formData.get('mergeDuplicates') as string | null
    const mergeDuplicates = mergeDuplicatesStr !== 'false' // default true

    const url = new URL(request.url)
    const eventId = eventIdFromBody || url.searchParams.get('eventId')
    if (!eventId) {
      return badRequest('معرف الحدث مطلوب (eventId)')
    }
    if (!file) {
      return badRequest('الملف مطلوب')
    }

    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    if (!(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة ضيوف هذه المناسبة')
    }

    const buffer = await file.arrayBuffer()
    const fileName = file.name.toLowerCase()
    let rows: ImportRow[]

    if (fileName.endsWith('.json')) {
      rows = parseJsonGuests(new TextDecoder().decode(buffer))
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      rows = await parseExcel(buffer)
    } else {
      rows = parseCsv(new TextDecoder('utf-8').decode(buffer))
    }

    if (rows.length === 0) {
      return NextResponse.json({ imported: 0, errors: 0, merged: 0, details: [], message: 'لا توجد بيانات صالحة في الملف' }, { status: 400 })
    }

    // Validate each row with Zod; collect errors per-row.
    const validRows: ImportRow[] = []
    type Detail = { row: number; name: string; status: 'imported' | 'duplicate_merged' | 'duplicate_skipped' | 'error'; error?: string; mergedCount?: number }
    const details: Detail[] = []
    let errors = 0
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const parsed = ImportGuestRow.safeParse(row)
      if (!parsed.success) {
        errors++
        details.push({ row: i + 2, name: row.name, status: 'error', error: formatZodIssues(parsed.error).error })
        continue
      }
      validRows.push(parsed.data)
    }

    const previewable = await previewImport(eventId, validRows, mergeDuplicates)
    if (url.searchParams.get('preview') === '1') {
      return NextResponse.json({ preview: true, ...previewable })
    }

    // Commit transactionally. Single round-trip so event guest counts
    // stay consistent even if the user aborts mid-import.
    let imported = 0, merged = 0
    await db.$transaction(async (tx) => {
      // PERFORMANCE (v10.8): batch inserts with createMany instead of
      // one create() per row. For a 500-row CSV, this drops from 500
      // sequential INSERTs to 1 batched INSERT.
      if (previewable.toInsert.length > 0) {
        await tx.guest.createMany({
          data: previewable.toInsert.map((r) => ({
            eventId,
            name: r.name,
            phone: r.phone || '',
            email: r.email || '',
            companions: r.companions || 0,
          })),
        })
        imported = previewable.toInsert.length
        for (const r of previewable.toInsert) {
          details.push({ row: 0, name: r.name, status: 'imported' })
        }
      }
      // Merges still go one-by-one because each has a different update
      // payload (different fields changed per row). Batching these would
      // require CASE WHEN statements that Prisma doesn't expose cleanly.
      for (const m of previewable.toMerge) {
        const updates: Record<string, unknown> = {}
        if (m.row.name && m.row.name !== m.existing.name) updates.name = m.row.name
        if (m.row.email && !m.existing.email) updates.email = m.row.email
        if (m.row.companions > m.existing.companions) updates.companions = m.row.companions
        if (Object.keys(updates).length > 0) {
          await tx.guest.update({ where: { id: m.existing.id }, data: updates })
        }
        merged++
        details.push({ row: 0, name: m.row.name, status: 'duplicate_merged', mergedCount: 1 })
      }
      const guestCount = await tx.guest.count({ where: { eventId, archivedAt: null } })
      await tx.event.update({ where: { id: eventId }, data: { guests: guestCount } })
    })

    await recordAudit({
      eventId,
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `استيراد ${imported} ضيف، ودمج ${merged}`,
      entity: 'event', entityId: eventId, action: 'guests_import',
      newValue: { imported, merged, errors, file: file.name, duplicatesFlag: mergeDuplicates },
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json({
      imported, merged, errors,
      details,
      message: `تم استيراد ${imported}، دمج ${merged}${errors ? `، أخطاء ${errors}` : ''}`,
    })
  } catch (error) {
    return handleApiError(error, 'Import error:')
  }
}

async function previewImport(eventId: string, rows: ImportRow[], mergeDuplicates: boolean) {
  const toInsert: ImportRow[] = []
  const toMerge: Array<{ row: ImportRow; existing: { id: string; name: string; email: string; companions: number } }> = []
  let dupCount = 0, errRows = 0

  // PERFORMANCE (v10.8): batch the duplicate-detection queries instead
  // of one findFirst per row. For a 500-row CSV, this drops from up to
  // 500 sequential SELECTs to 2 SELECTs (one by phone, one by name).
  // We fetch all guests that match ANY of the incoming phones or names,
  // then build a lookup map for O(1) row-by-row matching.
  const phones = rows.map((r) => r.phone).filter((p) => p && p.length > 0)
  const names = rows.map((r) => r.name).filter((n) => n && n.length > 0)

  const [byPhone, byName] = await Promise.all([
    phones.length > 0
      ? db.guest.findMany({
          where: { eventId, phone: { in: phones }, archivedAt: null },
          select: { id: true, name: true, phone: true, email: true, companions: true },
        })
      : Promise.resolve([]),
    names.length > 0
      ? db.guest.findMany({
          where: { eventId, name: { in: names }, archivedAt: null },
          select: { id: true, name: true, phone: true, email: true, companions: true },
        })
      : Promise.resolve([]),
  ])

  const phoneMap = new Map<string, { id: string; name: string; email: string; companions: number }>()
  for (const g of byPhone) {
    phoneMap.set(g.phone, { id: g.id, name: g.name, email: g.email ?? '', companions: g.companions ?? 0 })
  }
  const nameMap = new Map<string, { id: string; name: string; email: string; companions: number }>()
  for (const g of byName) {
    nameMap.set(g.name, { id: g.id, name: g.name, email: g.email ?? '', companions: g.companions ?? 0 })
  }

  for (const row of rows) {
    if (row.phone) {
      const existing = phoneMap.get(row.phone)
      if (existing) {
        if (mergeDuplicates) {
          toMerge.push({ row, existing })
        } else {
          dupCount++
        }
        continue
      }
    } else {
      const existingByName = nameMap.get(row.name)
      if (existingByName) {
        if (mergeDuplicates) {
          toMerge.push({ row, existing: existingByName })
        } else {
          dupCount++
        }
        continue
      }
    }
    toInsert.push(row)
  }
  return { toInsert, toMerge, dupCount, errRows }
}
