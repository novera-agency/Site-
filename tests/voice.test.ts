import { describe, it, expect } from "vitest";
import { matchChoice, parseFrenchNumber } from "@/lib/voice-match";

describe("Compréhension orale", () => {
  it("lit les nombres dits en français", () => {
    expect(parseFrenchNumber("quarante mille euros")).toBe(40000);
    expect(parseFrenchNumber("40 000")).toBe(40000);
    expect(parseFrenchNumber("environ 8,5 ans")).toBe(8.5);
    expect(parseFrenchNumber("huit virgule cinq")).toBe(8.5);
    expect(parseFrenchNumber("je dirais 1,2 million")).toBe(1200000);
    expect(parseFrenchNumber("soixante-quinze")).toBe(75);
    expect(parseFrenchNumber("quatre-vingt-douze pour cent")).toBe(92);
    expect(parseFrenchNumber("deux cent cinquante mille")).toBe(250000);
    expect(parseFrenchNumber("aucune idée")).toBeNull();
  });
  it("rapproche une phrase libre de la bonne réponse", () => {
    const choices = [
      "Couvrir la sensibilité en vendant des futures Bund (couverture en DV01).",
      "Vendre la moitié des obligations les plus longues.",
      "Ne rien faire : les taux vont redescendre.",
      "Racheter des obligations longues : elles sont moins chères.",
    ];
    expect(matchChoice("je propose de couvrir avec des futures sur le Bund", choices).index).toBe(0);
    expect(matchChoice("on attend, je pense que les taux vont redescendre", choices).index).toBe(2);
    expect(matchChoice("la deuxième", choices)).toMatchObject({ index: 1, how: "ordinal" });
    expect(matchChoice("bonjour", choices).ambiguous).toBe(true);
  });
});

import { voiceCast } from "@/lib/voice";
describe("Voix des participants", () => {
  it("chaque participant d'une réunion a une voix distincte (même sans voix française installée)", () => {
    const people = ["boss", "director", "senior", "analyst", "colleague", "risk", "compliance"].map((id) => ({ id }));
    const cast = voiceCast(people);
    const keys = people.map((p) => { const c = cast.get(p.id)!.profile; return `${c.voice?.name ?? "-"}|${c.pitch}|${c.rate}`; });
    expect(new Set(keys).size).toBe(people.length);
    // stable : même distribution à chaque appel
    expect(voiceCast(people).get("boss")!.profile.pitch).toBe(cast.get("boss")!.profile.pitch);
  });
});

import { voiceQuality } from "@/lib/voice";
describe("Qualité des voix", () => {
  const v = (name: string, localService = true) => ({ name, lang: "fr-FR", localService, voiceURI: name, default: false }) as SpeechSynthesisVoice;
  it("les voix naturelles et premium passent devant les voix standard et les voix fantaisie", () => {
    const list = [v("Eddy (Français (France))"), v("Thomas"), v("Google français", false), v("Audrey (Premium)"), v("Microsoft Denise Online (Natural) - French (France)", false)];
    const sorted = [...list].sort((a, b) => voiceQuality(b).score - voiceQuality(a).score).map((x) => x.name);
    expect(sorted[0]).toMatch(/Natural/);
    expect(sorted[1]).toMatch(/Premium/);
    expect(sorted[2]).toMatch(/Google/);
    expect(sorted[sorted.length - 1]).toMatch(/Eddy/);
    expect(voiceQuality(v("Microsoft Henri Online (Natural)")).label).toBe("naturelle");
  });
});
