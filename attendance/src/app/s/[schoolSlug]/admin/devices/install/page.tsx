import Link from "next/link";
import { Cable, Laptop, Nfc, Smartphone, Wifi } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { appOrigin } from "@/server/admin/common";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { WebInstaller } from "./web-installer";

export const metadata = { title: "Instalar lector Wi-Fi" };

const MANIFEST = "/firmware/edutrack-dial/manifest.json";

export default async function InstallReaderPage({ params }: PageProps<"/s/[schoolSlug]/admin/devices/install">) {
  const { schoolSlug } = await params;
  await requireRole(schoolSlug, "school_admin");
  const origin = await appOrigin();
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack-lg">
      <PageHeader
        back={{ href: `${base}/devices`, label: "Lectores NFC" }}
        title="Instalar lector Wi-Fi"
        subtitle="Para el M5Stack Dial: se hace una sola vez por aparato, desde un computador."
      />

      <div className="grid-main">
        <div className="stack">
          <Card title="1. Instalar el programa (en tu computador)">
            <ol className="stack-sm" style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>
                Abre esta página en <b>Google Chrome</b> o <b>Microsoft Edge</b> en un computador.
              </li>
              <li>
                Conecta el Dial al computador con un <b>cable USB-C de datos</b> (algunos cables solo cargan: si no aparece, prueba
                otro).
              </li>
              <li>
                Toca el botón, elige el dispositivo que aparece (suele llamarse <i>USB JTAG/serial debug unit</i>) y luego{" "}
                <b>Install</b>. Tarda unos 2 minutos.
              </li>
              <li>Cuando termine, el Dial muestra “Configurar”. Desconéctalo.</li>
            </ol>
            <div style={{ marginTop: "1rem" }}>
              <WebInstaller manifest={MANIFEST} />
            </div>
          </Card>

          <Card title="2. Vincularlo en el salón (desde tu celular)">
            <ol className="stack-sm" style={{ margin: 0, paddingLeft: "1.2rem" }}>
              <li>
                En <Link href={`${base}/devices`}>Lectores NFC</Link>, crea un lector para ese salón y copia su <b>token</b>.
              </li>
              <li>Enchufa el Dial en el salón con un cargador de celular.</li>
              <li>
                En tu celular: <b>Ajustes → Wi-Fi → “EduTrack-Lector”</b>. Se abre una página (si no, abre el navegador).
              </li>
              <li>
                Toca <b>Configurar WiFi</b>, elige el Wi-Fi del colegio, escribe su contraseña, pega el <b>token</b> y revisa que la{" "}
                <b>Dirección de EduTrack</b> sea:
                <div className="mono" style={{ marginTop: 6, padding: "6px 10px", background: "var(--surface-2)", borderRadius: 8, overflowWrap: "anywhere" }}>
                  {origin}
                </div>
              </li>
              <li>Guarda. El Dial se conecta, pita y muestra “Acerca tu tarjeta”.</li>
            </ol>
          </Card>
        </div>

        <div className="stack">
          <Card title="Qué necesitas">
            <ul className="list">
              {[
                { icon: Nfc, text: "M5Stack Dial (con RFID 13.56 MHz)" },
                { icon: Laptop, text: "Un computador con Chrome o Edge (solo para instalar)" },
                { icon: Cable, text: "Cable USB-C de datos y un cargador de celular" },
                { icon: Wifi, text: "Wi-Fi del colegio de 2.4 GHz con contraseña" },
                { icon: Smartphone, text: "Tu celular, para vincularlo" },
              ].map((i) => (
                <li key={i.text} className="list-item">
                  <span className="feed-icon tone-blue">
                    <i.icon size={15} />
                  </span>
                  <span className="small-text">{i.text}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="En el día a día">
            <ul className="stack-sm small-text" style={{ margin: 0, paddingLeft: "1.1rem" }}>
              <li>
                <b>Botón (toque corto):</b> muestra colegio, lector, Wi-Fi y lecturas pendientes.
              </li>
              <li>
                <b>Botón 5 segundos:</b> borra el Wi-Fi y el token para configurarlo de nuevo.
              </li>
              <li>
                <b>Sin internet:</b> sigue aceptando tarjetas, las guarda (aunque se vaya la luz) y las envía al volver, con su hora
                original.
              </li>
              <li>
                Para red Wi-Fi con página de inicio de sesión o usuario y contraseña (empresarial): no es compatible todavía.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
