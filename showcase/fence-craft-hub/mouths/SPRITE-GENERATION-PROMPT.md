# Mouth Sprite Generation Prompt for ChatGPT/DALL-E

Use this prompt to generate the 20 mouth sprites needed for lip-sync animation:

---

## PROMPT FOR CHATGPT:

I need you to create **20 individual mouth sprite images** for lip-sync animation of a cartoon orange mascot character. Each sprite should be:

- **Size**: 256x256 pixels
- **Background**: Fully transparent (PNG)
- **Style**: 3D cartoon render matching the reference character style
- **Content**: ONLY the mouth area (no face, no body)
- **Position**: Centered in the image

### Reference Character Description:
A friendly 3D cartoon orange fruit mascot with:
- Smooth, glossy orange skin texture
- Subtle peach/salmon colored inner mouth
- White teeth when visible
- Warm, inviting expression
- Pixar/DreamWorks animation style

### Required Mouth Shapes (create each as separate image):

| Filename | Shape Description | Example Sounds |
|----------|-------------------|----------------|
| `rest.png` | Neutral closed mouth, slight smile, lips together | Silence/idle |
| `aa.png` | Wide open oval mouth, jaw dropped | "father", "car", "hot" |
| `ah.png` | Medium open relaxed mouth | "but", "cup", "love" |
| `ao.png` | Rounded O-shape, lips pushed forward | "caught", "law", "all" |
| `eh.png` | Slight horizontal opening, corners back | "bed", "head", "said" |
| `er.png` | Small rounded opening with slight pucker | "bird", "her", "word" |
| `ih.png` | Small horizontal opening | "bit", "kid", "sit" |
| `iy.png` | Wide smile, teeth showing, narrow opening | "beat", "see", "me" |
| `uh.png` | Small rounded opening | "book", "put", "could" |
| `uw.png` | Small tight O-shape, lips very rounded | "boot", "moon", "you" |
| `fv.png` | Bottom lip tucked under top teeth | "fun", "very", "five" |
| `l.png` | Mouth slightly open, tongue tip visible at top | "love", "all", "like" |
| `mbp.png` | Lips pressed firmly together (bilabial) | "mom", "boy", "pop" |
| `wq.png` | Rounded puckered lips, like kissing | "we", "quick", "water" |
| `th.png` | Mouth open, tongue between teeth | "think", "this", "the" |
| `ch.png` | Teeth together, lips slightly forward | "church", "judge", "ship" |
| `kg.png` | Mouth slightly open, back of tongue raised | "cat", "go", "king" |
| `td.png` | Mouth open, tongue at upper teeth ridge | "top", "day", "time" |
| `sz.png` | Teeth close together, slight smile | "sun", "zoo", "this" |
| `sil.png` | Nearly closed, very relaxed neutral | Between words, transitions |

### Important Notes:
1. All mouths should feel like they belong to the SAME character
2. Maintain consistent lighting (soft front lighting with subtle shadows)
3. Keep the same "camera angle" - straight-on view of mouth
4. Inner mouth should be visible on open shapes (dark peach/salmon interior)
5. Teeth should be white and slightly rounded/cartoon style
6. Lips should have subtle orange/peach coloring matching the orange fruit skin

### Output Format:
Generate each as a separate PNG image with transparent background, named exactly as specified in the filename column.

---

## ALTERNATIVE: Single Reference Sheet Prompt

If generating individually is difficult, use this prompt to create a reference sheet:

"Create a mouth phoneme reference sheet for a 3D cartoon orange fruit mascot character. Show 20 different mouth positions in a 4x5 grid, each labeled with its phoneme name (rest, aa, ah, ao, eh, er, ih, iy, uh, uw, fv, l, mbp, wq, th, ch, kg, td, sz, sil). Style should match Pixar/DreamWorks 3D animation - glossy orange skin, white teeth, peach inner mouth. Each mouth should be the same size and angle, on transparent or white background."

---

## After Generation:

1. Save each sprite as individual PNG files
2. Name them exactly: `rest.png`, `aa.png`, `ah.png`, etc.
3. Upload to `/public/mouths/` folder in the project
4. Test lip-sync in the pricing bot chat
