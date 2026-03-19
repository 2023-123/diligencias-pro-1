import React, { useEffect, useMemo, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { loadState, saveState } from "./storage";

/** ===========================
 * Helpers
 * =========================== */
const uid = () =>
  `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;

function nowLocalISOString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function dtLocalToISO(dtLocal) {
  if (!dtLocal) return new Date().toISOString();
  const d = new Date(dtLocal);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function fmtDateTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR");
  } catch {
    return "";
  }
}

function fmtHour(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** ===========================
 * Compressão de imagem
 * =========================== */
async function compressImage(file, maxWidth = 900, quality = 0.65) {
  const img = document.createElement("img");
  const reader = new FileReader();

  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = reject;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed);
    };

    reader.readAsDataURL(file);
  });
}

/** ===========================
 * Modelo de dados
 * =========================== */
function emptyDB() {
  const firstCaseId = uid();

  return {
    version: 3,
    activeCaseId: firstCaseId,
    cases: [
      {
        id: firstCaseId,
        titulo: "Novo Caso",
        reds: "",
        localFato: "",
        equipe: "",
        viatura: "",
        observacoes: "",
        status: "em andamento",
        prioridade: "normal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        pessoas: [],
        eventos: [],
      },
    ],
  };
}

function normalizeImportedDB(obj) {
  if (!obj?.cases?.length) return emptyDB();

  return {
    version: 3,
    activeCaseId: obj.activeCaseId || obj.cases[0]?.id || uid(),
    cases: obj.cases.map((c) => ({
      id: c.id || uid(),
      titulo: c.titulo || "Caso",
      reds: c.reds || "",
      localFato: c.localFato || "",
      equipe: c.equipe || "",
      viatura: c.viatura || "",
      observacoes: c.observacoes || "",
      status: c.status || "em andamento",
      prioridade: c.prioridade || "normal",
      createdAt: c.createdAt || new Date().toISOString(),
      updatedAt: c.updatedAt || new Date().toISOString(),
      pessoas: (c.pessoas || []).map((p) => ({
        id: p.id || uid(),
        nome: p.nome || "",
        telefone: p.telefone || "",
        cpf: p.cpf || "",
        endereco: p.endereco || "",
        papeis: Array.isArray(p.papeis) ? p.papeis : [],
        depoimento: p.depoimento || "",
        fotoDataUrl: p.fotoDataUrl || "",
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      })),
      eventos: (c.eventos || []).map((e) => ({
        id: e.id || uid(),
        titulo: e.titulo || "",
        local: e.local || "",
        descricao: e.descricao || "",
        tipo: e.tipo || "diligência",
        dataHoraLocal: e.dataHoraLocal || nowLocalISOString(),
        dataHoraISO: e.dataHoraISO || dtLocalToISO(e.dataHoraLocal),
        pessoasIds: Array.isArray(e.pessoasIds) ? e.pessoasIds : [],
        foto: e.foto || "",
        gps: e.gps || {
          latitude: "",
          longitude: "",
          mapsLink: "",
        },
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.updatedAt || new Date().toISOString(),
      })),
    })),
  };
}

const ROLES = [
  "testemunha",
  "vítima",
  "suspeito",
  "autor",
  "informante",
  "condutor",
  "solicitante",
  "outro",
];

const EVENT_TYPES = [
  "diligência",
  "contato",
  "abordagem",
  "deslocamento",
  "registro",
  "encerramento",
];

/** ===========================
 * Ícones simples em SVG
 * =========================== */
function IconWrap({ children, size = 20, color = "currentColor" }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        flex: "0 0 auto",
      }}
    >
      {children}
    </span>
  );
}

function HomeIcon({ size = 20, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M3 10.5L12 3l9 7.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.5 9.5V20h13V9.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconWrap>
  );
}

function EventIcon({ size = 20, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M12 21s6-5.6 6-10a6 6 0 10-12 0c0 4.4 6 10 6 10z"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="11" r="2.5" stroke={color} strokeWidth="2" />
      </svg>
    </IconWrap>
  );
}

function PersonIcon({ size = 20, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
        <path
          d="M4 20c1.8-3.5 5-5 8-5s6.2 1.5 8 5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </IconWrap>
  );
}

function CaseIcon({ size = 20, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </IconWrap>
  );
}

function MoreIcon({ size = 20, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle cx="5" cy="12" r="1.8" fill={color} />
        <circle cx="12" cy="12" r="1.8" fill={color} />
        <circle cx="19" cy="12" r="1.8" fill={color} />
      </svg>
    </IconWrap>
  );
}

function SearchIcon({ size = 18, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <circle cx="11" cy="11" r="6.5" stroke={color} strokeWidth="2" />
        <path
          d="M16 16l4 4"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </IconWrap>
  );
}

function PlusIcon({ size = 18, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M12 5v14M5 12h14"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </IconWrap>
  );
}

function SaveIcon({ size = 18, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M5 4h11l3 3v13H5z"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M8 4v5h8V4"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </IconWrap>
  );
}

function ArrowRightIcon({ size = 18, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M9 6l6 6-6 6"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </IconWrap>
  );
}

function EyeIcon({ size = 18, color = "currentColor" }) {
  return (
    <IconWrap size={size} color={color}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
        <path
          d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"
          stroke={color}
          strokeWidth="2"
        />
        <circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
      </svg>
    </IconWrap>
  );
}

/** ===========================
 * App
 * =========================== */
export default function App() {
  const [db, setDb] = useState(emptyDB());
  const [ready, setReady] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    (async () => {
      const loaded = await loadState();
      if (loaded?.cases?.length) {
        setDb(normalizeImportedDB(loaded));
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (savingRef.current) return;

    savingRef.current = true;
    const t = setTimeout(async () => {
      await saveState(db);
      savingRef.current = false;
    }, 250);

    return () => clearTimeout(t);
  }, [db, ready]);

  const activeCase = useMemo(() => {
    return db.cases.find((c) => c.id === db.activeCaseId) || db.cases[0];
  }, [db]);

  const [screen, setScreen] = useState("home");
  const [eventSearch, setEventSearch] = useState("");
  const [personSearch, setPersonSearch] = useState("");

  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);

  function showToast(msg) {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast("");
    }, 1800);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showPersonModal, setShowPersonModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [personDraft, setPersonDraft] = useState(null);
  const [eventDraft, setEventDraft] = useState(null);

  /** Pessoas */
  function openNewPerson() {
    setPersonDraft({
      id: uid(),
      nome: "",
      telefone: "",
      cpf: "",
      endereco: "",
      papeis: [],
      depoimento: "",
      fotoDataUrl: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setShowPersonModal(true);
  }

  function openEditPerson(personId) {
    const p = activeCase.pessoas.find((x) => x.id === personId);
    if (!p) return;
    setPersonDraft({ ...p });
    setShowPersonModal(true);
  }

  async function onPickPersonPhoto(file) {
    if (!file) return;
    const compressed = await compressImage(file, 900, 0.65);
    setPersonDraft((s) => ({ ...s, fotoDataUrl: compressed }));
  }

  function savePerson() {
    const nomeFinal = (personDraft?.nome || "").trim();
    if (!nomeFinal) {
      showToast("Informe o nome da pessoa");
      return;
    }

    const p = {
      ...personDraft,
      nome: nomeFinal,
      updatedAt: new Date().toISOString(),
    };

    setDb((prev) => {
      const cases = prev.cases.map((c) => {
        if (c.id !== prev.activeCaseId) return c;

        const exists = c.pessoas.some((x) => x.id === p.id);
        const pessoas = exists
          ? c.pessoas.map((x) => (x.id === p.id ? p : x))
          : [p, ...c.pessoas];

        return {
          ...c,
          pessoas,
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...prev, cases };
    });

    setShowPersonModal(false);
    showToast("Pessoa salva");
  }

  function deletePerson(personId) {
    if (!window.confirm("Remover esta pessoa do caso?")) return;

    setDb((prev) => {
      const cases = prev.cases.map((c) => {
        if (c.id !== prev.activeCaseId) return c;

        return {
          ...c,
          pessoas: c.pessoas.filter((p) => p.id !== personId),
          eventos: c.eventos.map((e) => ({
            ...e,
            pessoasIds: (e.pessoasIds || []).filter((id) => id !== personId),
          })),
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...prev, cases };
    });

    showToast("Pessoa removida");
  }

  /** Eventos */
  function openNewEvent() {
    const nowLocal = nowLocalISOString();

    setEventDraft({
      id: uid(),
      titulo: "",
      local: "",
      descricao: "",
      tipo: "diligência",
      dataHoraLocal: nowLocal,
      dataHoraISO: dtLocalToISO(nowLocal),
      pessoasIds: [],
      foto: "",
      gps: {
        latitude: "",
        longitude: "",
        mapsLink: "",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setShowEventModal(true);
  }

  function openEditEvent(eventId) {
    const e = activeCase.eventos.find((x) => x.id === eventId);
    if (!e) return;

    setEventDraft({
      ...e,
      tipo: e.tipo || "diligência",
      dataHoraLocal: e.dataHoraLocal || nowLocalISOString(),
      foto: e.foto || "",
      gps: e.gps || {
        latitude: "",
        longitude: "",
        mapsLink: "",
      },
    });

    setShowEventModal(true);
  }

  function saveEvent() {
    if (!eventDraft) return;

    const tituloFinal =
      (eventDraft.titulo || "").trim() ||
      (eventDraft.tipo || "").trim() ||
      "Evento";

    const iso = eventDraft.dataHoraLocal
      ? dtLocalToISO(eventDraft.dataHoraLocal)
      : new Date().toISOString();

    const e = {
      ...eventDraft,
      titulo: tituloFinal,
      tipo: eventDraft.tipo || "diligência",
      dataHoraISO: iso,
      updatedAt: new Date().toISOString(),
    };

    setDb((prev) => {
      const cases = prev.cases.map((c) => {
        if (c.id !== prev.activeCaseId) return c;

        const exists = c.eventos.some((x) => x.id === e.id);
        const eventos = exists
          ? c.eventos.map((x) => (x.id === e.id ? e : x))
          : [e, ...c.eventos];

        eventos.sort((a, b) => (a.dataHoraISO < b.dataHoraISO ? 1 : -1));

        return {
          ...c,
          eventos,
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...prev, cases };
    });

    setShowEventModal(false);
    showToast("Evento salvo");
  }

  function deleteEvent(eventId) {
    if (!window.confirm("Remover este evento?")) return;

    setDb((prev) => {
      const cases = prev.cases.map((c) => {
        if (c.id !== prev.activeCaseId) return c;

        return {
          ...c,
          eventos: c.eventos.filter((e) => e.id !== eventId),
          updatedAt: new Date().toISOString(),
        };
      });

      return { ...prev, cases };
    });

    showToast("Evento removido");
  }

  async function onPickEventPhoto(file) {
    if (!file) return;
    const compressed = await compressImage(file, 900, 0.65);
    setEventDraft((s) => ({
      ...s,
      foto: compressed,
    }));
  }

  function removeEventPhoto() {
    setEventDraft((s) => ({
      ...s,
      foto: "",
    }));
  }

  function captureEventLocation() {
    if (!eventDraft) return;

    if (!navigator.geolocation) {
      alert("Geolocalização não suportada.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);
        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

        setEventDraft((s) => ({
          ...s,
          gps: {
            latitude,
            longitude,
            mapsLink,
          },
        }));
        showToast("Localização capturada");
      },
      (error) => {
        console.error(error);
        alert("Não foi possível capturar a localização.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  function clearEventLocation() {
    setEventDraft((s) => ({
      ...s,
      gps: {
        latitude: "",
        longitude: "",
        mapsLink: "",
      },
    }));
  }

  /** Casos */
  function createCase() {
    const id = uid();

    const novoCaso = {
      id,
      titulo: "",
      reds: "",
      localFato: "",
      equipe: "",
      viatura: "",
      observacoes: "",
      status: "em andamento",
      prioridade: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pessoas: [],
      eventos: [],
    };

    setDb((prev) => ({
      ...prev,
      activeCaseId: id,
      cases: [novoCaso, ...prev.cases],
    }));

    setShowCaseModal(false);
    setScreen("caso");
    showToast("Novo caso criado");
  }

  function duplicateCase(caseId) {
    const src = db.cases.find((c) => c.id === caseId);
    if (!src) return;

    const id = uid();
    const copy = {
      ...src,
      id,
      titulo: `${src.titulo} (cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setDb((prev) => ({
      ...prev,
      activeCaseId: id,
      cases: [copy, ...prev.cases],
    }));

    showToast("Caso duplicado");
  }

  function deleteCase(caseId) {
    if (db.cases.length <= 1) {
      alert("Você precisa manter pelo menos 1 caso.");
      return;
    }

    if (!window.confirm("Excluir este caso inteiro?")) return;

    setDb((prev) => {
      const cases = prev.cases.filter((c) => c.id !== caseId);
      const nextActive =
        prev.activeCaseId === caseId ? cases[0].id : prev.activeCaseId;

      return {
        ...prev,
        cases,
        activeCaseId: nextActive,
      };
    });

    showToast("Caso excluído");
  }

  /** JSON */
  function exportJSON() {
    const data = JSON.stringify(db, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diligencias_backup_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup exportado");
  }

  async function importJSON(file) {
    if (!file) return;

    const text = await file.text();

    try {
      const obj = JSON.parse(text);
      const normalized = normalizeImportedDB(obj);
      setDb(normalized);
      showToast("Importação concluída");
    } catch (e) {
      alert("Falha ao importar: arquivo inválido.");
      console.error(e);
    }
  }

  /** PDF */
  function addWrappedText(doc, text, x, y, maxWidth, lineHeight) {
    const lines = doc.splitTextToSize(text || "", maxWidth);
    lines.forEach((ln) => {
      doc.text(ln, x, y);
      y += lineHeight;
    });
    return y;
  }

  function gerarPDFDoCaso(caseObj) {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = 12;

    const ensureSpace = (needed = 12) => {
      if (y + needed > pageH - margin) {
        doc.addPage();
        y = 12;
      }
    };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("RELATÓRIO DE DILIGÊNCIAS", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, margin, y);
    y += 8;

    const boxY = y;
    const boxX = margin;
    const boxW = pageW - margin * 2;
    const innerPadTop = 6;
    const innerPadBottom = 6;
    const lineGap = 5;
    const headerGap = 6;
    const contentX = margin + 3;
    const contentW = boxW - 6;

    const titleLines = doc.splitTextToSize(
      `Título: ${caseObj.titulo || ""}`,
      contentW
    );
    const localLines = doc.splitTextToSize(
      `Local do fato: ${caseObj.localFato || ""}`,
      contentW
    );
    const equipeLines = doc.splitTextToSize(
      `Equipe: ${caseObj.equipe || ""}`,
      contentW
    );
    const viaturaLines = doc.splitTextToSize(
      `Viatura: ${caseObj.viatura || ""}`,
      contentW
    );

    const dadosCasoHeight =
      innerPadTop +
      headerGap +
      titleLines.length * lineGap +
      1 * lineGap +
      localLines.length * lineGap +
      equipeLines.length * lineGap +
      viaturaLines.length * lineGap +
      1 * lineGap +
      innerPadBottom;

    doc.setDrawColor(220);
    doc.roundedRect(boxX, boxY, boxW, dadosCasoHeight, 2, 2);

    y = boxY + innerPadTop;

    doc.setFont("helvetica", "bold");
    doc.text("Dados do caso", contentX, y);
    y += headerGap;

    doc.setFont("helvetica", "normal");
    y = addWrappedText(
      doc,
      `Título: ${caseObj.titulo || ""}`,
      contentX,
      y,
      contentW,
      lineGap
    );
    doc.text(`REDS: ${caseObj.reds || ""}`, contentX, y);
    y += lineGap;
    y = addWrappedText(
      doc,
      `Local do fato: ${caseObj.localFato || ""}`,
      contentX,
      y,
      contentW,
      lineGap
    );
    y = addWrappedText(
      doc,
      `Equipe: ${caseObj.equipe || ""}`,
      contentX,
      y,
      contentW,
      lineGap
    );
    y = addWrappedText(
      doc,
      `Viatura: ${caseObj.viatura || ""}`,
      contentX,
      y,
      contentW,
      lineGap
    );
    doc.text(
      `Status: ${caseObj.status || "-"}   Prioridade: ${
        caseObj.prioridade || "-"
      }`,
      contentX,
      y
    );
    y += lineGap;

    y = boxY + dadosCasoHeight + 8;

    if (caseObj.observacoes?.trim()) {
      ensureSpace(20);
      doc.setFont("helvetica", "bold");
      doc.text("Observações:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      y = addWrappedText(
        doc,
        caseObj.observacoes,
        margin,
        y,
        pageW - margin * 2,
        5
      );
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Pessoas", margin, y);
    y += 6;

    doc.setFontSize(10);
    const pessoas = caseObj.pessoas || [];

    for (let i = 0; i < pessoas.length; i++) {
      const p = pessoas[i];

      ensureSpace(46);

      const blockStartY = y;
      const imgW = 28;
      const imgH = 28;
      const imgX = pageW - margin - imgW;
      const imgY = blockStartY + 1;

      doc.setFont("helvetica", "bold");
      doc.text(
        `${String(i + 1).padStart(2, "0")} — ${p.nome || ""}`,
        margin,
        y
      );
      y += 5;

      doc.setFont("helvetica", "normal");
      const papeis = (p.papeis || []).join(", ");
      doc.text(`Envolvimento: ${papeis || "-"}`, margin, y);
      y += 5;

      doc.text(`Tel: ${p.telefone || "-"}   CPF: ${p.cpf || "-"}`, margin, y);
      y += 5;

      y = addWrappedText(
        doc,
        `Endereço: ${p.endereco || "-"}`,
        margin,
        y,
        pageW - margin * 2 - 34,
        5
      );

      if (p.depoimento?.trim()) {
        doc.setFont("helvetica", "bold");
        doc.text("Depoimento:", margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        y = addWrappedText(doc, p.depoimento, margin, y, pageW - margin * 2, 5);
      }

      if (p.fotoDataUrl) {
        try {
          doc.addImage(p.fotoDataUrl, "JPEG", imgX, imgY, imgW, imgH);
        } catch {}
      }

      const photoBottom = p.fotoDataUrl ? imgY + imgH + 4 : y;
      y = Math.max(y, photoBottom);

      y += 4;
      doc.setDrawColor(220);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Linha do tempo", margin, y);
    y += 6;

    doc.setFontSize(10);
    const eventos = [...(caseObj.eventos || [])].sort((a, b) =>
      a.dataHoraISO < b.dataHoraISO ? -1 : 1
    );

    for (let i = 0; i < eventos.length; i++) {
      const e = eventos[i];

      ensureSpace(34);

      doc.setFont("helvetica", "bold");
      doc.text(
        `${String(i + 1).padStart(2, "0")} — ${e.titulo || ""}`,
        margin,
        y
      );
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.text(`Data/Hora: ${fmtDateTime(e.dataHoraISO)}`, margin, y);
      y += 5;

      doc.text(`Tipo: ${e.tipo || "-"}`, margin, y);
      y += 5;

      if (e.local?.trim()) {
        y = addWrappedText(
          doc,
          `Local: ${e.local}`,
          margin,
          y,
          pageW - margin * 2,
          5
        );
      } else {
        doc.text("Local: -", margin, y);
        y += 5;
      }

      const nomesPessoas = (e.pessoasIds || [])
        .map((id) => pessoas.find((p) => p.id === id)?.nome)
        .filter(Boolean)
        .join("; ");

      if (nomesPessoas) {
        y = addWrappedText(
          doc,
          `Pessoas relacionadas: ${nomesPessoas}`,
          margin,
          y,
          pageW - margin * 2,
          5
        );
      }

      if (e.descricao?.trim()) {
        doc.setFont("helvetica", "bold");
        doc.text("Descrição:", margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        y = addWrappedText(doc, e.descricao, margin, y, pageW - margin * 2, 5);
      }

      if (e.gps?.latitude && e.gps?.longitude) {
        ensureSpace(24);
        doc.setFont("helvetica", "bold");
        doc.text("Localização GPS:", margin, y);
        y += 5;

        doc.setFont("helvetica", "normal");
        doc.text(`Latitude: ${e.gps.latitude}`, margin, y);
        y += 5;
        doc.text(`Longitude: ${e.gps.longitude}`, margin, y);
        y += 5;

        if (e.gps.mapsLink) {
          doc.setTextColor(0, 0, 255);
          doc.textWithLink("Abrir no Google Maps", margin, y, {
            url: e.gps.mapsLink,
          });
          y += 5;

          y = addWrappedText(
            doc,
            e.gps.mapsLink,
            margin,
            y,
            pageW - margin * 2,
            4
          );
          doc.setTextColor(0, 0, 0);
        }
      }

      if (e.foto) {
        ensureSpace(58);
        doc.setFont("helvetica", "bold");
        doc.text("Foto do evento:", margin, y);
        y += 5;

        try {
          doc.addImage(e.foto, "JPEG", margin, y, 60, 45);
          y += 50;
        } catch (err) {
          console.error("Erro ao inserir foto no PDF:", err);
        }
      }

      y += 6;
      doc.setDrawColor(220);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    const safeReds = (caseObj.reds || "SEM_REDS").replace(/[^\w-]+/g, "_");
    const safeTitle = (caseObj.titulo || "Caso").replace(/[^\w-]+/g, "_");
    doc.save(`Relatorio_${safeReds}_${safeTitle}.pdf`);
    showToast("PDF gerado");
  }

  /** Filtros */
  const orderedEvents = useMemo(() => {
    return [...(activeCase.eventos || [])].sort((a, b) =>
      a.dataHoraISO < b.dataHoraISO ? 1 : -1
    );
  }, [activeCase.eventos]);

  const timelineAsc = useMemo(() => {
    return [...(activeCase.eventos || [])].sort((a, b) =>
      a.dataHoraISO < b.dataHoraISO ? -1 : 1
    );
  }, [activeCase.eventos]);

  const latestEvents = useMemo(() => {
    return orderedEvents.slice(0, 3);
  }, [orderedEvents]);

  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase();
    if (!q) return activeCase.pessoas;

    return activeCase.pessoas.filter((p) => {
      return (
        (p.nome || "").toLowerCase().includes(q) ||
        (p.endereco || "").toLowerCase().includes(q) ||
        (p.telefone || "").toLowerCase().includes(q) ||
        (p.cpf || "").toLowerCase().includes(q) ||
        (p.depoimento || "").toLowerCase().includes(q) ||
        (p.papeis || []).join(" ").toLowerCase().includes(q)
      );
    });
  }, [activeCase.pessoas, personSearch]);

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    const base = [...(activeCase.eventos || [])].sort((a, b) =>
      a.dataHoraISO < b.dataHoraISO ? 1 : -1
    );

    if (!q) return base;

    return base.filter((e) => {
      const peopleNames = (e.pessoasIds || [])
        .map((id) => activeCase.pessoas.find((p) => p.id === id)?.nome || "")
        .join(" ");

      return (
        (e.titulo || "").toLowerCase().includes(q) ||
        (e.local || "").toLowerCase().includes(q) ||
        (e.descricao || "").toLowerCase().includes(q) ||
        (e.tipo || "").toLowerCase().includes(q) ||
        peopleNames.toLowerCase().includes(q)
      );
    });
  }, [activeCase.eventos, activeCase.pessoas, eventSearch]);

  function getCasePreviewEventNames(evento) {
    return (evento.pessoasIds || [])
      .map((id) => activeCase.pessoas.find((p) => p.id === id)?.nome)
      .filter(Boolean)
      .join("; ");
  }

  /** Layout */
  const styles = {
    app: {
      minHeight: "100vh",
      background:
        "linear-gradient(180deg, #17307f 0%, #1b2f73 12%, #f2f4fa 12%, #f2f4fa 100%)",
      color: "#101828",
      fontFamily:
        'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      paddingBottom: 90,
    },
    top: {
      padding: "10px 18px",
      minHeight: 88,
      display: "flex",
      alignItems: "center",
      color: "#fff",
    },
    brandRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      width: "100%",
    },
    brandLeft: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      minWidth: 0,
    },
    iconLogo: {
      height: 68,
      width: "auto",
      objectFit: "contain",
      flex: "0 0 auto",
      display: "block",
    },
    brandTitle: {
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: -0.3,
      lineHeight: 1.1,
    },
    brandSub: {
      fontSize: 12,
      opacity: 0.88,
      marginTop: 3,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 240,
    },
    topAction: {
      border: "none",
      background: "rgba(255,255,255,0.16)",
      color: "#fff",
      width: 46,
      height: 46,
      borderRadius: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      flex: "0 0 auto",
    },
    content: {
      padding: "0 16px 16px",
    },
    whiteCard: {
      background: "#f7f8fc",
      borderRadius: 26,
      padding: 16,
      boxShadow: "0 8px 30px rgba(14, 28, 84, 0.06)",
    },
    primaryCard: {
      background:
        "linear-gradient(180deg, rgba(60,91,215,0.98) 0%, rgba(47,73,184,0.98) 100%)",
      color: "#fff",
      borderRadius: 22,
      padding: 18,
      boxShadow: "0 12px 22px rgba(40, 67, 178, 0.22)",
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: 700,
      opacity: 0.95,
    },
    caseTitle: {
      fontSize: 20,
      fontWeight: 800,
      lineHeight: 1.15,
      marginTop: 4,
      marginBottom: 10,
    },
    caseMeta: {
      fontSize: 14,
      opacity: 0.95,
      lineHeight: 1.45,
    },
    chipsRow: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    statusBadge: (variant = "default") => ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 28,
      borderRadius: 999,
      padding: "6px 10px",
      fontSize: 12,
      fontWeight: 800,
      background:
        variant === "success"
          ? "rgba(34, 197, 94, 0.18)"
          : variant === "warning"
          ? "rgba(245, 158, 11, 0.2)"
          : "rgba(255,255,255,0.18)",
      color: "#fff",
    }),
    actionGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginTop: 14,
      marginBottom: 18,
    },
    actionButton: {
      border: "none",
      background: "linear-gradient(180deg, #4c73ff 0%, #3c5ae3 100%)",
      color: "#fff",
      borderRadius: 18,
      padding: "16px 14px",
      fontSize: 15,
      fontWeight: 800,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      cursor: "pointer",
      boxShadow: "0 8px 18px rgba(60, 90, 227, 0.25)",
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 800,
      color: "#0f172a",
      marginBottom: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    list: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    eventRow: {
      background: "#fff",
      border: "1px solid #e7ebf5",
      borderRadius: 18,
      padding: 14,
      display: "flex",
      alignItems: "center",
      gap: 12,
      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
      cursor: "pointer",
    },
    timeText: {
      fontSize: 14,
      fontWeight: 800,
      color: "#21316b",
      minWidth: 50,
    },
    rowMain: {
      flex: 1,
      minWidth: 0,
    },
    rowTitle: {
      fontSize: 17,
      fontWeight: 700,
      color: "#131a2a",
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    rowSub: {
      fontSize: 13,
      color: "#6b7280",
      marginTop: 4,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    },
    typePill: {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 8px",
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 800,
      color: "#2840a0",
      background: "#edf2ff",
      marginTop: 6,
    },
    searchWrap: {
      position: "relative",
      marginBottom: 14,
    },
    searchInput: {
      width: "100%",
      border: "1px solid #dbe2f0",
      background: "#fff",
      color: "#111827",
      borderRadius: 16,
      padding: "14px 14px 14px 42px",
      outline: "none",
      fontSize: 15,
      boxSizing: "border-box",
    },
    searchIcon: {
      position: "absolute",
      left: 14,
      top: "50%",
      transform: "translateY(-50%)",
      color: "#718096",
    },
    personCard: {
      background: "#fff",
      border: "1px solid #e7ebf5",
      borderRadius: 18,
      padding: 14,
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
      cursor: "pointer",
    },
    avatar: {
      width: 62,
      height: 62,
      borderRadius: 14,
      objectFit: "cover",
      background: "#dbe3ff",
      flex: "0 0 auto",
    },
    smallMuted: {
      fontSize: 13,
      color: "#6b7280",
      lineHeight: 1.45,
    },
    fab: {
      position: "fixed",
      right: 18,
      bottom: 96,
      width: 58,
      height: 58,
      borderRadius: 18,
      border: "none",
      background: "linear-gradient(180deg, #4d74ff 0%, #3859df 100%)",
      color: "#fff",
      boxShadow: "0 16px 28px rgba(56, 89, 223, 0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      zIndex: 30,
    },
    bottomBar: {
      position: "fixed",
      left: 12,
      right: 12,
      bottom: 12,
      background: "rgba(255,255,255,0.96)",
      backdropFilter: "blur(8px)",
      border: "1px solid #e5eaf4",
      borderRadius: 22,
      boxShadow: "0 12px 28px rgba(10, 23, 70, 0.12)",
      padding: "8px 6px",
      display: "grid",
      gridTemplateColumns: "repeat(5, 1fr)",
      zIndex: 40,
    },
    navButton: (active) => ({
      border: "none",
      background: active ? "#eef3ff" : "transparent",
      color: active ? "#3153da" : "#8b93a7",
      borderRadius: 16,
      padding: "10px 6px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      fontSize: 12,
      fontWeight: active ? 800 : 600,
      cursor: "pointer",
    }),
    label: {
      fontSize: 13,
      fontWeight: 700,
      color: "#1f2a44",
      marginBottom: 6,
      display: "block",
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid #dbe2f0",
      background: "#fff",
      borderRadius: 16,
      padding: "14px 14px",
      fontSize: 15,
      outline: "none",
    },
    textarea: {
      width: "100%",
      boxSizing: "border-box",
      border: "1px solid #dbe2f0",
      background: "#fff",
      borderRadius: 16,
      padding: "14px 14px",
      fontSize: 15,
      outline: "none",
      minHeight: 110,
      resize: "vertical",
      fontFamily: "inherit",
    },
    miniButton: {
      border: "none",
      background: "#edf2ff",
      color: "#2e4fd1",
      borderRadius: 14,
      padding: "10px 12px",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
    },
    ghostButton: {
      border: "1px solid #dce3f2",
      background: "#fff",
      color: "#31406c",
      borderRadius: 14,
      padding: "10px 12px",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
    },
    dangerButton: {
      border: "none",
      background: "#fee2e2",
      color: "#b42318",
      borderRadius: 14,
      padding: "10px 12px",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
    },
    saveButton: {
      border: "none",
      background: "linear-gradient(180deg, #4d74ff 0%, #3859df 100%)",
      color: "#fff",
      borderRadius: 16,
      padding: "13px 15px",
      fontWeight: 800,
      fontSize: 14,
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
    },
    chipsWrap: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: (active) => ({
      border: active ? "none" : "1px solid #dbe2f0",
      background: active ? "#3153da" : "#fff",
      color: active ? "#fff" : "#32415f",
      borderRadius: 999,
      padding: "10px 12px",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
    }),
    modalBack: {
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.45)",
      zIndex: 100,
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      padding: 0,
    },
    modalSheet: {
      width: "100%",
      maxWidth: 520,
      maxHeight: "92vh",
      overflowY: "auto",
      background: "#f7f8fc",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 16,
      boxShadow: "0 -12px 30px rgba(15, 23, 42, 0.16)",
    },
    modalWide: {
      width: "100%",
      maxWidth: 780,
      maxHeight: "92vh",
      overflowY: "auto",
      background: "#f7f8fc",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 16,
      boxShadow: "0 -12px 30px rgba(15, 23, 42, 0.16)",
    },
    modalHead: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 14,
    },
    toast: {
      position: "fixed",
      top: 18,
      left: "50%",
      transform: "translateX(-50%)",
      background: "#1f3db8",
      color: "#fff",
      padding: "12px 18px",
      borderRadius: 14,
      boxShadow: "0 12px 24px rgba(31,61,184,0.24)",
      zIndex: 9999,
      fontSize: 14,
      fontWeight: 700,
    },
    previewBlock: {
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
    },
    previewTitle: {
      fontSize: 15,
      fontWeight: 800,
      marginBottom: 8,
      color: "#111827",
    },
    previewP: {
      margin: "0 0 6px",
      fontSize: 14,
      color: "#374151",
      lineHeight: 1.45,
    },
    timelineCard: {
      background: "#fff",
      border: "1px solid #e7ebf5",
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
    },
  };

  const fallbackAvatar =
    "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIHJ4PSIxNiIgZmlsbD0iI2Q5ZTJmZiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzYiIHI9IjE2IiBmaWxsPSIjN2E5M2ZmIi8+PHBhdGggZD0iTTI1IDgwYzUtMTMgMTctMjAgMjUtMjBzMjAgNyAyNSAyMCIgZmlsbD0iIzdhOTNmZiIvPjwvc3ZnPg==";

  function renderHeader(showTopAction = true) {
    return (
      <div style={styles.top}>
        <div style={styles.brandRow}>
          <div style={styles.brandLeft}>
            <img
              src="/icon-512.png"
              alt="Diligências"
              style={styles.iconLogo}
            />
            <div style={{ minWidth: 0 }}>
              <div style={styles.brandTitle}>Diligências</div>
              <div style={styles.brandSub}>
                {activeCase.titulo || "Novo Caso"}
              </div>
            </div>
          </div>

          {showTopAction && (
            <button
              style={styles.topAction}
              onClick={() => setShowCaseModal(true)}
              title="Casos"
            >
              <CaseIcon size={22} color="#fff" />
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderHome() {
    return (
      <div style={styles.content}>
        <div style={styles.whiteCard}>
          <div style={styles.primaryCard}>
            <div style={styles.cardTitle}>Caso atual</div>
            <div style={styles.caseTitle}>
              {activeCase.titulo || "Novo Caso"}
            </div>
            <div style={styles.caseMeta}>
              <div>{activeCase.reds || "Sem REDS"}</div>
              <div style={{ marginTop: 4 }}>
                {activeCase.localFato || "Local não informado"}
              </div>
              <div style={{ marginTop: 6 }}>
                {activeCase.pessoas.length} pessoa(s) •{" "}
                {activeCase.eventos.length} evento(s)
              </div>
            </div>

            <div style={styles.chipsRow}>
              <span
                style={styles.statusBadge(
                  activeCase.status === "concluído" ? "success" : "default"
                )}
              >
                {activeCase.status || "em andamento"}
              </span>
              <span
                style={styles.statusBadge(
                  activeCase.prioridade === "alta" ? "warning" : "default"
                )}
              >
                prioridade: {activeCase.prioridade || "normal"}
              </span>
            </div>
          </div>

          <div style={styles.actionGrid}>
            <button style={styles.actionButton} onClick={openNewEvent}>
              <EventIcon size={20} color="#fff" />
              <span>Evento</span>
            </button>

            <button style={styles.actionButton} onClick={openNewPerson}>
              <PersonIcon size={20} color="#fff" />
              <span>Pessoa</span>
            </button>
          </div>

          <div style={styles.sectionTitle}>
            <span>Últimos eventos</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {activeCase.eventos.length > 0 && (
                <button
                  style={styles.miniButton}
                  onClick={() => setShowPreviewModal(true)}
                >
                  <EyeIcon size={16} color="#2e4fd1" />
                  <span style={{ marginLeft: 6 }}>Prévia relatório</span>
                </button>
              )}
              {activeCase.eventos.length > 0 && (
                <button
                  style={styles.miniButton}
                  onClick={() => setScreen("eventos")}
                >
                  Ver todos
                </button>
              )}
            </div>
          </div>

          <div style={styles.list}>
            {latestEvents.length === 0 ? (
              <div style={{ ...styles.smallMuted, padding: "4px 2px 10px" }}>
                Nenhum evento cadastrado.
              </div>
            ) : (
              latestEvents.map((e) => (
                <div
                  key={e.id}
                  style={styles.eventRow}
                  onClick={() => openEditEvent(e.id)}
                >
                  <div style={styles.timeText}>{fmtHour(e.dataHoraISO)}</div>

                  <div style={styles.rowMain}>
                    <div style={styles.rowTitle}>
                      {e.titulo || "(sem título)"}
                    </div>
                    <div style={styles.rowSub}>
                      {e.local || "Sem local informado"}
                    </div>
                    <div style={styles.typePill}>{e.tipo || "diligência"}</div>
                  </div>

                  <ArrowRightIcon size={18} color="#98A2B3" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderEventos() {
    return (
      <div style={styles.content}>
        <div style={styles.whiteCard}>
          <div style={styles.sectionTitle}>
            <span>Eventos</span>
            <button
              style={styles.miniButton}
              onClick={() => setShowPreviewModal(true)}
            >
              <EyeIcon size={16} color="#2e4fd1" />
              <span style={{ marginLeft: 6 }}>Ver relatório</span>
            </button>
          </div>

          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>
              <SearchIcon size={18} color="#7b8798" />
            </span>
            <input
              style={styles.searchInput}
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
              placeholder="Buscar evento..."
            />
          </div>

          <div style={styles.list}>
            {filteredEvents.length === 0 ? (
              <div style={styles.smallMuted}>Nenhum evento encontrado.</div>
            ) : (
              filteredEvents.map((e) => {
                const nomes = (e.pessoasIds || [])
                  .map(
                    (id) => activeCase.pessoas.find((p) => p.id === id)?.nome
                  )
                  .filter(Boolean);

                return (
                  <div
                    key={e.id}
                    style={styles.eventRow}
                    onClick={() => openEditEvent(e.id)}
                  >
                    <div style={styles.timeText}>{fmtHour(e.dataHoraISO)}</div>

                    <div style={styles.rowMain}>
                      <div style={styles.rowTitle}>
                        {e.titulo || "(sem título)"}
                      </div>
                      <div style={styles.rowSub}>
                        {e.local || "Sem local informado"}
                      </div>
                      <div style={styles.typePill}>
                        {e.tipo || "diligência"}
                      </div>
                      {nomes.length > 0 && (
                        <div style={{ ...styles.rowSub, marginTop: 6 }}>
                          {nomes.join("; ")}
                        </div>
                      )}
                    </div>

                    <ArrowRightIcon size={18} color="#98A2B3" />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <button style={styles.fab} onClick={openNewEvent} title="Novo evento">
          <PlusIcon size={24} color="#fff" />
        </button>
      </div>
    );
  }

  function renderPessoas() {
    return (
      <div style={styles.content}>
        <div style={styles.whiteCard}>
          <div style={styles.sectionTitle}>
            <span>Pessoas</span>
          </div>

          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>
              <SearchIcon size={18} color="#7b8798" />
            </span>
            <input
              style={styles.searchInput}
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              placeholder="Buscar pessoa..."
            />
          </div>

          <div style={styles.list}>
            {filteredPeople.length === 0 ? (
              <div style={styles.smallMuted}>Nenhuma pessoa encontrada.</div>
            ) : (
              filteredPeople.map((p) => (
                <div
                  key={p.id}
                  style={styles.personCard}
                  onClick={() => openEditPerson(p.id)}
                >
                  <img
                    src={p.fotoDataUrl || fallbackAvatar}
                    alt="foto"
                    style={styles.avatar}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.rowTitle}>{p.nome || "(sem nome)"}</div>

                    <div style={styles.rowSub}>
                      {(p.papeis || []).join(", ") || "Sem papel definido"}
                    </div>

                    <div style={{ ...styles.smallMuted, marginTop: 8 }}>
                      {p.telefone || "—"}
                    </div>
                    <div style={styles.smallMuted}>{p.endereco || "—"}</div>
                  </div>

                  <ArrowRightIcon size={18} color="#98A2B3" />
                </div>
              ))
            )}
          </div>
        </div>

        <button style={styles.fab} onClick={openNewPerson} title="Nova pessoa">
          <PlusIcon size={24} color="#fff" />
        </button>
      </div>
    );
  }

  function updateCaseField(field, value) {
    setDb((prev) => ({
      ...prev,
      cases: prev.cases.map((c) =>
        c.id === prev.activeCaseId
          ? {
              ...c,
              [field]: value,
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
    }));
  }

  function handleSaveCase() {
    showToast("Caso salvo com sucesso");
    setScreen("home");
  }

  function renderCaso() {
    return (
      <div style={styles.content}>
        <div style={styles.whiteCard}>
          <div
            style={{
              ...styles.sectionTitle,
              marginBottom: 16,
            }}
          >
            <span>Dados do caso</span>
            <button style={styles.saveButton} onClick={handleSaveCase}>
              <SaveIcon size={16} color="#fff" />
              Salvar
            </button>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Título do caso</label>
            <input
              style={styles.input}
              value={activeCase.titulo}
              onChange={(e) => updateCaseField("titulo", e.target.value)}
              placeholder="Novo Caso"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>REDS/BO</label>
            <input
              style={styles.input}
              value={activeCase.reds}
              onChange={(e) => updateCaseField("reds", e.target.value)}
              placeholder="REDS"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Local do fato</label>
            <input
              style={styles.input}
              value={activeCase.localFato}
              onChange={(e) => updateCaseField("localFato", e.target.value)}
              placeholder="Rua, número, bairro..."
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Equipe</label>
            <input
              style={styles.input}
              value={activeCase.equipe}
              onChange={(e) => updateCaseField("equipe", e.target.value)}
              placeholder="Equipe responsável"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Viatura</label>
            <input
              style={styles.input}
              value={activeCase.viatura}
              onChange={(e) => updateCaseField("viatura", e.target.value)}
              placeholder="Viatura"
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Status</label>
            <select
              style={styles.input}
              value={activeCase.status || "em andamento"}
              onChange={(e) => updateCaseField("status", e.target.value)}
            >
              <option value="em andamento">em andamento</option>
              <option value="concluído">concluído</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={styles.label}>Prioridade</label>
            <select
              style={styles.input}
              value={activeCase.prioridade || "normal"}
              onChange={(e) => updateCaseField("prioridade", e.target.value)}
            >
              <option value="normal">normal</option>
              <option value="alta">alta</option>
            </select>
          </div>

          <div>
            <label style={styles.label}>Observações</label>
            <textarea
              style={styles.textarea}
              value={activeCase.observacoes}
              onChange={(e) => updateCaseField("observacoes", e.target.value)}
              placeholder="Resumo, histórico, contexto..."
            />
          </div>
        </div>
      </div>
    );
  }

  function renderMais() {
    return (
      <div style={styles.content}>
        <div style={styles.whiteCard}>
          <div style={styles.sectionTitle}>Mais opções</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              style={styles.actionButton}
              onClick={() => setShowPreviewModal(true)}
            >
              Visualizar relatório
            </button>

            <button
              style={styles.actionButton}
              onClick={() => gerarPDFDoCaso(activeCase)}
            >
              Gerar relatório (PDF)
            </button>

            <button style={styles.actionButton} onClick={exportJSON}>
              Exportar backup (JSON)
            </button>

            <label style={{ display: "block" }}>
              <input
                type="file"
                accept="application/json"
                style={{ display: "none" }}
                onChange={(e) => importJSON(e.target.files?.[0])}
              />
              <span
                style={{
                  ...styles.actionButton,
                  display: "flex",
                }}
              >
                Importar backup (JSON)
              </span>
            </label>

            <button
              style={{ ...styles.ghostButton, marginTop: 4 }}
              onClick={() => setShowCaseModal(true)}
            >
              Gerenciar casos
            </button>
          </div>

          <div style={{ ...styles.smallMuted, marginTop: 16 }}>
            Dica: visualize o relatório antes de gerar o PDF para conferir a
            linha do tempo e as fotos.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      {toast ? <div style={styles.toast}>{toast}</div> : null}

      {renderHeader(true)}

      {screen === "home" && renderHome()}
      {screen === "eventos" && renderEventos()}
      {screen === "pessoas" && renderPessoas()}
      {screen === "caso" && renderCaso()}
      {screen === "mais" && renderMais()}

      <div style={styles.bottomBar}>
        <button
          style={styles.navButton(screen === "home")}
          onClick={() => setScreen("home")}
        >
          <HomeIcon
            size={20}
            color={screen === "home" ? "#3153da" : "#98A2B3"}
          />
          <span>Início</span>
        </button>

        <button
          style={styles.navButton(screen === "eventos")}
          onClick={() => setScreen("eventos")}
        >
          <EventIcon
            size={20}
            color={screen === "eventos" ? "#3153da" : "#98A2B3"}
          />
          <span>Eventos</span>
        </button>

        <button
          style={styles.navButton(screen === "pessoas")}
          onClick={() => setScreen("pessoas")}
        >
          <PersonIcon
            size={20}
            color={screen === "pessoas" ? "#3153da" : "#98A2B3"}
          />
          <span>Pessoas</span>
        </button>

        <button
          style={styles.navButton(screen === "caso")}
          onClick={() => setScreen("caso")}
        >
          <CaseIcon
            size={20}
            color={screen === "caso" ? "#3153da" : "#98A2B3"}
          />
          <span>Caso</span>
        </button>

        <button
          style={styles.navButton(screen === "mais")}
          onClick={() => setScreen("mais")}
        >
          <MoreIcon
            size={20}
            color={screen === "mais" ? "#3153da" : "#98A2B3"}
          />
          <span>Mais</span>
        </button>
      </div>

      {showCaseModal && (
        <div style={styles.modalBack} onClick={() => setShowCaseModal(false)}>
          <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Casos</div>
              <button
                style={styles.ghostButton}
                type="button"
                onClick={() => setShowCaseModal(false)}
              >
                Fechar
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                style={styles.saveButton}
                onClick={createCase}
              >
                <PlusIcon size={16} color="#fff" />
                Novo caso
              </button>

              <button
                type="button"
                style={styles.ghostButton}
                onClick={() => duplicateCase(db.activeCaseId)}
              >
                Duplicar atual
              </button>
            </div>

            <div style={styles.list}>
              {db.cases.map((c) => (
                <div key={c.id} style={styles.eventRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.rowTitle}>
                      {c.titulo || "Novo Caso"}{" "}
                      {c.id === db.activeCaseId ? "• (aberto)" : ""}
                    </div>
                    <div style={styles.rowSub}>
                      REDS: {c.reds || "—"} • Atualizado:{" "}
                      {fmtDateTime(c.updatedAt)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      style={styles.ghostButton}
                      onClick={() => {
                        setDb((p) => ({ ...p, activeCaseId: c.id }));
                        setShowCaseModal(false);
                        showToast("Caso aberto");
                      }}
                    >
                      Abrir
                    </button>

                    <button
                      type="button"
                      style={styles.ghostButton}
                      onClick={() => duplicateCase(c.id)}
                    >
                      Duplicar
                    </button>

                    <button
                      type="button"
                      style={styles.dangerButton}
                      onClick={() => deleteCase(c.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showPersonModal && personDraft && (
        <div style={styles.modalBack} onClick={() => setShowPersonModal(false)}>
          <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {activeCase.pessoas.some((p) => p.id === personDraft.id)
                  ? "Editar Pessoa"
                  : "Cadastrar Pessoa"}
              </div>
              <button
                style={styles.ghostButton}
                type="button"
                onClick={() => setShowPersonModal(false)}
              >
                Fechar
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Nome</label>
              <input
                style={styles.input}
                value={personDraft.nome}
                onChange={(e) =>
                  setPersonDraft((s) => ({ ...s, nome: e.target.value }))
                }
                placeholder="Nome completo"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Telefone</label>
              <input
                style={styles.input}
                value={personDraft.telefone}
                onChange={(e) =>
                  setPersonDraft((s) => ({ ...s, telefone: e.target.value }))
                }
                placeholder="(xx) xxxxx-xxxx"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>CPF</label>
              <input
                style={styles.input}
                value={personDraft.cpf}
                onChange={(e) =>
                  setPersonDraft((s) => ({ ...s, cpf: e.target.value }))
                }
                placeholder="Somente números"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Endereço</label>
              <input
                style={styles.input}
                value={personDraft.endereco}
                onChange={(e) =>
                  setPersonDraft((s) => ({ ...s, endereco: e.target.value }))
                }
                placeholder="Rua, número, bairro, cidade"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Envolvimento</label>
              <div style={styles.chipsWrap}>
                {ROLES.map((r) => {
                  const on = (personDraft.papeis || []).includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      style={styles.chip(on)}
                      onClick={() => {
                        setPersonDraft((s) => {
                          const set = new Set(s.papeis || []);
                          if (set.has(r)) set.delete(r);
                          else set.add(r);
                          return { ...s, papeis: Array.from(set) };
                        });
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Foto</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickPersonPhoto(e.target.files?.[0])}
              />
              {personDraft.fotoDataUrl && (
                <div style={{ marginTop: 10 }}>
                  <img
                    src={personDraft.fotoDataUrl}
                    alt="foto"
                    style={{ ...styles.avatar, width: 88, height: 88 }}
                  />
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Depoimento</label>
              <textarea
                style={styles.textarea}
                value={personDraft.depoimento}
                onChange={(e) =>
                  setPersonDraft((s) => ({
                    ...s,
                    depoimento: e.target.value,
                  }))
                }
                placeholder="Relato / observações..."
              />
            </div>

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              {activeCase.pessoas.some((p) => p.id === personDraft.id) && (
                <button
                  type="button"
                  style={styles.dangerButton}
                  onClick={() => {
                    deletePerson(personDraft.id);
                    setShowPersonModal(false);
                  }}
                >
                  Remover
                </button>
              )}

              <button
                type="button"
                style={styles.saveButton}
                onClick={savePerson}
              >
                <SaveIcon size={16} color="#fff" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {showEventModal && eventDraft && (
        <div style={styles.modalBack} onClick={() => setShowEventModal(false)}>
          <div style={styles.modalSheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {activeCase.eventos.some((x) => x.id === eventDraft.id)
                  ? "Editar Evento"
                  : "Adicionar Evento"}
              </div>
              <button
                style={styles.ghostButton}
                type="button"
                onClick={() => setShowEventModal(false)}
              >
                Fechar
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Título</label>
              <input
                style={styles.input}
                value={eventDraft.titulo}
                onChange={(e) =>
                  setEventDraft((s) => ({ ...s, titulo: e.target.value }))
                }
                placeholder="Ex.: contato com testemunha"
              />
              <div style={{ ...styles.smallMuted, marginTop: 6 }}>
                Se deixar em branco, o app salva usando o tipo do evento.
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Tipo do evento</label>
              <select
                style={styles.input}
                value={eventDraft.tipo || "diligência"}
                onChange={(e) =>
                  setEventDraft((s) => ({ ...s, tipo: e.target.value }))
                }
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Data/Hora</label>
              <input
                style={styles.input}
                type="datetime-local"
                value={eventDraft.dataHoraLocal}
                onChange={(e) =>
                  setEventDraft((s) => ({
                    ...s,
                    dataHoraLocal: e.target.value,
                  }))
                }
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Local</label>
              <input
                style={styles.input}
                value={eventDraft.local}
                onChange={(e) =>
                  setEventDraft((s) => ({ ...s, local: e.target.value }))
                }
                placeholder="Rua / bairro / referência"
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Pessoas relacionadas</label>
              <div style={styles.chipsWrap}>
                {(activeCase.pessoas || []).map((p) => {
                  const on = (eventDraft.pessoasIds || []).includes(p.id);

                  return (
                    <button
                      key={p.id}
                      type="button"
                      style={styles.chip(on)}
                      onClick={() => {
                        setEventDraft((s) => {
                          const set = new Set(s.pessoasIds || []);
                          if (set.has(p.id)) set.delete(p.id);
                          else set.add(p.id);
                          return { ...s, pessoasIds: Array.from(set) };
                        });
                      }}
                    >
                      {p.nome || "Sem nome"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Descrição</label>
              <textarea
                style={styles.textarea}
                value={eventDraft.descricao}
                onChange={(e) =>
                  setEventDraft((s) => ({ ...s, descricao: e.target.value }))
                }
                placeholder="Detalhes do evento..."
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Foto do evento</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => onPickEventPhoto(e.target.files?.[0])}
              />

              {eventDraft.foto && (
                <div style={{ marginTop: 10 }}>
                  <img
                    src={eventDraft.foto}
                    alt="foto-evento"
                    style={{
                      width: 120,
                      height: 120,
                      objectFit: "cover",
                      borderRadius: 14,
                    }}
                  />

                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      style={styles.dangerButton}
                      onClick={removeEventPhoto}
                    >
                      Remover foto
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={styles.label}>Localização (opcional)</label>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={styles.ghostButton}
                  onClick={captureEventLocation}
                >
                  Capturar localização
                </button>

                {eventDraft.gps?.mapsLink && (
                  <>
                    <a
                      href={eventDraft.gps.mapsLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        ...styles.miniButton,
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      Abrir no Maps
                    </a>

                    <button
                      type="button"
                      style={styles.dangerButton}
                      onClick={clearEventLocation}
                    >
                      Remover localização
                    </button>
                  </>
                )}
              </div>

              {eventDraft.gps?.latitude && (
                <div style={{ ...styles.smallMuted, marginTop: 8 }}>
                  Latitude: {eventDraft.gps.latitude} • Longitude:{" "}
                  {eventDraft.gps.longitude}
                </div>
              )}
            </div>

            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              {activeCase.eventos.some((x) => x.id === eventDraft.id) && (
                <button
                  type="button"
                  style={styles.dangerButton}
                  onClick={() => {
                    deleteEvent(eventDraft.id);
                    setShowEventModal(false);
                  }}
                >
                  Remover
                </button>
              )}

              <button
                type="button"
                style={styles.saveButton}
                onClick={saveEvent}
              >
                <SaveIcon size={16} color="#fff" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && (
        <div
          style={styles.modalBack}
          onClick={() => setShowPreviewModal(false)}
        >
          <div style={styles.modalWide} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                Prévia do relatório
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  style={styles.ghostButton}
                  onClick={() => setShowPreviewModal(false)}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  style={styles.saveButton}
                  onClick={() => gerarPDFDoCaso(activeCase)}
                >
                  <SaveIcon size={16} color="#fff" />
                  Gerar PDF
                </button>
              </div>
            </div>

            <div style={styles.previewBlock}>
              <div style={styles.previewTitle}>Dados do caso</div>
              <p style={styles.previewP}>
                <b>Título:</b> {activeCase.titulo || "Novo Caso"}
              </p>
              <p style={styles.previewP}>
                <b>REDS:</b> {activeCase.reds || "-"}
              </p>
              <p style={styles.previewP}>
                <b>Local do fato:</b> {activeCase.localFato || "-"}
              </p>
              <p style={styles.previewP}>
                <b>Equipe:</b> {activeCase.equipe || "-"}
              </p>
              <p style={styles.previewP}>
                <b>Viatura:</b> {activeCase.viatura || "-"}
              </p>
              <p style={styles.previewP}>
                <b>Status:</b> {activeCase.status || "-"} • <b>Prioridade:</b>{" "}
                {activeCase.prioridade || "-"}
              </p>
              {activeCase.observacoes?.trim() && (
                <p style={styles.previewP}>
                  <b>Observações:</b> {activeCase.observacoes}
                </p>
              )}
            </div>

            <div style={styles.previewBlock}>
              <div style={styles.previewTitle}>Pessoas</div>
              {activeCase.pessoas.length === 0 ? (
                <p style={styles.previewP}>Nenhuma pessoa cadastrada.</p>
              ) : (
                activeCase.pessoas.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "12px 0",
                      borderBottom:
                        i === activeCase.pessoas.length - 1
                          ? "none"
                          : "1px solid #eef2f7",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                    }}
                  >
                    <img
                      src={p.fotoDataUrl || fallbackAvatar}
                      alt="foto pessoa"
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        flex: "0 0 auto",
                      }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={styles.previewP}>
                        <b>
                          {String(i + 1).padStart(2, "0")} — {p.nome || "-"}
                        </b>
                      </p>
                      <p style={styles.previewP}>
                        papeis: {(p.papeis || []).join(", ") || "-"}
                      </p>
                      <p style={styles.previewP}>
                        Tel: {p.telefone || "-"} • CPF: {p.cpf || "-"}
                      </p>
                      <p style={styles.previewP}>
                        Endereço: {p.endereco || "-"}
                      </p>
                      {p.depoimento?.trim() && (
                        <p style={styles.previewP}>
                          <b>Depoimento:</b> {p.depoimento}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={styles.previewBlock}>
              <div style={styles.previewTitle}>Linha do tempo</div>
              {timelineAsc.length === 0 ? (
                <p style={styles.previewP}>Nenhum evento cadastrado.</p>
              ) : (
                timelineAsc.map((e, i) => (
                  <div key={e.id} style={styles.timelineCard}>
                    <p style={styles.previewP}>
                      <b>
                        {String(i + 1).padStart(2, "0")} — {e.titulo || "-"}
                      </b>
                    </p>
                    <p style={styles.previewP}>
                      <b>Data/Hora:</b> {fmtDateTime(e.dataHoraISO)}
                    </p>
                    <p style={styles.previewP}>
                      <b>Tipo:</b> {e.tipo || "-"}
                    </p>
                    <p style={styles.previewP}>
                      <b>Local:</b> {e.local || "-"}
                    </p>
                    {getCasePreviewEventNames(e) && (
                      <p style={styles.previewP}>
                        <b>Pessoas relacionadas:</b>{" "}
                        {getCasePreviewEventNames(e)}
                      </p>
                    )}
                    {e.descricao?.trim() && (
                      <p style={styles.previewP}>
                        <b>Descrição:</b> {e.descricao}
                      </p>
                    )}
                    {e.gps?.latitude && e.gps?.longitude && (
                      <p style={styles.previewP}>
                        <b>GPS:</b> {e.gps.latitude}, {e.gps.longitude}
                      </p>
                    )}
                    {e.foto && (
                      <div style={{ marginTop: 8 }}>
                        <img
                          src={e.foto}
                          alt="foto evento"
                          style={{
                            width: 140,
                            height: 105,
                            objectFit: "cover",
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
