# Storm theme media

Original art produced using the built-in image-generation tool, then encoded as full-size WebP assets. No paid external provider was invoked. CSS balances the command-center exposure at brightness .88/contrast 1.04 per owner feedback.

- `public/themes/tornado.webp`: photorealistic wedge tornado over shingle-roofed American homes, hail/debris/lightning, dark left space for text.
- `public/themes/storm-command.webp`: detailed bright broadcast command center, meteorologist pointing at a red/purple/green Doppler wall, STORM TRACKER 11 header, original photographic image. Final edit changes only the window city to Atlanta, including Bank of America Plaza, Westin Peachtree Plaza and Truist Plaza. The owner selected a slightly darker display treatment after the bright revision.
- `public/themes/hail.webp`: large ice impacts and rain on an authentic architectural-shingle roof under a purple supercell.
- `public/themes/lightning.webp`: towering shelf cloud, branching lightning and wet suburban roofs in electric blue.
- `public/themes/after-storm.webp`: warm clearing sky, finished roof, roofing crew, homeowner and rainbow.

The Professional card is native SVG. The code-native scenery is retained as a lightweight editable fallback. Photographic plates are combined with CSS camera depth, independent radar sweep, lighting and particles; they do not animate the actor's limbs or speech.

`python3 scripts/render-storm-trailer.py` builds the 36-second MP4 from these plates using FFmpeg and DejaVu Sans Bold. Sound is synthesized brown-noise wind plus bass and timed impacts; no recordings or licensed music are used. This renderer needs FFmpeg and is not run during normal application startup.
