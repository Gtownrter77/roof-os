# ROOF/OS Realtime Voice Gateway

## Target architecture

The current receptionist domain remains in ROOF/OS: lead resolution, consent, scheduling, payment policy, audit, and workspace isolation. The media layer is being separated behind a provider-neutral event contract in `lib/realtime-voice.ts`. This allows the system to replace turn-based Twilio Gather with a streaming gateway without changing business rules.

The preferred mostly open-source path is **LiveKit Agents + LiveKit SIP + Pipecat-compatible Python orchestration**. LiveKit provides the SIP/WebRTC room and media transport, while the agent process owns interruption-aware audio streaming, speech detection, model cancellation, and tool calls. Asterisk with its WebSocket channel driver remains the maximum-control alternative when the business needs its own PBX, SIP routing, or fixed-IP media perimeter.

The first production deployment should keep the existing Twilio path as a fail-safe. New realtime calls can be enabled for a controlled percentage of traffic, with automatic transfer to the human number when the agent loses confidence, the caller opts out, the media stream fails, or a tool policy rejects the request.

## Interruption handling

The gateway must treat caller speech as an interrupt, not as a queued turn. Voice activity detection emits `barge_in`, the audio sender immediately stops the current response, the model generation is cancelled, and the transcript assembler starts a new caller segment. Only the latest response may be played. Every event carries a monotonically increasing sequence number and event ID so duplicate packets cannot create duplicate domain actions.

The business action layer remains non-streaming and transactional. The agent may propose a slot, but only the server-side booking function can commit it. A conflict returns a structured tool result and the agent speaks an alternative-time prompt. Payment links remain human-approved and amount-bound to issued invoices.

## Open-source service boundary

The gateway service should expose a small internal interface rather than direct database writes. It receives a signed session bootstrap containing the workspace and receptionist session IDs, emits normalized realtime events, and invokes ROOF/OS server actions through authenticated internal APIs. It must not receive a Supabase service-role key. The gateway gets short-lived credentials and can be restarted without losing state because transcripts, events, consent, and appointments are durable in Supabase.

A minimal deployment consists of one SIP trunk, one LiveKit or Asterisk media node, one Python agent worker, and the existing ROOF/OS web application. For a single roofing company, one small always-on VM is adequate for the gateway; production needs a second media/worker replica before advertising high availability. Container images should be pinned by digest, exposed only through TLS and a firewall, and monitored for media latency, model latency, packet loss, failed handoffs, and tool-policy denials.

## Rollout sequence

First, deploy the event contract and atomic appointment function, which are now in the repository and live Supabase. Second, implement the Python streaming worker against LiveKit SIP, with `barge_in`, response cancellation, VAD, and structured tool calls. Third, run shadow sessions where the streaming agent observes transcripts but cannot act. Fourth, enable a small canary percentage with human transfer and automatic rollback. Finally, retire Twilio Gather only after interruption, consent, scheduling, webhook, and failure metrics meet the release thresholds.

The current Twilio implementation is therefore not discarded. It is the low-cost fallback and emergency path while the open-source realtime gateway earns production traffic through measured canary releases.

## Release thresholds

A canary is ready to expand when median first-response latency is below 900 ms, p95 tool latency is below 2 seconds, barge-in cancellation succeeds in at least 99% of tested interruptions, duplicate tool actions remain at zero, appointment conflict handling remains correct under concurrent requests, and human-transfer completion exceeds 99% in staging. Any violation of consent, workspace isolation, payment approval, or appointment idempotency is an automatic rollback condition.

## Sources

LiveKit documents inbound and outbound SIP telephony in its [telephony documentation](https://docs.livekit.io/telephony/). Pipecat describes its [open-source real-time voice agent framework](https://docs.pipecat.ai/overview/introduction). Asterisk documents its [WebSocket channel driver](https://docs.asterisk.org/Configuration/Channel-Drivers/WebSocket/).
