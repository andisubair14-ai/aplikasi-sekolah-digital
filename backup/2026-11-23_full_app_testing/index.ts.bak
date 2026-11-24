import {setGlobalOptions} from "firebase-functions";
import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret, defineString} from "firebase-functions/params";
import {initializeApp, getApps} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
  getFirestore,
} from "firebase-admin/firestore";
import {createHash, randomBytes} from "node:crypto";
import {Resend} from "resend";

setGlobalOptions({maxInstances: 10});

const resendApiKey = defineSecret("RESEND_API_KEY");
const appBaseUrl = defineString("APP_BASE_URL");

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

type AccountRole = "admin" | "guru" | "kepsek";

const ACCOUNT_ROLES: AccountRole[] = ["admin", "guru", "kepsek"];
const INVITE_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const TRIAL_DAYS = 30;
const ACTIVATION_PROCESSING_LEASE_MS = 15 * 60 * 1000;

function cleanText(value: unknown, maxLength = 120): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createSchoolId(): string {
  return `SDK-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function createActivationToken(): string {
  return randomBytes(32).toString("hex");
}

function requirePlatformOwner(
  request: { auth?: { token: Record<string, unknown> } | null },
): void {
  if (request.auth?.token.platformOwner !== true) {
    throw new HttpsError(
      "permission-denied",
      "Hanya Super Admin yang dapat menyetujui pendaftaran sekolah.",
    );
  }
}

/**
 * Email konfirmasi otomatis saat formulir pendaftaran sekolah diterima.
 * Fungsi lama dipertahankan.
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

    const {data: hasil, error} = await resend.emails.send({
      from: "Aplikasi Sekolah Digital <onboarding@resend.dev>",
      to: [email],
      subject: "Pendaftaran Sekolah Berhasil Diterima",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b">
          <h2 style="color:#0758cb">Pendaftaran Berhasil Diterima</h2>
          <p>Yth. Pengelola ${escapeHtml(namaSekolah)},</p>
          <p>Terima kasih telah mendaftarkan sekolah Anda pada Aplikasi Sekolah Digital.</p>
          <p>Data pendaftaran telah kami terima dan sedang menunggu pemeriksaan oleh Super Admin.</p>
          <p>Informasi hasil verifikasi dan proses aktivasi akun akan dikirimkan melalui alamat email ini.</p>
          <p>Mohon menunggu informasi selanjutnya.</p>
          <hr />
          <p style="font-size:12px;color:#64748b">Email otomatis dari Aplikasi Sekolah Digital. Mohon tidak membalas email ini.</p>
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
  },
);

/**
 * Dipanggil oleh tombol Setujui di Platform Control.
 * Membuat sekolah, tiga undangan, dan mengirim tautan aktivasi ke email kontak.
 */
export const setujuiPendaftaranSekolah = onCall(
  {secrets: [resendApiKey]},
  async (request) => {
    requirePlatformOwner(request);

    const pendaftaranId = cleanText(request.data?.pendaftaranId, 150);
    if (!pendaftaranId) {
      throw new HttpsError("invalid-argument", "ID pendaftaran tidak valid.");
    }

    const registrationRef = db.collection("pendaftaran_sekolah").doc(pendaftaranId);
    const registrationSnapshot = await registrationRef.get();

    if (!registrationSnapshot.exists) {
      throw new HttpsError("not-found", "Data pendaftaran tidak ditemukan.");
    }

    const registration = registrationSnapshot.data()!;
    const status = cleanText(registration.status);
    const existingSchoolId = cleanText(registration.sekolahId);
    const isRetry = status === "disetujui_menunggu_provisioning" && Boolean(existingSchoolId);

    if (status === "selesai") {
      throw new HttpsError("already-exists", "Email aktivasi sudah berhasil dikirim untuk pendaftaran ini.");
    }
    if (status !== "menunggu_verifikasi" && !isRetry) {
      throw new HttpsError("failed-precondition", "Pendaftaran tidak berada pada status yang dapat diproses.");
    }

    const baseUrl = appBaseUrl.value().replace(/\/+$/, "");
    if (!/^https:\/\//i.test(baseUrl)) {
      throw new HttpsError("failed-precondition", "Konfigurasi APP_BASE_URL harus menggunakan HTTPS.");
    }

    const namaSekolah = cleanText(registration.namaSekolah);
    const emailKontak = cleanText(registration.email, 254).toLowerCase();

    if (!namaSekolah || !emailKontak || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailKontak)) {
      throw new HttpsError(
        "failed-precondition",
        "Nama sekolah atau email kontak pendaftaran tidak valid.",
      );
    }

    const schoolId = isRetry ? existingSchoolId : createSchoolId();
    const schoolRef = db.collection("sekolah_platform").doc(schoolId);
    const roles = ACCOUNT_ROLES.map((role) => {
      const token = createActivationToken();
      const tokenHash = hashToken(token);
      return {
        role,
        token,
        tokenHash,
        inviteRef: db.collection("aktivasi_akun").doc(tokenHash),
      };
    });

    const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_LIFETIME_MS);

    if (isRetry) {
      // Token lama tidak disimpan dalam bentuk asli. Saat kirim ulang, token baru dibuat
      // dan undangan lama dibatalkan agar tautan lama tidak tetap berlaku.
      const oldInvites = await db.collection("aktivasi_akun")
        .where("pendaftaranId", "==", pendaftaranId).get();
      const revokeBatch = db.batch();
      oldInvites.docs.forEach((inviteDoc) => {
        if (inviteDoc.data().status === "menunggu" || inviteDoc.data().status === "diproses") {
          revokeBatch.update(inviteDoc.ref, {
            status: "dibatalkan",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      });
      await revokeBatch.commit();
    }

    await db.runTransaction(async (transaction) => {
      const freshRegistration = await transaction.get(registrationRef);
      const freshSchool = await transaction.get(schoolRef);
      if (!freshRegistration.exists || (isRetry ? !freshSchool.exists : freshSchool.exists)) {
        throw new HttpsError("aborted", "Data sekolah berubah. Muat ulang dan coba kembali.");
      }

      const freshData = freshRegistration.data()!;
      const expectedStatus = isRetry ? "disetujui_menunggu_provisioning" : "menunggu_verifikasi";
      if (freshData.status !== expectedStatus || (isRetry && freshData.sekolahId !== schoolId)) {
        throw new HttpsError("failed-precondition", "Pendaftaran sudah diproses oleh pengguna lain.");
      }

      if (!isRetry) {
        transaction.create(schoolRef, {
          sekolahId: schoolId,
          namaSekolah,
          npsn: cleanText(registration.npsn, 8),
          jenjang: cleanText(registration.jenjang, 30),
          provinsi: cleanText(registration.provinsi, 80),
          kabupaten: cleanText(registration.kabupaten, 100),
          alamat: cleanText(registration.alamat, 500),
          email: emailKontak,
          telepon: cleanText(registration.telepon, 30),
          namaKepalaSekolah: cleanText(registration.namaKepalaSekolah, 120),
          status: "nonaktif",
          statusLangganan: "belum_diatur",
          tanggalMulaiTrial: null,
          tanggalBerakhirTrial: null,
          jumlahAkunAwal: 3,
          dibuatDariPendaftaran: pendaftaranId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      for (const invite of roles) {
        transaction.create(invite.inviteRef, {
          sekolahId: schoolId,
          pendaftaranId,
          role: invite.role,
          kodeAkun: `${schoolId}-${invite.role}`,
          status: "menunggu",
          expiresAt,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      transaction.update(registrationRef, {
        status: "disetujui_menunggu_provisioning",
        sekolahId: schoolId,
        catatanAdmin: isRetry ?
          "Pengiriman tautan aktivasi sedang dicoba kembali." :
          "Pendaftaran disetujui. Tautan aktivasi akun telah disiapkan.",
        ditinjauOleh: request.auth?.uid || null,
        ditinjauEmail: request.auth?.token.email || null,
        ditinjauPada: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    const invitationLinks = roles.map((invite) => {
      const link = `${baseUrl}/aktivasi-akun#token=${invite.token}`;
      const label = invite.role === "kepsek" ?
        "Kepala Sekolah" :
        invite.role === "admin" ?
          "Admin Sekolah" :
          "Guru";
      return `<li style="margin:12px 0"><strong>${label}</strong><br/><a href="${link}">Aktifkan akun ${label}</a><br/><span style="color:#64748b;font-size:12px">Kode akun: ${schoolId}-${invite.role}</span></li>`;
    }).join("");

    const resend = new Resend(resendApiKey.value());
    const {data: emailResult, error: emailError} = await resend.emails.send({
      from: "Aplikasi Sekolah Digital <onboarding@resend.dev>",
      to: [emailKontak],
      subject: `Pendaftaran ${namaSekolah} Disetujui – Aktivasi Akun`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.7;color:#1e293b;max-width:620px">
          <h2 style="color:#0758cb">Pendaftaran Sekolah Disetujui</h2>
          <p>Yth. Pengelola ${escapeHtml(namaSekolah)},</p>
          <p>Pendaftaran sekolah Anda telah disetujui. Kode sekolah Anda adalah <strong>${schoolId}</strong>.</p>
          <p>Berikut tiga tautan aktivasi. Teruskan setiap tautan hanya kepada pengguna yang bersangkutan.</p>
          <ol>${invitationLinks}</ol>
          <p>Setiap tautan hanya dapat digunakan satu kali dan berlaku selama 7 hari. Saat aktivasi, masing-masing pengguna memasukkan email pribadi dan membuat kata sandinya sendiri.</p>
          <p>Masa uji coba 30 hari dimulai setelah akun Admin berhasil diaktifkan.</p>
          <hr/><p style="font-size:12px;color:#64748b">Jika Anda tidak mengajukan pendaftaran ini, abaikan email ini dan hubungi pengelola platform.</p>
        </div>
      `,
    });

    if (emailError) {
      await registrationRef.update({
        emailAktivasi: {
          status: "gagal",
          keterangan: emailError.message,
          diperbaruiPada: FieldValue.serverTimestamp(),
        },
      });
      throw new HttpsError(
        "internal",
        "Sekolah sudah tercatat disetujui, tetapi email aktivasi gagal dikirim. Perlu proses pengiriman ulang.",
      );
    }

    await registrationRef.update({
      status: "selesai",
      emailAktivasi: {
        status: "terkirim",
        resendId: emailResult?.id || "",
        dikirimPada: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {success: true, sekolahId: schoolId};
  },
);

/**
 * Aktivasi publik. Pengguna mengisi nama, email pribadi, dan kata sandi.
 * Token harus valid, belum dipakai, dan belum kedaluwarsa.
 */
export const aktifkanAkunSekolah = onCall(async (request) => {
  const token = cleanText(request.data?.token, 128);
  const nama = cleanText(request.data?.nama, 120);
  const email = cleanText(request.data?.email, 254).toLowerCase();
  const password = String(request.data?.password ?? "");

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new HttpsError("invalid-argument", "Tautan aktivasi tidak valid.");
  }
  if (nama.length < 2) {
    throw new HttpsError("invalid-argument", "Nama lengkap wajib diisi.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Alamat email tidak valid.");
  }
  if (password.length < 10) {
    throw new HttpsError("invalid-argument", "Kata sandi minimal 10 karakter.");
  }

  const tokenHash = hashToken(token);
  const inviteRef = db.collection("aktivasi_akun").doc(tokenHash);
  let inviteData: Record<string, unknown> | undefined;

  await db.runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);
    if (!inviteSnapshot.exists) {
      throw new HttpsError("not-found", "Tautan aktivasi tidak ditemukan atau sudah tidak berlaku.");
    }

    const data = inviteSnapshot.data()!;
    const processingAt = data.processingAt instanceof Timestamp ? data.processingAt.toMillis() : 0;
    const processingLeaseExpired = data.status === "diproses" &&
      processingAt > 0 && Date.now() - processingAt > ACTIVATION_PROCESSING_LEASE_MS;
    if (data.status !== "menunggu" && !processingLeaseExpired) {
      throw new HttpsError("failed-precondition", "Tautan aktivasi sudah digunakan atau sedang diproses.");
    }
    if (!(data.expiresAt instanceof Timestamp) || data.expiresAt.toMillis() <= Date.now()) {
      throw new HttpsError("deadline-exceeded", "Tautan aktivasi sudah kedaluwarsa.");
    }
    if (!ACCOUNT_ROLES.includes(data.role as AccountRole) || !data.sekolahId || !data.kodeAkun) {
      throw new HttpsError("failed-precondition", "Data undangan aktivasi tidak valid.");
    }

    inviteData = data;
    transaction.update(inviteRef, {
      status: "diproses",
      processingAt: FieldValue.serverTimestamp(),
    });
  });

  if (!inviteData) {
    throw new HttpsError("internal", "Data undangan tidak dapat dibaca.");
  }

  let createdUid: string | null = null;

  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: nama,
      emailVerified: false,
      disabled: false,
    });
    createdUid = userRecord.uid;

    const role = inviteData.role as AccountRole;
    const schoolId = String(inviteData.sekolahId);
    const kodeAkun = String(inviteData.kodeAkun);

    await auth.setCustomUserClaims(createdUid, {
      role,
      sekolahId: schoolId,
    });

    const userRef = db.collection("users").doc(createdUid);
    const schoolRef = db.collection("sekolah_platform").doc(schoolId);

    await db.runTransaction(async (transaction) => {
      const inviteSnapshot = await transaction.get(inviteRef);
      const schoolSnapshot = await transaction.get(schoolRef);

      if (!inviteSnapshot.exists ||
          inviteSnapshot.data()?.status !== "diproses" ||
          !schoolSnapshot.exists) {
        throw new HttpsError("aborted", "Status undangan berubah. Silakan hubungi administrator.");
      }

      transaction.create(userRef, {
        uid: createdUid,
        email,
        nama,
        role,
        sekolahId: schoolId,
        kodeAkun,
        guruId: null,
        aktif: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(inviteRef, {
        status: "digunakan",
        uid: createdUid,
        email,
        nama,
        usedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (role === "admin") {
        const start = Timestamp.now();
        const end = Timestamp.fromMillis(start.toMillis() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

        transaction.update(schoolRef, {
          status: "aktif",
          statusLangganan: "trial",
          tanggalMulaiTrial: start,
          tanggalBerakhirTrial: end,
          adminAktifUid: createdUid,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    });

    return {
      success: true,
      role,
      sekolahId: schoolId,
      kodeAkun,
      message: "Akun berhasil diaktifkan. Silakan masuk menggunakan email dan kata sandi Anda.",
    };
  } catch (error) {
    if (createdUid) {
      try {
        await auth.deleteUser(createdUid);
      } catch (deleteError) {
        console.error("Gagal membersihkan akun Auth setelah aktivasi gagal:", deleteError);
      }
    }

    await inviteRef.update({
      status: "menunggu",
      processingAt: FieldValue.delete(),
      lastError: error instanceof Error ? error.message.slice(0, 300) : "Kesalahan aktivasi.",
      updatedAt: FieldValue.serverTimestamp(),
    }).catch((resetError) => {
      console.error("Gagal mengembalikan status undangan:", resetError);
    });

    if (error instanceof HttpsError) {
      throw error;
    }

    const errorCode = typeof error === "object" && error !== null && "code" in error ?
      String((error as { code?: unknown }).code) :
      "";

    if (errorCode === "auth/email-already-exists") {
      throw new HttpsError(
        "already-exists",
        "Email ini sudah digunakan. Gunakan email pribadi lain yang belum terdaftar.",
      );
    }

    console.error("Aktivasi akun sekolah gagal:", error);
    throw new HttpsError("internal", "Aktivasi belum berhasil. Silakan coba kembali.");
  }
});
