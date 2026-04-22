import { GoogleGenAI } from "@google/genai";

// Functie om de AI client veilig op te halen zonder de app te laten crashen bij opstarten
function getAI() {
  const apiKey = import.meta.env.VITE_GOOGLE_AI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error("MISSING_API_KEY");
  }
  
  return new GoogleGenAI({ apiKey });
}

export async function generateReading(userName: string, cardNames: string[], mode: 'single' | 'three'): Promise<string> {
  let prompt = '';
  
  if (mode === 'single') {
    prompt = `Je bent Madame Baba Yulya, De Stem van het Schaduwlicht, een wijs, warm en spiritueel medium. De gebruiker heet "${userName}" en heeft zojuist de orakelkaart "${cardNames[0]}" getrokken uit het deck van Engelen & Spirits. Schrijf een gepersonaliseerde, inspirerende en mysterieuze boodschap (max 150 woorden) voor ${userName} gebaseerd op deze kaart. Spreek de gebruiker direct en persoonlijk aan (met jij/jou). Formatteer het leuk en makkelijk leesbaar (korte alinea's, misschien een sterretje of bloemetje emoji, maar houd het sfeervol). De toon is geruststellend, magisch en respectvol. Gebruik geen formele begroetingen, val direct in de sfeer.`;
  } else {
    prompt = `Je bent Madame Baba Yulya, De Stem van het Schaduwlicht, een wijs, warm en spiritueel medium. De gebruiker heet "${userName}" en heeft zojuist een Verleden-Heden-Toekomst orakellegging gedaan met de volgende 3 kaarten:
- Verleden: "${cardNames[0]}"
- Heden: "${cardNames[1]}"
- Toekomst: "${cardNames[2]}"

Schrijf een gepersonaliseerde, inspirerende en mysterieuze reading (max 300 woorden) voor ${userName}. Verbind de thema's van de kaarten als een lopend verhaal dat inzichten geeft in waar ze vandaan komen, waar ze nu staan en waar ze naartoe bewegen. Spreek de gebruiker direct en persoonlijk aan. Formatteer het prachtig (korte alinea's, emoji's). De toon is geruststellend, magisch en respectvol. Gebruik Markdown **headers** voor elke tijdsperiode als dat past, of weef het natuurlijk door elkaar. Val direct in de sfeer.`;
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "De geesten zijn momenteel stil... Probeer het later nog eens.";
  } catch (error: any) {
    if (error.message === "MISSING_API_KEY") {
      return "De kosmische verbinding is verbroken. Er is geen API Key ingesteld. Voeg de VITE_GOOGLE_AI_API_KEY toe in de environment variabelen/Netlify settings om inzichten te openbaren.";
    }
    console.error("Fout bij het ophalen van de lezing:", error);
    throw new Error("Madame Baba Yulya kon helaas geen verbinding maken met de andere kant.");
  }
}

export async function generateSpeech(text: string): Promise<string | null> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `Spreek vlot, mystiek, en warm uit in het Nederlands: ${text}` }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore is a nice feminine voice
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error: any) {
    if (error.message === "MISSING_API_KEY") {
       return null; // Skip TTS gracefully if key is missing
    }
    if (error?.status === 429 || error?.message?.includes("RESOURCE_EXHAUSTED")) {
      console.warn("API Limiet bereikt (429) voor TTS. Er wordt geen audio afgespeeld.");
    } else {
      console.error("Fout bij tts:", error);
    }
    return null;
  }
}

let globalAudioContext: AudioContext | null = null;
let currentAudioSource: AudioBufferSourceNode | null = null;
let cancelQueue = false;

export function stopAudio() {
  cancelQueue = true;
  if (currentAudioSource) {
    try {
      currentAudioSource.stop();
    } catch (e) {}
    currentAudioSource = null;
  }
}

export function initAudio() {
  if (!globalAudioContext) {
    globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
}

export function playTTSStream(text: string, onStart?: () => void, onEnd?: () => void) {
  cancelQueue = false;
  // Make texts friendly for speech synthesis
  const cleanText = text.replace(/[*#_]/g, '');
  
  generateSpeech(cleanText).then(audioData => {
    if (cancelQueue) return;
    if (audioData) {
      if (onStart) onStart();
      playPCM(audioData, () => {
        if (onEnd) onEnd();
      });
    } else {
      // If error (like 429), just gracefully end so UI doesn't hang in "Voorlezen" state indefinitely
      if (onEnd) onEnd();
    }
  });
}

export async function playPCM(base64Audio: string, onEnded?: () => void) {
  try {
    if (!globalAudioContext) {
      globalAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (globalAudioContext.state === 'suspended') {
      await globalAudioContext.resume();
    }

    stopAudio();

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const dataView = new DataView(bytes.buffer);
    const audioBuffer = globalAudioContext.createBuffer(1, bytes.length / 2, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < bytes.length / 2; i++) {
        const int16 = dataView.getInt16(i * 2, true);
        channelData[i] = int16 / 32768.0;
    }
    
    const source = globalAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = 1.15; // Speed up the audio slightly
    source.connect(globalAudioContext.destination);

    source.onended = () => {
      if (currentAudioSource === source) {
        currentAudioSource = null;
      }
      if (onEnded) onEnded();
    };

    currentAudioSource = source;
    source.start();
  } catch (e) {
    console.error("Fout bij afspelen audio", e);
    if (onEnded) onEnded();
  }
}

export async function generateDeepCardMeaning(cardName: string, shortMeaning: string): Promise<string> {
  const prompt = `Je bent Madame Baba Yulya, De Stem van het Schaduwlicht, een wijs en spiritueel medium. De gebruiker vraagt om verdieping voor de orakelkaart "${cardName}". 
De korte betekenis in het archief luidt: "${shortMeaning}". 

Geef een diepgaande interpretatie die specifieke, praktische sturing biedt. Gebruik strikt de volgende drie secties met Markdown **dikgedrukte koppen**, zonder inleiding of afsluiting:

**🔮 Diepere Duiding**
(Verklaar de spirituele, verborgen betekenis en energie van de kaart.)

**❤️ Liefde & Relaties**
(Wat betekent dit voor bestaande of toekomstige relaties, vriendschappen of familiedynamiek?)

**💼 Carrière & Levenspad**
(Hoe kunnen ze deze wijsheid toepassen op hun werk, passie, of grote levenskeuzes?)

Toon: Warm, inzichtelijk, en mystiek. Totaal maximaal 250 woorden.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "De ether is momenteel stil... Probeer het later nog eens.";
  } catch (error: any) {
    if (error.message === "MISSING_API_KEY") {
      return "**🔮 Diepere Duiding**\nEr ontbreekt momenteel een API Key in de Netlify configuratie (VITE_GOOGLE_AI_API_KEY). De archieven blijven daarom even gesloten.\n\n**❤️ Liefde & Relaties**\nOnbekend...\n\n**💼 Carrière & Levenspad**\nOnbekend...";
    }
    console.error("Fout bij het ophalen van de diepe lezing:", error);
    throw new Error("Madame Baba Yulya kon de verborgen archieven niet openen.");
  }
}

export async function generateCardImage(cardName: string): Promise<string> {
  const promptText = `A beautiful, highly detailed, 3D-style, Realistic, ethereal and magical oracle tarot card illustration centered on the concept of: ${cardName}. Glowing aura, dark purple and gold color palette, fantasy gothic style, masterpiece, 4k resolution, symmetrical portrait layout.`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: promptText,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      },
    });

    let imageUrl = '';
    if (response.candidates && response.candidates[0] && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          imageUrl = `data:image/jpeg;base64,${base64EncodeString}`;
          break;
        }
      }
    }

    if (imageUrl) {
      return imageUrl;
    } else {
      throw new Error("No image was returned.");
    }
  } catch (error) {
    console.error("Fout bij het genereren van de afbeelding:", error);
    // Fallback if image generation fails
    return `https://picsum.photos/seed/${encodeURIComponent(cardName)}/600/800/?blur=4`;
  }
}
