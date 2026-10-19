
const formulario = document.getElementById("formulario-actividad");
const botonMostrar = document.getElementById("mostrar-formulario");
const botonCancelar = document.getElementById("cancelar-formulario");
const lista = document.getElementById("lista-actividades");

const campoMateria = document.getElementById("materia");
const campoTipo = document.getElementById("tipo");
const campoTitulo = document.getElementById("titulo");
const campoFecha = document.getElementById("fecha");

const contadorTotal = document.getElementById("total-actividades");
const contadorEvaluaciones = document.getElementById("total-evaluaciones");
const contadorTP = document.getElementById("total-tp");

let actividades = [];

function normalizar(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

function fechaLocalISO() {
  const ahora = new Date();
  const zonaLocal = new Date(
    ahora.getTime() - ahora.getTimezoneOffset() * 60000
  );
  return zonaLocal.toISOString().slice(0, 10);
}

function mostrarFormulario() {
  formulario.classList.remove("oculto");
  campoMateria.focus();
}

function ocultarFormulario() {
  formulario.reset();
  formulario.classList.add("oculto");
}

botonMostrar.addEventListener("click", mostrarFormulario);
botonCancelar.addEventListener("click", ocultarFormulario);

campoFecha.min = fechaLocalISO();

formulario.addEventListener("submit", function (evento) {
  evento.preventDefault();

  const materia = campoMateria.value;
  const tipo = campoTipo.value;
  const titulo = campoTitulo.value.trim();
  const fecha = campoFecha.value;

  if (!materia || !tipo || !titulo || !fecha) {
    alert("Completá todos los campos.");
    return;
  }

  if (fecha < fechaLocalISO()) {
    alert("Elegí una fecha de hoy o posterior.");
    return;
  }

  // Evita algunos duplicados aunque cambie el orden de las palabras.
  // Es una protección inicial, no una solución definitiva.
  const claveNueva = [
    normalizar(materia),
    normalizar(tipo),
    normalizar(titulo)
  ].join("|");

  const duplicada = actividades.some((actividad) => {
    const claveExistente = [
      normalizar(actividad.materia),
      normalizar(actividad.tipo),
      normalizar(actividad.titulo)
    ].join("|");

    return claveNueva === claveExistente;
  });

  if (duplicada) {
    alert(
      "Esta actividad ya está en la agenda. " +
      "Revisá la existente antes de agregar otra."
    );
    return;
  }

  actividades.push({
    id: crypto.randomUUID(),
    materia,
    tipo,
    titulo,
    fecha
  });

  formulario.reset();
  campoFecha.min = fechaLocalISO();
  formulario.classList.add("oculto");

  renderizarAgenda();
});

function calcularUrgencia(fecha) {
  const hoy = new Date(fechaLocalISO() + "T00:00:00");
  const diaActividad = new Date(fecha + "T00:00:00");
  const dias = Math.round(
    (diaActividad - hoy) / (1000 * 60 * 60 * 24)
  );

  if (dias <= 1) {
    return { clase: "urgencia-roja", texto: "Muy próxima" };
  }

  if (dias <= 3) {
    return { clase: "urgencia-amarilla", texto: "Próxima" };
  }

  return { clase: "urgencia-verde", texto: "Hay tiempo" };
}

function formatearFecha(fecha) {
  const [anio, mes, dia] = fecha.split("-");

  return new Date(
    Number(anio),
    Number(mes) - 1,
    Number(dia)
  ).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function crearElemento(tag, clase, texto) {
  const elemento = document.createElement(tag);

  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;

  return elemento;
}

function renderizarAgenda() {
  contadorTotal.textContent = actividades.length;

  contadorEvaluaciones.textContent = actividades.filter(
    (actividad) => actividad.tipo === "Evaluación"
  ).length;

  contadorTP.textContent = actividades.filter(
    (actividad) => actividad.tipo === "Trabajo práctico"
  ).length;

  lista.replaceChildren();

  if (actividades.length === 0) {
    const vacio = crearElemento("div", "estado-vacio");
    vacio.append(
      crearElemento("span", "", "▤"),
      crearElemento("h3", "", "La agenda está lista para empezar"),
      crearElemento(
        "p",
        "",
        "Cuando carguemos las primeras actividades, aparecerán acá."
      )
    );

    lista.append(vacio);
    return;
  }

  const ordenadas = [...actividades].sort((a, b) =>
    a.fecha.localeCompare(b.fecha)
  );

  ordenadas.forEach((actividad) => {
    const urgencia = calcularUrgencia(actividad.fecha);
    const tarjeta = crearElemento("article", "actividad");
    const encabezado = crearElemento("div", "actividad-encabezado");
    const materia = crearElemento("span", "actividad-materia",
      actividad.materia);
    const estado = crearElemento(
      "span",
      "actividad-urgencia " + urgencia.clase,
      urgencia.texto
    );

    encabezado.append(materia, estado);

    const titulo = crearElemento(
      "h3",
      "actividad-titulo",
      actividad.titulo
    );

    const detalle = crearElemento(
      "p",
      "actividad-detalle",
      actividad.tipo + " · " + formatearFecha(actividad.fecha)
    );

    tarjeta.append(encabezado, titulo, detalle);
    lista.append(tarjeta);
  });
}

renderizarAgenda();
