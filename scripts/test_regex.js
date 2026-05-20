const text = `To optimize for a "Sora 2.0" level model—which prioritizes physical consistency, complex lighting, and nuanced human emotion—the prompt needs to move beyond simple descriptions and into **sensory details, camera physics, and micro-expressions.**

Here are three optimized prompt variations designed to achieve that 88+ Viral Score through high-end cinematic execution.

### Option 1: The "Hyper-Realist" Narrative (Best for Visual Fidelity)
> **Prompt:** A cinematic masterpiece, 4k, shot on 35mm lens. A high-stakes roadside encounter on a sun-drenched coastal Mediterranean highway. **Camera starts with a tight, shaky handheld close-up** of a police officer’s face; beads of sweat are visible on his forehead, his brow furrowed in deep confusion. He wears a crisp, dark blue tactical uniform with realistic fabric weave. Through the dusty glass of a luxury car window, a middle-aged blonde woman with designer tortoiseshell sunglasses looks back at him, a subtle, devious smile playing on her lips. She slowly lowers the window, the reflection of the sun glaring off the glass. The officer leans in, his voice strained, and says, "License and registration, ma'am." The woman chuckles softly, "I think you know who I am." The lighting is harsh, midday sun casting deep, realistic shadows. The scene is hyper-realistic, focusing on the micro-expressions of confusion and amusement.

### Option 2: The "Tension Builder" (Best for Engagement)
> **Prompt:** A cinematic medium shot, 8k resolution. A tense standoff on a bright, high-contrast sunny day. The camera slowly dollies in on a stressed police officer in a sharp, vintage dark blue uniform. He is leaning into the window of a sleek, modern car. Inside, a sophisticated middle-aged woman with sunglasses looks perfectly calm, holding a tube of red lipstick. The officer looks baffled, wiping sweat from his brow. He stammers, "Ma'am, do you know how fast you were going?" The woman applies her lipstick, not looking at him, and replies, "Fast enough to get your attention." The textures are hyper-realistic: the metallic gleam of the car, the rough fabric of the uniform, the smooth plastic of the lipstick. The lighting is dramatic, emphasizing the contrast between the hot sun and the cool interior of the car.

### Option 3: The "Cinematic Close-Up" (Best for Emotion)
> **Prompt:** A hyper-realistic close-up shot, 4k, cinematic lighting. A confused Italian policeman in a vintage 1970s dark blue gabardine uniform, heavy with sweat, leans towards a car window on a sun-drenched coastal road. Inside the car, a blonde middle-aged woman is smiling ironically with a mischievous look. The camera captures the subtle twitch of the officer's eye and the slight curve of the woman's smile. The officer says, "Signora, please step out of the vehicle." The woman slowly lowers her sunglasses, revealing piercing blue eyes, and whispers, "Make me." The scene has high contrast, vibrant Mediterranean colors, and hyper-realistic textures. The focus is on the psychological tension and the micro-expressions of the characters.
`;

const sanitizePrompt = (text) => {
  if (!text) return '';
  
  let cleaned = text;
  
  console.log("Starting regex 1...");
  const extractRegex = /(?:\*\*Prompt:\*\*|\*\*Prompt\*\*|\nPrompt:|^Prompt:|\n> \*\*Prompt:\*\*|^> \*\*Prompt:\*\*|\n> Prompt:|^> Prompt:)\s*([\s\S]*?)(?=\n\n###|\n\n---|Option \d+|\n\n\*\*Key|\n\n\*\*Notes|$)/i;
  const match = cleaned.match(extractRegex);
  console.log("Regex 1 done.");
  
  if (match && match[1]) {
    cleaned = match[1];
  } else {
    console.log("Starting regex 2...");
    const startOfPrompt = cleaned.search(/(?:A cinematic|Cinematic|Shot on|Medium shot|Close up|Wide shot|A detailed|A realistic|A hyper-realistic|Camera starts|The scene opens)/i);
    console.log("Regex 2 done.");
    if (startOfPrompt > 30) {
      cleaned = cleaned.substring(startOfPrompt);
    }
  }

  console.log("Starting regex 3...");
  const trailingRegex = /\n\n(?:###|---|Option \d+|Key|Notes|Analysis|Optimization|Tactics|Sora|Suggested|Viral|Enhancements|Execution|Why this works)/i;
  const trailingIndex = cleaned.search(trailingRegex);
  console.log("Regex 3 done.");
  if (trailingIndex !== -1) {
    cleaned = cleaned.substring(0, trailingIndex);
  }

  console.log("Starting regex 4...");
  cleaned = cleaned
    .replace(/^(Ecco|Here is|Here are|Per ottimizzare|To optimize|To push|The goal|Option \d+|Sora 2\.0 Master Prompt|Why these prompts|This prompt|In this optimized|The following).*?[:\s-]*/im, '')
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/^>\s*/gm, '') // Remove blockquotes
    .replace(/### .*?\n/g, '') // Remove markdown headers
    .replace(/\*\*Prompt:\*\*/gi, '') // Just in case
    .replace(/\*\*/g, '') // Remove all bold markers
    .replace(/---[\s\S]*$/g, '') // Remove horizontal rules and everything after
    .trim();
  console.log("Regex 4 done.");
    
  if (cleaned.toLowerCase().startsWith('to optimize') || cleaned.toLowerCase().startsWith('here is') || cleaned.toLowerCase().startsWith('this prompt')) {
     const paragraphs = cleaned.split('\n\n');
     for (const p of paragraphs) {
        if (p.match(/(?:A cinematic|Cinematic|Shot on|Medium shot|Close up|Wide shot|A detailed|A realistic|A hyper-realistic|Camera starts|The scene opens)/i)) {
            cleaned = p;
            break;
        }
     }
  }

  return cleaned.trim();
};

console.log(sanitizePrompt(text));
