#!/usr/bin/env python3
"""Render original still artwork into a 36-second cinematic MP4 with synthesized audio.
Requires ffmpeg; no provider, licensed music, API key, network or customer data.
"""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
output = root / 'public/themes/roofos-storm-trailer.mp4'
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
scenes = [
 ('storm-command', 'STORM TRACKER 11', 'ATLANTA. EYES ON THE STORM.'),
 ('tornado', 'WHEN THE STORM HITS.', 'BE READY FOR WHAT COMES NEXT.'),
 ('hail', 'GET EYES ON THE ROOF.', 'EVERY PHOTO. EVERY MEASUREMENT. EVERY DETAIL.'),
 ('lightning', 'ROOF/OS', 'INSPECT. MEASURE. ESTIMATE. BUILD.'),
 ('after-storm', 'LEAVE IT STRONGER.', 'FROM THE FIRST INSPECTION TO THE LAST NAIL.'),
 ('storm-command', 'ROOF/OS', 'COMMAND YOUR OPERATION.'),
]
with tempfile.TemporaryDirectory(prefix='roofos-trailer-') as folder:
    folder = Path(folder)
    for i, (asset, title, caption) in enumerate(scenes):
        clip = folder / f'{i}.mp4'
        title_path = folder / f'{i}-title.txt'; title_path.write_text(title)
        caption_path = folder / f'{i}-caption.txt'; caption_path.write_text(caption)
        filters = (
          "scale=1800:-1,zoompan=z='min(zoom+0.0005,1.10)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=180:s=1280x720:fps=30,"
          "eq=brightness=-0.035:contrast=1.04,"
          "drawbox=x=0:y=490:w=iw:h=230:color=black@0.45:t=fill,"
          f"drawtext=fontfile={font}:textfile={title_path}:fontcolor=white:fontsize=52:x=55:y=535:shadowcolor=black@0.6:shadowx=2:shadowy=2,"
          f"drawtext=fontfile={font}:textfile={caption_path}:fontcolor=0xedeff7:fontsize=22:x=58:y=615,"
          "drawbox=x=58:y=510:w=70:h=5:color=0xef3340:t=fill,"
          "fade=t=in:st=0:d=0.4,fade=t=out:st=5.6:d=0.4,format=yuv420p"
        )
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(root / f'public/themes/{asset}.webp'),'-vf',filters,'-frames:v','180','-c:v','libx264','-crf','24','-preset','fast','-threads','2','-filter_threads','1',str(clip)],check=True)
        print(f'Scene {i+1}/{len(scenes)} rendered', flush=True)
    listing = folder / 'clips.txt'
    listing.write_text(''.join(f"file '{folder / f'{i}.mp4'}'\n" for i in range(len(scenes))))
    # Brown-noise wind, low-end tone and timed noise impacts: original storm sound design.
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(listing),
      '-f','lavfi','-i','anoisesrc=color=brown:amplitude=0.35:duration=36:sample_rate=48000',
      '-f','lavfi','-i','sine=frequency=48:duration=36:sample_rate=48000',
      '-filter_complex',"[1:a]lowpass=f=650,volume='0.35+0.65*exp(-2*mod(t,6))':eval=frame[wind];[2:a]volume=0.25[bass];[wind][bass]amix=inputs=2:normalize=0,afade=t=in:d=1.5,afade=t=out:st=34:d=2,alimiter=limit=0.8[a]",
      '-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-b:a','128k','-movflags','+faststart','-shortest',str(output)],check=True)
print(f'Trailer saved: {output} ({output.stat().st_size} bytes)',flush=True)
