# Images and video on the Claude route

Photos and screenshots are sent as image content, alongside text, through Messages,
Chat Completions, or Responses. The model must support image input. Keep the complete
encoded JSON request below 4,400,000 bytes; Vercel itself has a 4.5 MB payload ceiling.
Base64 adds roughly one third to the original file size. Resize or compress large
images in the client before attaching them. This is a transport constraint, not an
output-token or requests-per-minute cap.

## Video

Raw MP4 acceptance is not proof of video comprehension. In live tests the upstream
returned HTTP 200 but described unrelated scenes. Do not treat raw video as verified.
For visual analysis, convert the video into timestamped images before sending it.
This works in clients that can extract frames using their local tools; merely
attaching an MP4 in a client does not guarantee that it performs this conversion.

The included local helper requires Node.js, ffmpeg, and ffprobe on PATH:

```powershell
node scripts/prepare-media.mjs "C:\path\clip.mp4" request.json claude-sonnet-5 "Describe the actions over time."
```

It samples 12 frames across the clip, compresses them, includes timestamps, and writes
an Anthropic Messages request. It never sends a request or embeds credentials.
It also accepts image files and converts them to a smaller JPEG request.

To send the prepared request, set SOMITI_API_KEY in your environment, then run:

```powershell
$headers = @{ 'x-api-key' = $env:SOMITI_API_KEY; 'anthropic-version' = '2023-06-01' }
Invoke-RestMethod -Uri 'https://api.somiti.page/v2/messages' -Method Post -Headers $headers -ContentType 'application/json' -InFile request.json
```

Sending consumes upstream credits. The example's max_tokens is a caller-controlled
response budget, not a gateway cap. Frame sampling does not include audio and can miss
fast actions between frames. For detailed movement analysis, sample the relevant short
segment more densely. No model or client is guaranteed to interpret every detail correctly.
