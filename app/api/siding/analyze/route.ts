import {createHash} from 'node:crypto'
import {NextRequest,NextResponse} from 'next/server'
import {analyzePhotosWithOllama,getOllamaVisionModel,LocalVisionError} from '../../../../lib/ai/local-vision.mjs'
import {validateSidingVisionObservation,SIDING_VISION_CONTRACT_VERSION,SIDING_VISION_DISCLAIMER} from '../../../../lib/ai/siding-vision-contract'
import {isUuid,readJson,requireWorkspaceMember} from '../../../../lib/api-security'
import {getSupabaseEnv} from '../../../../lib/supabase/env'
import {createClient} from '../../../../lib/supabase/server'
export const runtime='nodejs'
export const maxDuration=120
const MODEL=getOllamaVisionModel(),BUCKET='inspection-photos',MAX=30*1024*1024
const bad=(m:string,s=400)=>NextResponse.json({error:m},{status:s})
async function getBytes(url:string){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15_000)});if(!r.ok||!r.body)throw new Error('photo retrieval failed');const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;while(true){const x=await reader.read();if(x.done)break;size+=x.value.byteLength;if(size>MAX)throw new Error('photo exceeds 30 MB');chunks.push(x.value)}return Buffer.concat(chunks.map(x=>Buffer.from(x)))}
export async function POST(request:NextRequest){try{
 const supabase=await createClient(),auth=await supabase.auth.getUser();if(!auth.data.user)return bad('Authentication required.',401)
 const {data:workspaceId,error:we}=await supabase.rpc('current_workspace_id');if(we||!isUuid(workspaceId))return bad('Active workspace required.',403)
 const member=await requireWorkspaceMember(supabase,auth.data.user.id,workspaceId);if(member.response)return member.response
 const parsed=await readJson(request,16*1024);if('error'in parsed)return bad(parsed.error,parsed.status);const body=parsed.body as Record<string,unknown>
 if(!isUuid(body.photoId)||!isUuid(body.inspectionId))return bad('photoId and inspectionId must be valid UUIDs.')
 const {data:photo}=await supabase.from('inspection_photos').select('id,workspace_id,inspection_id,bucket_id,object_path,mime_type,upload_status').eq('id',body.photoId).eq('workspace_id',workspaceId).eq('inspection_id',body.inspectionId).maybeSingle()
 if(!photo||photo.bucket_id!==BUCKET||photo.upload_status!=='uploaded'||!['image/jpeg','image/png','image/webp'].includes(photo.mime_type))return bad('Authorized inspection photo required.',403)
 const {data:signed,error:se}=await supabase.storage.from(BUCKET).createSignedUrl(photo.object_path,60);if(se||!signed?.signedUrl)return bad('Photo could not be signed.',502)
 const {url:supabaseUrl}=getSupabaseEnv(),base=new URL(supabaseUrl).origin,url=new URL(signed.signedUrl,base);if(url.origin!==base)return bad('Invalid private storage URL.',502)
 const image=await getBytes(url.toString())
 const hash=createHash('sha256').update(image).digest('hex')
 const prompt='Analyze this actual siding/elevation photograph. Return exactly one JSON object matching ROOF/OS siding vision contract '+SIDING_VISION_CONTRACT_VERSION+'. Count visible siding courses/rows when possible. Estimate visible siding exposure in inches only when visually supportable. Identify openings and approximate dimensions only when supportable. A human must verify every value. Never invent scale or claim exact measurement. Do not return prices, estimates, waste, square footage, roofing quantities, insurance decisions, or building-code determinations. Include authority_disclaimer exactly as: '+SIDING_VISION_DISCLAIMER+'. If the photo does not support a value, return null and explain in warnings. No Markdown.'
 let localResult:{model:string;text:string}
 try{localResult=await analyzePhotosWithOllama({prompt,photos:[{mimeType:photo.mime_type,bytes:image}],model:MODEL,timeoutMs:90000})}catch(error){if(error instanceof LocalVisionError)return bad(error.message+' Manual measurement remains available.',error.status);return bad('The local vision service is unavailable. Manual measurement remains available.',503)}
 let candidate:unknown;try{candidate=JSON.parse(localResult.text)}catch{return bad('Local vision service returned malformed observation JSON.',502)}
 let observation;try{observation=validateSidingVisionObservation(candidate)}catch{return bad('AI response failed siding observation validation.',502)}
 const {data:existing}=await supabase.from('siding_measurements').select('id,status').eq('workspace_id',workspaceId).eq('source_photo_id',body.photoId).maybeSingle()
 const ai={ai_observation:observation,ai_model_version:MODEL,ai_content_hash:hash,ai_analyzed_at:new Date().toISOString(),ai_observation_status:'unverified'}
 if(existing?.status==='unverified'){const {data,error}=await supabase.from('siding_measurements').update(ai).eq('id',existing.id).eq('workspace_id',workspaceId).eq('status','unverified').select('*').single();if(error)return bad('AI observation could not be saved.',502);return NextResponse.json({measurement:data,observation})}
 const {data:created,error}=await supabase.from('siding_measurements').insert({workspace_id:workspaceId,inspection_id:body.inspectionId,source_photo_id:body.photoId,elevation:observation.elevation,created_by:auth.data.user.id,...ai}).select('*').single()
 if(error)return bad('AI observation could not be saved.',502);return NextResponse.json({measurement:created,observation},{status:201})
}catch(e){return bad(e instanceof Error?e.message:'Siding AI analysis failed.',500)}}
