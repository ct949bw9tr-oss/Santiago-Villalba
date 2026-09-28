"use client";

import { useEffect } from "react";

const SCRIPT_ID = "esp-web-tools";
// ESP Web Tools: flashes an ESP32 from the browser over Web Serial (Chrome / Edge on a computer).
const SCRIPT_SRC = "https://unpkg.com/esp-web-tools@10.4.0/dist/web/install-button.js?module";

export function WebInstaller({ manifest }: { manifest: string }) {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.type = "module";
    s.src = SCRIPT_SRC;
    document.head.appendChild(s);
  }, []);

  // A web component: rendered as HTML so React doesn't need its typings.
  const html = `
    <style>esp-web-install-button:not(:defined) span[slot] { display: none; }</style>
    <esp-web-install-button manifest="${manifest}">
      <button slot="activate" class="lg">Instalar programa en el lector</button>
      <span slot="unsupported"><div class="callout warning"><p>Este navegador no puede instalar el programa. Usa <b>Google Chrome</b> o <b>Microsoft Edge</b> en un computador (Mac o PC). No funciona en iPad ni en celular.</p></div></span>
      <span slot="not-allowed"><div class="callout warning"><p>La instalación necesita una conexión segura (https). Abre EduTrack desde su dirección normal.</p></div></span>
    </esp-web-install-button>`;
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
