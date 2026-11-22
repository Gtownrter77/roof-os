'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase/client'

type Job = { id: string; property_address: string; job_number: string }
export default function ForemanPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [message, setMessage] = useState('Loading assignments…')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    async function load() {
      const client = createClient()
      const { data: { user } } = await client.auth.getUser()
      if (!user) throw new Error('Sign in to view assigned jobs.')
      const now = new Date().toISOString()
      const { data, error } = await client.from('production_job_assignments')
        .select('production_jobs!inner(id,property_address,job_number,status)')
        .eq('member_user_id', user.id).eq('role','crew_lead').neq('status','cancelled')
        .lte('scheduled_start',now).gte('scheduled_end',now)
        .in('production_jobs.status',['ready','scheduled','in_progress'])
      if (error) throw error
      const rows = (data ?? []).flatMap(row => row.production_jobs) as Job[]
      if (current) {
        setJobs(Array.from(new Map(rows.map(job => [job.id,job])).values()))
        setMessage(rows.length ? '' : 'No current foreman assignments.')
      }
    }
    load().catch(() => { if (current) setMessage('Assignments unavailable. Check sign-in and connection. Contact the office directly.') })
    return () => { current = false }
  }, [])
  async function stop(job: Job) {
    setBusy(true)
    try {
      const { error } = await createClient().rpc('foreman_sos',{target_job:job.id})
      if (error) throw error
      setMessage('Hold recorded for ' + job.job_number + '. Office and crew tasks created. Call the team directly to confirm receipt.')
    } catch {
      setMessage('Hold unconfirmed. Stop work and contact the crew and office directly.')
    } finally { setBusy(false) }
  }
  return <main style={{padding:20,maxWidth:640,margin:'auto'}}>
    <h1>Foreman SOS</h1>
    <a href="tel:911" style={{display:'inline-block',padding:16,background:'#a11720',color:'white'}}>Call 911</a>
    <p role="status">{message}</p>
    {jobs.map(job => <section key={job.id}>
      <h2>{job.property_address}</h2><p>Job {job.job_number}</p>
      <button disabled={busy} onClick={() => void stop(job)}>Stop this job and alert the team</button>
    </section>)}
  </main>
}
