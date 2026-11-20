import { setGlobalOptions } from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";

setGlobalOptions({ maxInstances: 10 });

// API Key Resend disimpan sebagai Secret, bukan ditulis langsung di kode.
const resendApiKey = defineSecret("RESEND_API_KEY");

// Inisialisasi Firebase Admin
if (getApps().length === 0) {
  initializeApp();
}

/**
 * Mengirim email konfirmasi secara otomatis
 * ketika pendaftaran sekolah baru masuk.
 */
export const kirimKonfirmasiPendaftaran = onDocumentCreated(
  {
    document: "pendaftaran_sekolah/{pendaftaranId}",
    secrets: [resendApiKey],
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      return;
    }

    const data = snapshot.data();
    const email = String(data.email || "").trim().toLowerCase();
    const namaSekolah = String(data.namaSekolah || "").trim();

    if (!email || !namaSekolah) {
      await snapshot.ref.update({
        emailPenerimaan: {
          status: "gagal",
          keterangan: "Email atau nama sekolah tidak tersedia.",
          diperbaruiPada: FieldValue.serverTimestamp(),
        },
      });
      return;
    }

    const resend = new Resend(resendApiKey.value());

    const { data: hasil, error } = await resend.emails.send({
      from: "Aplikasi Sekolah Digital <onboarding@resend.dev>",
      to: [email],
      subject: "Pendaftaran Sekolah Berhasil Diterima",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.7; color: #1e293b;">
          <h2 style="color: #0758cb;">
            Pendaftaran Berhasil Diterima
          </h2>

          <p>Yth. Pengelola ${namaSekolah},</p>

          <p>
            Terima kasih telah mendaftarkan sekolah Anda
            pada Aplikasi Sekolah Digital.
          </p>

          <p>
            Data pendaftaran sekolah Anda telah kami terima
            dan saat ini sedang menunggu pemeriksaan
            oleh Super Admin.
          </p>

          <p>
            Informasi mengenai hasil verifikasi dan
            proses aktivasi akun akan dikirimkan
            melalui alamat email ini.
          </p>

          <p>
            Mohon menunggu informasi selanjutnya.
          </p>

          <hr />

          <p style="font-size: 12px; color: #64748b;">
            Email otomatis dari Aplikasi Sekolah Digital.
            Mohon tidak membalas email ini.
          </p>
        </div>
      `,
    });

    if (error) {
      await snapshot.ref.update({
        emailPenerimaan: {
          status: "gagal",
          keterangan: error.message,
          diperbaruiPada: FieldValue.serverTimestamp(),
        },
      });

      return;
    }

    await snapshot.ref.update({
      emailPenerimaan: {
        status: "terkirim",
        resendId: hasil?.id || "",
        dikirimPada: FieldValue.serverTimestamp(),
      },
    });
  }
);
