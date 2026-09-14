import { createClient } from '@supabase/supabase-js'
import { getSupabaseEnv } from './supabase/env'

const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv()

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
