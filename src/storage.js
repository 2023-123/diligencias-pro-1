export async function loadState() {
  try {
    const raw = localStorage.getItem("diligencias-db");
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    return null;
  }
}

export async function saveState(data) {
  try {
    localStorage.setItem("diligencias-db", JSON.stringify(data));
  } catch (err) {
    console.error("Erro ao salvar dados:", err);
  }
}
