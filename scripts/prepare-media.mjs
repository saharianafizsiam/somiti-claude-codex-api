import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Local preprocessing: no files or credentials are uploaded by this script.
const [file, output, model = 'claude-sonnet-5', prompt = 'Describe what is visible. For video, explain changes over time using the frame timestamps. Do not invent audio or events between sampled frames.'] = process.argv.slice(2);
if (!file || !output) {
  console.error('Usage: node scripts/prepare-media.mjs INPUT_FILE OUTPUT_JSON [MODEL] [PROMPT]\nRequires ffmpeg and ffprobe on PATH. Creates an Anthropic Messages request; does not send it.');
  process.exit(1);
}
const input = resolve(file);
const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,codec_name','-of','json',input], {encoding:'utf8'}));
const duration = Number(probe.format?.duration);
const isVideo = Number.isFinite(duration) && duration > 0;
const count = isVideo ? 12 : 1;
const dir = mkdtempSync(join(tmpdir(), 'somiti-media-'));
try {
  const content = [{type:'text',text:isVideo ? `Video duration: ${duration.toFixed(2)} seconds. These are ${count} sampled frames in chronological order. Audio is not included; fast actions between samples may be missed.\n${prompt}` : prompt}];
  for(let i=0;i<count;i++) {
    const timestamp = isVideo ? i * Math.max(0,duration - 0.1) / (count - 1) : 0;
    const image = join(dir, `${i}.jpg`);
    execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y',...(isVideo ? ['-ss',String(timestamp)] : []),'-i',input,'-frames:v','1','-vf',"scale='min(1280,iw)':-2",'-q:v','5',image], {stdio:['ignore','ignore','pipe']});
    if(isVideo) content.push({type:'text',text:`Frame ${i+1}: ${timestamp.toFixed(2)} seconds`});
    content.push({type:'image',source:{type:'base64',media_type:'image/jpeg',data:readFileSync(image).toString('base64')}});
  }
  const payload = JSON.stringify({model,max_tokens:700,messages:[{role:'user',content}]});
  if(Buffer.byteLength(payload)>4_400_000) throw new Error('Prepared request exceeds the hosting payload budget. Reduce frame resolution or count before sending.');
  writeFileSync(resolve(output),payload);
  console.log(`Prepared ${count} image(s), ${Buffer.byteLength(payload)} bytes: ${resolve(output)}. No API request was made.`);
} finally { rmSync(dir,{recursive:true,force:true}); }
