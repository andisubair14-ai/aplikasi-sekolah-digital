
import { model } from "../lib/firebase";

export async function ujiKoneksiGemini(): Promise<string> {
  try {
    console.log("Menghubungi Gemini...");

    const result = await model.generateContent(
      "Balas hanya dengan kalimat: Koneksi Gemini berhasil!"
    );

    const jawaban = result.response.text();

    if (!jawaban) {
      throw new Error("Gemini tidak memberikan jawaban.");
    }

    console.log("Jawaban Gemini:", jawaban);

    return jawaban;
  } catch (error) {
    console.error("Pengujian Gemini gagal:", error);
    throw error;
  }
}
