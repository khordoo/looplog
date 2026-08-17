# Exercise preview artwork

The 22 built-in exercise illustrations in `public/exercises/` were generated as original project assets with Codex's built-in image-generation tool, then reviewed against the corresponding written setup and verified demonstration video. The five desk-reset illustrations were added on 2026-08-17: `reset-march`, `reset-thoracic-rotation`, `reset-hip-flexor-stretch`, `reset-scapular-setting`, and `reset-bodyweight-squat`.

## Visual direction

- Premium editorial fitness illustration on a warm off-white background.
- Full movement silhouette remains legible in a compact mobile card.
- Resistance-band paths use one continuous 41-inch-style loop without handles or anchors.
- No text, logos, watermarks, gym equipment, or decorative distractions.
- The same neutral clothing and background treatment keeps every workout visually consistent.

The source images were generated at high resolution and converted to 640×640 WebP at quality 82. The complete set is approximately 364 KB and is included in the PWA precache.

The reset set uses the same prompt family: a full-body adult male athlete, warm off-white seamless backdrop, soft muted-sage elliptical ground shadow, charcoal shirt and black shorts, premium editorial semi-realistic digital fitness illustration, generous square framing, no text/logos/watermarks, and anatomically clear low-impact form. Each selected source remains preserved in Codex's generated-image workspace; the project ships only the compact WebP derivative.

## Safety and maintenance

The artwork is a quick setup reminder, not a frame-by-frame coaching reference. The verified demonstration and written instructions remain authoritative. Before replacing an image:

1. Compare band placement, stance, joint position, and support setup with the exercise definition.
2. Confirm that a band does not cross the throat, face, or an unapproved anchor.
3. Check the thumbnail at its real mobile size, not only at full resolution.
4. Keep the existing exercise ID as the filename and rerun the content, component, offline, and mobile tests.

Bodyweight lunge and split-squat previews intentionally show the rear knee hovering near the floor. The dead-bug preview keeps the head and shoulders supported. These details were explicitly corrected during generation review.
