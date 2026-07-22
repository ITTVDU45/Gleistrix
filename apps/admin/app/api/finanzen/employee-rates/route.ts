import { NextRequest, NextResponse } from 'next/server'
import dbConnect from '@/lib/dbConnect'
import EmployeeFinanceRate from '@/lib/models/EmployeeFinanceRate'
import { Employee } from '@/lib/models/Employee'
import { employeeFinanceRateSchema, financeValidationError } from '@/lib/finance/validation'
import { financeApiError, requireFinanceAccess, requireFinanceMutation } from '@/lib/finance/apiGuard'

export async function GET(request: NextRequest) {
  const denied = await requireFinanceAccess(request)
  if (denied) return denied
  await dbConnect()
  const [rates, employees] = await Promise.all([
    EmployeeFinanceRate.find({}).sort({ validFrom: -1 }).lean(),
    Employee.find({}).select('name miNumber status').sort({ name: 1 }).lean(),
  ])
  const names = new Map(employees.map((employee: any) => [String(employee._id), employee.name]))
  return NextResponse.json({ success: true, data: rates.map((rate: any) => ({ ...rate, employeeName: names.get(String(rate.employeeId)) })), employees })
}

export async function POST(request: NextRequest) {
  const denied = await requireFinanceMutation(request, 'finance:rate:create')
  if (denied) return denied
  try {
    await dbConnect()
    const parsed = employeeFinanceRateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(financeValidationError(parsed.error), { status: 400 })
    if (!await Employee.exists({ _id: parsed.data.employeeId })) return NextResponse.json({ success: false, error: 'Mitarbeiter nicht gefunden.' }, { status: 404 })
    const data = await EmployeeFinanceRate.create(parsed.data)
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    return financeApiError(error, 'Lohnsatz konnte nicht angelegt werden.')
  }
}
