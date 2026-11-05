# BAILEY — Approved Brand and Implementation Direction

**Owner approval:** 2026-10-29. The product-facing name is **BAILEY**. The expanded descriptor is **Business Operations & Support System**; its B, O, S, S initials are illuminated in electric-blue lightning. Do not place the standalone word BOSS under BAILEY.

## Approved hero artwork

The approved reference is the final image from the 2026-10-29 design session: a dramatic suburban storm scene with a tornado at left, detailed houses and rooflines, rain and debris, and a central heavy 3D forged-metal BAILEY wordmark integrated with an architectural house roofline. A horizontal metallic plaque below spells out **Business Operations & Support System**. B/O/S/S initials are electrified blue; the remaining text is legible steel. The letter Y must be clearly readable (lightning cannot cross it to form an X). Blue and gunmetal, no red. No separate shield/crest outline. Preserve the overall composition rather than substituting a generic flat text logo.

**Artwork delivery limitation:** The approved raster image was generated in chat; this repository specification does not itself contain the image asset. Do not falsely claim the asset has been committed or displayed in the application. Import an approved, optimized image through the proper asset pipeline before claiming visual implementation.

## Rollout requirements

1. Audit current branding across login, navigation, title/metadata, favicon, PWA manifest, emails, exports, documents, mobile surfaces, and settings. Inventory before modifying.
2. Preserve ROOF/OS code, routes, database tables, auth, and integrations. Product branding is not a legal entity or database rename.
3. Implement reusable brand tokens and components, accessible static fallback and reduced-motion support. Honor user-selected Professional and storm themes. Avoid overloading weak/mobile devices with animated background effects.
4. Use an opt-in staged preview/feature flag with rollback; do not push unfinished visuals directly to production.
5. Validate the image at mobile and desktop sizes and verify legibility, alt text, performance, contrast, no-red palette, and correct spelling.
6. Run typecheck, build, security, regression and CI checks. Merge/deploy only after verified green gates, and report the exact SHA and production evidence.
7. Update the Living Build Checklist and handoff with accurate [ ], [~], [✓], [!] markers; no false completion claims.

## Release state

This file records **approved visual direction**, not completed implementation or deployment. Existing release NO-GO gates remain in effect.
