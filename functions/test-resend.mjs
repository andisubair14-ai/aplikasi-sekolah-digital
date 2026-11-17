
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config({ path: ".secret.local" });

const apiKey = process.env.RESEND_API_KEY;
const recipient = process.env.RESEND_TEST_TO;

if (!apiKey || !recipient) {
  throw new Error("RESEND_API_KEY atau RESEND_TEST_TO belum diatur.");
}

const resend = new Resend(apiKey);

try {
  const { data, error } = await resend.emails.send({
    from: "Aplikasi Sekolah Digital <onboarding@resend.dev>",
    to: [recipient],
    subject: "Uji Email Aplikasi Sekolah Digital",
    html: `
      <h2>Uji Pengiriman Email Berhasil</h2>
      <p>Email ini merupakan pengujian integrasi Resend.</p>
      <p>Aplikasi Sekolah Digital sedang menyiapkan sistem aktivasi akun sekolah.</p>
    `,
  });

  if (error) {
    console.error("Pengiriman gagal:", error);
    process.exitCode = 1;
  } else {
    console.log("Email berhasil dikirim!");
    console.log("Email ID:", data.id);
  }
} catch (err) {
  console.error("Terjadi kesalahan:", err);
  process.exitCode = 1;
}
