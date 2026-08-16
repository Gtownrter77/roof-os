import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Lead = {
  id: string
  name: string
  address: string
  phone: string
  email: string
  status: 'new' | 'assigned' | 'qualified' | 'inspection_scheduled' | 'inspected' | 'report_pending' | 'report_approved' | 'won' | 'lost'
  source: string
  notes: string
  created_at: string
  updated_at: string
}
