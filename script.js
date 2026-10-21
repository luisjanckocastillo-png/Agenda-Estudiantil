
"use strict";

// ------------------------------------------------------
// 1. CONEXIÓN CON SUPABASE
// ------------------------------------------------------

const SUPABASE_URL = "https://kgawufgfijvlzbjuqhdj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_nQxzr-a2rCPMp5AaXZjBNQ_O7ChSexy";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// ------------------------------------------------------
// 2. ELEMENTOS DE LA PÁGINA
// ------------------------------------------------------

const formulario = document.getElementById("formulario-actividad");
const formularioAcceso = document.getElementById("formulario-acceso");

const botonMostrar = document.getElementById("mostrar-formulario");
const botonCancelar = document.getElementById("cancelar-formulario");
const botonGuardar = document.getElementById("boton-guardar");
const botonIngresar = document.getElementById("boton-ingresar");
const botonRegistrarse = document.getElementById("boton-registrarse");
const botonSalir = document.getElementById("boton-salir");
const botonActualizar = document.getElementById("boton-actualizar");

const panelAcceso = document.getElementById("panel-acceso");
const tituloAcceso = document.getElementById("titulo-acceso");
const textoAcceso = document.getElementById("texto-acceso");
const mensajeGlobal = document.getElementById("mensaje-global");
const estadoCarga = document.getElementById("estado-carga");
const lista = document.getElementById("lista-actividades");

const campoEmail = document.getElementById("email");
const campoContrasena = document.getElementById("contrasena");

const campoMateria = document.getElementById("materia");
const selectorMaterias = document.getElementById("selector-materias");
const campoTipo = document.getElementById("tipo");
const campoTitulo = document.getElementById("titulo");
const campoDescripcion = document.getElementById("descripcion");
const campoFecha = document.getElementById("fecha");

const campoBusqueda = document.getElementById("busqueda");
const filtroMateria = document.getElementById("filtro-materia");
const filtroTipo = document.getElementById("filtro-tipo");

const contadorTotal = document.getElementById("total-actividades");
const contadorEvaluaciones = document.getElementById("total-evaluaciones");
const contadorTP = document.getElementById("total-tp");

// ------------------------------------------------------
// 3. ESTADO DE LA APLICACIÓN
// ------------------------------------------------------

let usuarioActual = null;
let materias = [];
let actividades = [];
let votos = [];
let cargando = false;
let procesandoAcceso = false;

// ------------------------------------------------------
// 4. FUNCIONES GENERALES
// ------------------------------------------------------

function fechaLocalISO() {
  const ahora = new Date();
  const local = new Date(
    ahora.getTime() - ahora.getTimezoneOffset() * 60000
  );
  return local.toISOString().slice(0, 10);
}

function mostrarMensaje(texto, tipo = "") {
  mensajeGlobal.textContent = texto;
  mensajeGlobal.className =
    "mensaje" + (tipo ? " mensaje-" + tipo : "");
}

function crearElemento(tag, clase = "", texto = "") {
  const elemento = document.createElement(tag);

  if (clase) {
    elemento.className = clase;
  }

  if (texto !== undefined && texto !== null) {
    elemento.textContent = texto;
  }

  return elemento;
}

function normalizarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Genera una clave para comparar títulos aunque cambien
  el orden de las palabras o se usen palabras de conexión.

  Por ejemplo:
  "Prueba de Historia" -> "historia prueba"
  "Historia, prueba"   -> "historia prueba"

  La comprobación se hace dentro de la misma materia y tipo.
*/
function claveActividad(titulo) {
  const palabrasIgnoradas = new Set([
    "de", "del", "la", "las", "el", "los",
    "un", "una", "unos", "unas",
    "sobre", "para", "por", "en", "con",
    "y", "a", "actividad", "tema"
  ]);

  const palabras = normalizarTexto(titulo)
    .split(" ")
    .filter(Boolean)
    .filter((palabra) => !palabrasIgnoradas.has(palabra));

  return [...new Set(palabras)].sort().join(" ");
}

function formatearFecha(fecha) {
  if (!fecha) return "Fecha sin definir";

  const partes = fecha.split("-");
  const fechaLocal = new Date(
    Number(partes[0]),
    Number(partes[1]) - 1,
    Number(partes[2])
  );

  return fechaLocal.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function calcularUrgencia(fecha) {
  const hoy = new Date(fechaLocalISO() + "T00:00:00");
  const diaActividad = new Date(fecha + "T00:00:00");
  const dias = Math.round(
    (diaActividad - hoy) / (1000 * 60 * 60 * 24)
  );

  if (dias < 0) {
    return { clase: "urgencia-vencida", texto: "Fecha pasada" };
  }

  if (dias <= 1) {
    return { clase: "urgencia-roja", texto: "Muy próxima" };
  }

  if (dias <= 3) {
    return { clase: "urgencia-amarilla", texto: "Próxima" };
  }

  return { clase: "urgencia-verde", texto: "Hay tiempo" };
}

function mensajeError(error, contexto = "Ocurrió un error") {
  console.error(contexto, error);

  if (error?.code === "23505") {
    mostrarMensaje(
      "Esta actividad o fecha ya existe. Revisá los anuncios antes de volver a publicarla.",
      "error"
    );
    return;
  }

  if (
    error?.code === "42501" ||
    error?.code === "PGRST301" ||
    error?.code === "401"
  ) {
    mostrarMensaje(
      "No tenés permiso para realizar esta acción. Revisá si ingresaste con tu cuenta.",
      "error"
    );
    return;
  }

  if (
    error?.code === "42703" ||
    error?.code === "PGRST204"
  ) {
    mostrarMensaje(
      "Falta actualizar la estructura de Supabase. Seguí el paso de configuración que aparece debajo de los archivos.",
      "error"
    );
    return;
  }

  mostrarMensaje(
    error?.message || "Ocurrió un error. Probá de nuevo.",
    "error"
  );
}

// ------------------------------------------------------
// 5. CUENTA E INICIO DE SESIÓN
// ------------------------------------------------------

function actualizarPanelUsuario() {
  const conectado = Boolean(usuarioActual);

  panelAcceso.classList.toggle("oculto", conectado);
  botonSalir.classList.toggle("oculto", !conectado);
  botonMostrar.disabled = !conectado;

  if (conectado) {
    tituloAcceso.textContent = "Sesión iniciada";
    textoAcceso.textContent =
      "Ingresaste con " + usuarioActual.email +
      ". Ya podés publicar anuncios, proponer fechas y votar.";
  } else {
    tituloAcceso.textContent = "Ingresá para publicar";
    textoAcceso.textContent =
      "Podés consultar los anuncios sin ingresar. Para publicar, proponer fechas o votar, necesitás una cuenta.";
    ocultarFormulario();
  }
}

async function autenticar(registrar) {
  if (procesandoAcceso) return;

  const email = campoEmail.value.trim();
  const password = campoContrasena.value;

  if (!email || !password) {
    mostrarMensaje("Completá el correo y la contraseña.", "error");
    return;
  }

  if (password.length < 6) {
    mostrarMensaje(
      "La contraseña debe tener al menos 6 caracteres.",
      "error"
    );
    return;
  }

  procesandoAcceso = true;
  botonIngresar.disabled = true;
  botonRegistrarse.disabled = true;

  mostrarMensaje(
    registrar ? "Creando la cuenta…" : "Ingresando…"
  );

  try {
    let resultado;

    if (registrar) {
      resultado = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https://f94adcbf.agenda-estudiantil.pages.dev/"
        }
      });
    } else {
      resultado = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
    }

    if (resultado.error) throw resultado.error;

    if (registrar && !resultado.data.session) {
      mostrarMensaje(
        "La cuenta se creó. Revisá tu correo para confirmar el registro y después ingresá.",
        "success"
      );
      return;
    }

    usuarioActual = resultado.data.user || null;
    actualizarPanelUsuario();

    mostrarMensaje(
      registrar ? "Cuenta creada correctamente." : "Ingresaste correctamente.",
      "success"
    );

    await cargarAgenda();
  } catch (error) {
    mensajeError(error, "Error de autenticación");
  } finally {
    procesandoAcceso = false;
    botonIngresar.disabled = false;
    botonRegistrarse.disabled = false;
  }
}

// ------------------------------------------------------
// 6. CARGAR LAS 16 MATERIAS DESDE SUPABASE
// ------------------------------------------------------

async function cargarMaterias() {
  const { data, error } = await supabaseClient
    .from("materias")
    .select("id,nombre")
    .order("nombre", { ascending: true });

  if (error) throw error;

  materias = data || [];

  if (materias.length !== 16) {
    console.warn(
      "Se esperaban 16 materias y Supabase devolvió:",
      materias.length
    );
  }

  // El alumno elige tocando una tarjeta. El identificador se guarda
  // en un campo oculto y nunca se escribe manualmente.
  campoMateria.value = "";
  selectorMaterias.replaceChildren();

  if (materias.length === 0) {
    selectorMaterias.append(
      crearElemento("p", "texto-ayuda", "No hay materias disponibles. Probá actualizar.")
    );
  }

  materias.forEach((materia) => {
    const botonMateria = crearElemento("button", "materia-opcion", materia.nombre);
    botonMateria.type = "button";
    botonMateria.dataset.materiaId = materia.id;
    botonMateria.setAttribute("aria-pressed", "false");
    botonMateria.addEventListener("click", () => {
      campoMateria.value = materia.id;

      selectorMaterias.querySelectorAll(".materia-opcion").forEach((opcion) => {
        const seleccionada = opcion === botonMateria;
        opcion.classList.toggle("seleccionada", seleccionada);
        opcion.setAttribute("aria-pressed", String(seleccionada));
      });

      mostrarMensaje("Materia seleccionada: " + materia.nombre, "success");
    });
    selectorMaterias.append(botonMateria);
  });

  // El filtro de la agenda usa la misma lista fija.
  filtroMateria.replaceChildren();
  filtroMateria.append(
    new Option("Todas las materias", "")
  );

  materias.forEach((materia) => {
    filtroMateria.append(
      new Option(materia.nombre, materia.id)
    );
  });
}

// ------------------------------------------------------
// 7. CARGAR ANUNCIOS Y FECHAS
// ------------------------------------------------------

async function cargarAgenda() {
  if (cargando) return;

  cargando = true;
  botonActualizar.disabled = true;
  estadoCarga.textContent = "Cargando anuncios…";
  estadoCarga.classList.remove("oculto");

  try {
    const { data, error } = await supabaseClient
      .from("actividades")
      .select(`
        id,
        materia_id,
        tipo,
        titulo,
        descripcion,
        estado,
        created_at,
        materias(nombre),
        propuestas_fechas(id, fecha)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;

    actividades = data || [];

    const idsPropuestas = actividades.flatMap((actividad) =>
      (actividad.propuestas_fechas || []).map(
        (propuesta) => propuesta.id
      )
    );

    votos = [];

    // Los votos se consultan cuando hay una sesión iniciada.
    if (usuarioActual && idsPropuestas.length > 0) {
      const { data: votosData, error: votosError } =
        await supabaseClient
          .from("votos")
          .select("propuesta_fecha_id,usuario_id")
          .in("propuesta_fecha_id", idsPropuestas);

      if (votosError) throw votosError;

      votos = votosData || [];
    }

    renderizarAgenda();
    mostrarMensaje("");
  } catch (error) {
    mensajeError(error, "No se pudo cargar el tablón");

    lista.replaceChildren();

    const errorVista = crearElemento("div", "estado-vacio");
    errorVista.append(
      crearElemento("h3", "", "No pudimos cargar los anuncios"),
      crearElemento(
        "p",
        "",
        "Comprobá la conexión con Supabase y tocá Actualizar."
      )
    );

    lista.append(errorVista);
  } finally {
    cargando = false;
    botonActualizar.disabled = false;
    estadoCarga.classList.add("oculto");
  }
}

// ------------------------------------------------------
// 8. BUSCAR Y FILTRAR ANUNCIOS
// ------------------------------------------------------

function obtenerActividadesFiltradas() {
  const busqueda = normalizarTexto(campoBusqueda.value);
  const materiaSeleccionada = filtroMateria.value;
  const tipoSeleccionado = filtroTipo.value;

  return actividades.filter((actividad) => {
    const nombreMateria = actividad.materias?.nombre || "";
    const textoCompleto = normalizarTexto(
      actividad.titulo + " " +
      (actividad.descripcion || "") + " " +
      nombreMateria
    );

    const coincideBusqueda =
      !busqueda || textoCompleto.includes(busqueda);

    const coincideMateria =
      !materiaSeleccionada ||
      actividad.materia_id === materiaSeleccionada;

    const coincideTipo =
      !tipoSeleccionado ||
      actividad.tipo === tipoSeleccionado;

    return coincideBusqueda && coincideMateria && coincideTipo;
  });
}

// ------------------------------------------------------
// 9. MOSTRAR LOS ANUNCIOS EN EL TABLÓN
// ------------------------------------------------------

function renderizarAgenda() {
  contadorTotal.textContent = actividades.length;

  contadorEvaluaciones.textContent = actividades.filter(
    (actividad) => actividad.tipo === "prueba"
  ).length;

  contadorTP.textContent = actividades.filter(
    (actividad) => actividad.tipo === "trabajo_practico"
  ).length;

  lista.replaceChildren();

  const filtradas = obtenerActividadesFiltradas();

  // Ordena primero por la fecha propuesta más próxima.
  filtradas.sort((a, b) => {
    const fechaA = (a.propuestas_fechas || [])
      .map((p) => p.fecha)
      .sort()[0] || "9999-12-31";

    const fechaB = (b.propuestas_fechas || [])
      .map((p) => p.fecha)
      .sort()[0] || "9999-12-31";

    return fechaA.localeCompare(fechaB);
  });

  if (filtradas.length === 0) {
    const vacio = crearElemento("div", "estado-vacio");

    vacio.append(
      crearElemento("span", "", "▤"),
      crearElemento(
        "h3",
        "",
        actividades.length === 0
          ? "Todavía no hay anuncios"
          : "No encontramos resultados"
      ),
      crearElemento(
        "p",
        "",
        actividades.length === 0
          ? "Cuando alguien publique una prueba o un trabajo, va a aparecer acá."
          : "Probá cambiar la búsqueda o los filtros."
      )
    );

    lista.append(vacio);
    return;
  }

  filtradas.forEach((actividad) => {
    lista.append(crearTarjetaActividad(actividad));
  });
}

function crearTarjetaActividad(actividad) {
  const tarjeta = crearElemento("article", "actividad");

  const encabezado = crearElemento("div", "actividad-encabezado");
  const materiaNombre = actividad.materias?.nombre || "Materia";

  const insigniaMateria = crearElemento(
    "span",
    "actividad-materia",
    materiaNombre
  );

  const insigniaTipo = crearElemento(
    "span",
    "actividad-tipo",
    actividad.tipo === "prueba"
      ? "Prueba / evaluación"
      : "Trabajo práctico"
  );

  encabezado.append(insigniaMateria, insigniaTipo);

  const titulo = crearElemento(
    "h3",
    "actividad-titulo",
    actividad.titulo
  );

  const descripcion = crearElemento(
    "p",
    "actividad-descripcion",
    actividad.descripcion || "Sin información adicional."
  );

  const estado = crearElemento(
    "p",
    "actividad-estado",
    actividad.estado === "confirmada"
      ? "Fecha confirmada"
      : "Fechas en propuesta"
  );

  const fechas = crearElemento("div", "propuestas-lista");
  fechas.append(
    crearElemento("h4", "", "Fechas propuestas")
  );

  const fechasActividad = (
    actividad.propuestas_fechas || []
  ).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));

  if (fechasActividad.length === 0) {
    fechas.append(
      crearElemento(
        "p",
        "nota",
        "Todavía no hay fechas propuestas."
      )
    );
  } else {
    fechasActividad.forEach((propuesta) => {
      fechas.append(
        crearFilaFecha(actividad, propuesta)
      );
    });
  }

  const formularioFecha = document.createElement("form");
  formularioFecha.className = "formulario-fecha";

  const inputFecha = document.createElement("input");
  inputFecha.type = "date";
  inputFecha.min = fechaLocalISO();
  inputFecha.required = true;
  inputFecha.className = "campo-fecha";
  inputFecha.setAttribute(
    "aria-label",
    "Otra fecha para " + actividad.titulo
  );

  const botonProponer = crearElemento(
    "button",
    "",
    "Proponer otra fecha"
  );

  botonProponer.type = "submit";
  botonProponer.disabled = !usuarioActual;

  formularioFecha.append(inputFecha, botonProponer);

  formularioFecha.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    await proponerFecha(actividad.id, inputFecha.value);
    inputFecha.value = "";
  });

  tarjeta.append(
    encabezado,
    titulo,
    descripcion,
    estado,
    fechas,
    formularioFecha
  );

  return tarjeta;
}

function crearFilaFecha(actividad, propuesta) {
  const fila = crearElemento("div", "propuesta-fecha");
  const info = crearElemento("div", "propuesta-info");

  const fechaTexto = crearElemento(
    "strong",
    "",
    formatearFecha(propuesta.fecha)
  );

  const urgencia = calcularUrgencia(propuesta.fecha);

  const etiquetaUrgencia = crearElemento(
    "span",
    "actividad-urgencia " + urgencia.clase,
    urgencia.texto
  );

  info.append(fechaTexto, etiquetaUrgencia);

  const acciones = crearElemento("div", "acciones-propuesta");

  if (usuarioActual) {
    const cantidadVotos = votos.filter(
      (voto) => voto.propuesta_fecha_id === propuesta.id
    ).length;

    const votoPropio = votos.some(
      (voto) =>
        voto.propuesta_fecha_id === propuesta.id &&
        voto.usuario_id === usuarioActual.id
    );

    acciones.append(
      crearElemento(
        "span",
        "contador-votos",
        cantidadVotos +
          (cantidadVotos === 1 ? " voto" : " votos")
      )
    );

    const botonVotar = crearElemento(
      "button",
      "boton-votar",
      votoPropio ? "Ya votaste" : "Votar fecha"
    );

    botonVotar.type = "button";
    botonVotar.disabled = Boolean(votoPropio);

    botonVotar.addEventListener("click", async () => {
      botonVotar.disabled = true;
      await votarFecha(propuesta.id);
    });

    acciones.append(botonVotar);
  } else {
    acciones.append(
      crearElemento(
        "span",
        "contador-votos",
        "Ingresá para votar"
      )
    );
  }

  fila.append(info, acciones);
  return fila;
}

// ------------------------------------------------------
// 10. PUBLICAR UNA ACTIVIDAD
// ------------------------------------------------------

function mostrarFormulario() {
  if (!usuarioActual) {
    mostrarMensaje(
      "Ingresá con tu cuenta para publicar un anuncio.",
      "error"
    );
    return;
  }

  formulario.classList.remove("oculto");
  const primeraMateria = selectorMaterias.querySelector(".materia-opcion");
  if (primeraMateria) primeraMateria.focus();
}

function ocultarFormulario() {
  formulario.reset();
  campoMateria.value = "";
  selectorMaterias.querySelectorAll(".materia-opcion").forEach((opcion) => {
    opcion.classList.remove("seleccionada");
    opcion.setAttribute("aria-pressed", "false");
  });
  campoFecha.min = fechaLocalISO();
  formulario.classList.add("oculto");
}

async function publicarActividad(evento) {
  evento.preventDefault();

  if (!usuarioActual) {
    mostrarMensaje("Primero ingresá con tu cuenta.", "error");
    return;
  }

  const materiaId = campoMateria.value;
  const tipo = campoTipo.value;
  const titulo = campoTitulo.value.trim();
  const descripcion = campoDescripcion.value.trim();
  const fecha = campoFecha.value;

  if (
    !materiaId ||
    !tipo ||
    !titulo ||
    !descripcion ||
    !fecha
  ) {
    mostrarMensaje(
      "Completá la materia, el tipo, el título, la información y la fecha.",
      "error"
    );
    return;
  }

  if (fecha < fechaLocalISO()) {
    mostrarMensaje(
      "La fecha propuesta no puede ser anterior a hoy.",
      "error"
    );
    return;
  }

  // Confirma que la materia seleccionada pertenece a la lista
  // cargada desde Supabase. No acepta un nombre escrito a mano.
  const materiaValida = materias.some(
    (materia) => materia.id === materiaId
  );

  if (!materiaValida) {
    mostrarMensaje(
      "Elegí una materia de la lista disponible.",
      "error"
    );
    return;
  }

  // Prevención de duplicados equivalentes en la misma materia
  // y para el mismo tipo de actividad.
  const nuevaClave = claveActividad(titulo);

  if (!nuevaClave) {
    mostrarMensaje("El título tiene que incluir palabras que identifiquen la actividad.", "error");
    return;
  }

  const duplicada = actividades.some((actividad) => {
    if (
      actividad.materia_id !== materiaId ||
      actividad.tipo !== tipo
    ) {
      return false;
    }

    return claveActividad(actividad.titulo) === nuevaClave;
  });

  if (duplicada) {
    mostrarMensaje(
      "Parece que ya existe un anuncio equivalente para esa materia. Buscá en el tablón antes de publicarlo de nuevo.",
      "error"
    );
    return;
  }

  botonGuardar.disabled = true;
  mostrarMensaje("Publicando el anuncio…");

  try {
    const { data: actividad, error: actividadError } =
      await supabaseClient
        .from("actividades")
        .insert({
          materia_id: materiaId,
          tipo,
          titulo,
          titulo_normalizado: nuevaClave,
          descripcion,
          creada_por: usuarioActual.id
        })
        .select("id")
        .single();

    if (actividadError) throw actividadError;

    const { error: fechaError } = await supabaseClient
      .from("propuestas_fechas")
      .insert({
        actividad_id: actividad.id,
        fecha,
        propuesta_por: usuarioActual.id
      });

    if (fechaError) {
      mostrarMensaje(
        "El anuncio se guardó, pero no se pudo guardar su primera fecha. Podés proponerla desde el anuncio.",
        "error"
      );
      ocultarFormulario();
      await cargarAgenda();
      return;
    }

    ocultarFormulario();

    mostrarMensaje(
      "¡Anuncio publicado! Ya está disponible para el curso.",
      "success"
    );

    await cargarAgenda();
  } catch (error) {
    mensajeError(error, "No se pudo publicar el anuncio");
  } finally {
    botonGuardar.disabled = false;
  }
}

// ------------------------------------------------------
// 11. PROPONER OTRA FECHA
// ------------------------------------------------------

async function proponerFecha(actividadId, fecha) {
  if (!usuarioActual) {
    mostrarMensaje(
      "Ingresá con tu cuenta para proponer una fecha.",
      "error"
    );
    return;
  }

  if (!fecha || fecha < fechaLocalISO()) {
    mostrarMensaje(
      "Elegí una fecha de hoy o posterior.",
      "error"
    );
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("propuestas_fechas")
      .insert({
        actividad_id: actividadId,
        fecha,
        propuesta_por: usuarioActual.id
      });

    if (error) throw error;

    mostrarMensaje("La nueva fecha quedó propuesta.", "success");
    await cargarAgenda();
  } catch (error) {
    mensajeError(error, "No se pudo proponer la fecha");
  }
}

// ------------------------------------------------------
// 12. VOTAR UNA FECHA
// ------------------------------------------------------

async function votarFecha(propuestaFechaId) {
  if (!usuarioActual) {
    mostrarMensaje(
      "Ingresá con tu cuenta para votar.",
      "error"
    );
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("votos")
      .insert({
        propuesta_fecha_id: propuestaFechaId,
        usuario_id: usuarioActual.id
      });

    if (error) throw error;

    mostrarMensaje("Tu voto quedó registrado.", "success");
    await cargarAgenda();
  } catch (error) {
    if (error?.code === "23505") {
      mostrarMensaje(
        "Ya votaste por esta fecha.",
        "error"
      );
      await cargarAgenda();
    } else {
      mensajeError(error, "No se pudo registrar el voto");
    }
  }
}

// ------------------------------------------------------
// 13. EVENTOS DE LA PÁGINA
// ------------------------------------------------------

botonMostrar.addEventListener("click", mostrarFormulario);
botonCancelar.addEventListener("click", ocultarFormulario);
botonActualizar.addEventListener("click", cargarAgenda);

formulario.addEventListener("submit", publicarActividad);

formularioAcceso.addEventListener("submit", (evento) => {
  evento.preventDefault();
  autenticar(false);
});

botonRegistrarse.addEventListener("click", () => {
  autenticar(true);
});

botonSalir.addEventListener("click", async () => {
  botonSalir.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) throw error;

    usuarioActual = null;
    votos = [];

    actualizarPanelUsuario();
    await cargarAgenda();

    mostrarMensaje("Cerraste sesión.", "success");
  } catch (error) {
    mensajeError(error, "No se pudo cerrar sesión");
  } finally {
    botonSalir.disabled = false;
  }
});

campoBusqueda.addEventListener("input", renderizarAgenda);
filtroMateria.addEventListener("change", renderizarAgenda);
filtroTipo.addEventListener("change", renderizarAgenda);

// ------------------------------------------------------
// 14. INICIO
// ------------------------------------------------------

async function iniciarAplicacion() {
  campoFecha.min = fechaLocalISO();

  try {
    await cargarMaterias();

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) throw error;

    usuarioActual = data.session?.user || null;
    actualizarPanelUsuario();

    await cargarAgenda();

    // Mantiene actualizada la interfaz al ingresar o salir.
    supabaseClient.auth.onAuthStateChange(
      (_evento, session) => {
        usuarioActual = session?.user || null;
        actualizarPanelUsuario();

        // Evita hacer operaciones de red dentro del callback.
        setTimeout(() => {
          cargarAgenda();
        }, 0);
      }
    );
  } catch (error) {
    console.error("Error al iniciar la aplicación:", error);
    estadoCarga.classList.add("oculto");
    mensajeError(
      error,
      "No se pudo iniciar la aplicación"
    );
  }
}

iniciarAplicacion();
