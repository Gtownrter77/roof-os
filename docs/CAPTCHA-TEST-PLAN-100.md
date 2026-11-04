# CAPTCHA QA Test Plan — 100 Cases

**Status:** Test specification only.  
**Target:** ROOF/OS web and mobile authentication, public forms, and any endpoint protected by CAPTCHA.  
**Execution rule:** Run against a dedicated staging environment and provider test keys. Never use production secrets or real customer data.

## Preconditions

- Identify the CAPTCHA provider and integration points before execution.
- Configure provider test keys and a staging callback/verification endpoint.
- Capture request IDs, response codes, latency, and server-side verification outcomes.
- CAPTCHA must be verified server-side. A client-side success flag is never sufficient.
- Do not log challenge tokens, provider secrets, or unnecessary personal data.
- Each case has a clear expected result. Mark **PASS**, **FAIL**, or **BLOCKED** with evidence.

## A. Rendering and basic flow

1. **Challenge renders on login** — Open login in a clean browser. Expected: challenge loads and is visible when policy requires it.
2. **Challenge renders on signup** — Open signup. Expected: challenge is present before account creation can be submitted.
3. **Challenge renders on password reset** — Open reset request. Expected: challenge appears when reset abuse controls require it.
4. **Challenge renders on public lead form** — Open the public lead/contact form. Expected: challenge is displayed and associated with the form.
5. **Challenge renders on mobile viewport** — Use a 360px-wide viewport. Expected: no clipping, overlap, or horizontal scrolling.
6. **Challenge renders on tablet viewport** — Use a tablet viewport. Expected: layout remains usable.
7. **Challenge renders on desktop viewport** — Use a wide desktop viewport. Expected: challenge remains aligned with its form.
8. **Challenge loads after client navigation** — Navigate to a protected form without a full reload. Expected: challenge initializes once and works.
9. **Challenge reloads after form reset** — Reset the form. Expected: stale challenge state is cleared and a fresh challenge can be completed.
10. **Challenge has clear instructions** — Inspect visible labels and instructions. Expected: users understand what action is required.

## B. Successful verification

11. **Valid token accepted** — Submit a provider-issued valid test token. Expected: server verification succeeds and the form proceeds.
12. **Valid token accepted once** — Submit the same valid token a second time. Expected: replay is rejected.
13. **Token bound to expected action** — Submit a valid token for a different action. Expected: verification fails closed.
14. **Token bound to expected hostname** — Submit a token issued for an unapproved hostname. Expected: verification fails.
15. **Token within validity window** — Submit a fresh valid token. Expected: verification succeeds.
16. **Expired token rejected** — Submit an expired test token. Expected: server rejects it and asks for a new challenge.
17. **Future-dated token rejected** — Submit a token with an invalid future timestamp in a provider mock. Expected: reject.
18. **Provider success response parsed** — Return a valid provider success payload. Expected: server accepts only when all required fields match.
19. **Provider success with missing hostname** — Omit hostname where hostname validation is required. Expected: reject.
20. **Provider success with wrong action** — Return success but wrong action metadata. Expected: reject.

## C. Missing, malformed, and tampered tokens

21. **No token submitted** — Submit without a challenge token. Expected: request is rejected before protected work.
22. **Empty token submitted** — Submit an empty string. Expected: reject with a safe validation message.
23. **Whitespace-only token** — Submit spaces and tabs. Expected: reject.
24. **Null token value** — Submit JSON null. Expected: reject without server error.
25. **Boolean token value** — Submit true/false instead of a string. Expected: reject safely.
26. **Numeric token value** — Submit a number. Expected: reject safely.
27. **Array token value** — Submit an array. Expected: reject safely.
28. **Object token value** — Submit an object. Expected: reject safely.
29. **Oversized token** — Submit a token exceeding the documented maximum size. Expected: reject before provider call.
30. **Malformed token encoding** — Submit invalid encoding. Expected: reject without crash or stack trace.
31. **Truncated token** — Remove the end of a valid token. Expected: reject.
32. **Modified token character** — Change one character in a valid token. Expected: reject.
33. **Token copied from another session** — Submit a token minted in a different session when session binding is required. Expected: reject.
34. **Token copied from another user** — Submit a token minted in another user's context when binding is required. Expected: reject.
35. **Token in unexpected field** — Put token in an unrecognized request field. Expected: reject; server does not silently trust it.

## D. Server-side enforcement and request integrity

36. **Client success flag spoofed** — Send `captchaVerified: true` without a token. Expected: reject.
37. **Client provider response spoofed** — Send a fabricated provider response object. Expected: server ignores it and verifies token directly.
38. **Verification secret never sent to browser** — Inspect HTML, JS bundles, and network responses. Expected: secret is absent.
39. **Verification secret never returned by API** — Inspect API responses and error bodies. Expected: secret is absent.
40. **Protected endpoint called directly** — Call endpoint without loading the UI. Expected: server-side CAPTCHA gate still applies.
41. **Alternate content type** — Submit the request as form-encoded instead of JSON. Expected: same verification policy applies.
42. **Duplicate token fields** — Submit conflicting token values. Expected: reject as ambiguous.
43. **Duplicate verification requests** — Send the same request twice concurrently. Expected: token replay is rejected and side effects remain idempotent.
44. **HTTP method mismatch** — Call a protected endpoint using an unsupported method. Expected: reject without bypassing verification.
45. **Untrusted forwarded host** — Spoof forwarded-host headers. Expected: hostname checks use trusted deployment configuration.
46. **Untrusted origin header** — Send a foreign Origin. Expected: origin policy rejects or safely handles the request; CAPTCHA is not treated as a substitute for CSRF protection.
47. **Untrusted referer header** — Remove or spoof Referer. Expected: server verification remains authoritative.
48. **Proxy/client IP mismatch** — Supply forged client-IP headers. Expected: rate-limit identity uses trusted proxy configuration only.
49. **Verification endpoint authentication** — Call internal verification route without required server credentials. Expected: deny.
50. **No verification bypass in production config** — Inspect production configuration. Expected: test-only bypass flags are disabled.

## E. Provider errors and resilience

51. **Provider timeout** — Simulate timeout. Expected: fail closed with retry guidance; protected action does not proceed.
52. **Provider connection refused** — Simulate connection failure. Expected: fail closed.
53. **Provider DNS failure** — Simulate DNS failure. Expected: fail closed and log a sanitized operational event.
54. **Provider HTTP 400** — Simulate malformed provider request response. Expected: reject and alert operators.
55. **Provider HTTP 401/403** — Simulate invalid secret. Expected: reject and surface configuration health alert without exposing secret.
56. **Provider HTTP 429** — Simulate provider rate limit. Expected: safe retry/backoff behavior; no bypass.
57. **Provider HTTP 500** — Simulate provider server error. Expected: fail closed.
58. **Provider HTTP 502/503/504** — Simulate upstream outage. Expected: fail closed and provide retry path.
59. **Provider returns invalid JSON** — Expected: reject safely; no unhandled exception.
60. **Provider returns empty body** — Expected: reject safely.
61. **Provider returns unexpected schema** — Expected: reject safely.
62. **Provider response is delayed** — Delay response near timeout. Expected: bounded request time and no duplicate submission.
63. **Provider returns success plus error codes** — Expected: reject inconsistent response.
64. **Provider secret rotated** — Rotate staging secret. Expected: new secret works; old secret fails after rotation.
65. **Provider outage recovery** — Restore provider. Expected: verification resumes without restart or stale failure state.

## F. Abuse prevention and rate limiting

66. **Repeated invalid tokens** — Submit repeated invalid tokens. Expected: rate limit or abuse controls activate.
67. **Repeated challenge requests** — Request new challenges rapidly. Expected: challenge issuance is throttled.
68. **Repeated signup attempts** — Submit many signup attempts from one test identity. Expected: layered rate limiting applies.
69. **Repeated password reset attempts** — Submit repeated reset requests. Expected: throttling and privacy-safe responses.
70. **Repeated lead submissions** — Submit repeated public leads. Expected: spam controls limit abuse without duplicate records.
71. **Distributed low-rate attempts** — Simulate multiple test clients. Expected: aggregate abuse controls work where configured.
72. **Rate-limit key spoofing** — Rotate forged IP headers. Expected: cannot evade trusted rate-limit identity.
73. **Concurrent challenge submissions** — Submit many requests using one token. Expected: at most one protected action succeeds.
74. **Challenge exhaustion** — Exceed provider challenge quota in staging. Expected: safe failure and operator visibility.
75. **Abuse lockout expiry** — Wait for the configured cooldown. Expected: legitimate user can retry after expiry.

## G. Accessibility and usability

76. **Keyboard-only operation** — Complete challenge and form without a pointer. Expected: all controls are reachable and operable.
77. **Visible keyboard focus** — Tab through challenge controls. Expected: focus indicator is visible.
78. **Screen-reader label** — Inspect with a screen reader. Expected: challenge and status have meaningful accessible names.
79. **Screen-reader error announcement** — Cause verification failure. Expected: error is announced without requiring visual discovery.
80. **Color contrast** — Check challenge instructions, controls, and errors. Expected: contrast meets WCAG AA where applicable.
81. **Zoom to 200%** — Zoom browser to 200%. Expected: no loss of challenge functionality.
82. **Reduced motion preference** — Enable reduced motion. Expected: no essential information depends on animation.
83. **Audio alternative availability** — If provider supports audio, verify it is reachable and usable. Expected: equivalent challenge path is available.
84. **Challenge refresh control** — Use refresh control by keyboard and pointer. Expected: a new challenge is issued and old token invalidated.
85. **Accessible timeout notice** — Allow a challenge to expire. Expected: clear, announced recovery instructions.

## H. Browser, device, and network conditions

86. **Chrome current stable** — Complete a valid flow. Expected: success.
87. **Firefox current stable** — Complete a valid flow. Expected: success or documented provider limitation.
88. **Safari current stable** — Complete a valid flow. Expected: success or documented provider limitation.
89. **Edge current stable** — Complete a valid flow. Expected: success.
90. **Android Chrome** — Complete a valid flow on a real Android device. Expected: success and usable layout.
91. **iOS Safari** — Complete a valid flow on a real iOS device. Expected: success and usable layout.
92. **Third-party cookies restricted** — Restrict third-party cookies. Expected: supported provider flow remains functional or gives clear guidance.
93. **JavaScript disabled** — Disable JavaScript. Expected: protected action cannot proceed; clear fallback message is shown.
94. **Slow network** — Throttle network. Expected: loading state, bounded timeout, and retry behavior are correct.
95. **Offline during challenge** — Disconnect network after challenge load. Expected: submission fails safely and can be retried after reconnect.
96. **Network changes mid-challenge** — Switch Wi-Fi/mobile network. Expected: stale token is rejected or valid flow recovers safely.

## I. Privacy, observability, and regression

97. **Token redaction in logs** — Trigger success and failure. Expected: raw token and secret never appear in logs.
98. **Personal data minimization** — Inspect telemetry. Expected: only required metadata is recorded and retention follows policy.
99. **Failure metrics and alerting** — Simulate provider outage and elevated failures. Expected: sanitized metrics/alerts identify the issue without leaking secrets.
100. **End-to-end regression** — Complete signup, login, password reset, and public lead submission with valid staging challenges; repeat with invalid and missing tokens. Expected: valid flows work, invalid flows are blocked, and unrelated authenticated app features remain unaffected.

## Execution record

| Field | Value |
|---|---|
| Environment | Staging only |
| Provider | Record provider and test-key mode |
| Build / commit | Record exact commit |
| Browser / device | Record versions |
| Tester | Record tester |
| Date | Record date |
| Passed / failed / blocked | Record counts |
| Evidence | Link sanitized logs, screenshots, and request IDs |

**Release gate:** Do not mark CAPTCHA protection complete until all applicable cases pass, blocked cases have an owner and resolution date, server-side verification is confirmed, and production secrets are verified absent from client bundles.
