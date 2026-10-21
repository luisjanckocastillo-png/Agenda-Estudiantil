// Configuración pública del cliente web de Supabase.
const SUPABASE_URL = "https://kgawufgfijvlzbjuqhdj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nQxzr-a2rCPMp5AaXZjBNQ_O7ChSexy";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const formulario = document.getElementById("formulario-actividad");
const formularioAcceso = document.getElementById("formulario-acceso");
const botonMostrar = document.getElementById("mostrar-formulario");
const botonCancelar = document.getElementById("cancelar-formulario");
const botonIngresar = document.getElementById("boton-ingresar");
const botonRegistrarse = document.getElementById("boton-registrarse");
const botonSalir = document.getElementById("boton-salir");
const botonActualizar = document.getElementById("boton-actualizar");
const panelAcceso = document.getElementById("panel-acceso");
const tituloAcceso = document.getElementById("titulo-acceso");
const textoAcceso = document.getElementById("texto-acceso");
const mensajeGlobal = document.getElementById("mensaje-global");
const lista = document.getElementById("lista-actividades");

const campoEmail = document.getElementById("email");
const campoContrasena = document.getElementById("contrasena");
const campoMateria = document.getElementById("materia");
const campoTipo = document.getElementById("tipo");
const campoTitulo = document.getElementById("titulo");
const campoFecha = document.getElementById("fecha");

const contadorTotal = document.getElementById("total-actividades");
const contadorEvaluaciones = document.getElementById("total-evaluaciones");
const contadorTP = document.getElementById("total-tp");

let usuarioActual = null;
let materias = [];
let actividades = [];
let propuestas = [];
let votos = [];
let modoRegistro = false;
let cargando = false;

function fechaLocalISO() {
  const ahora = new Date();
  const zonaLocal = new Date(
    ahora.getTime() - ahora.getTimezoneOffset() * 60000
  );
  return zonaLocal.toISOString().slice(0, 10);
}

function mostrarMensaje(texto, tipo = "") {
  mensajeGlobal.textContent = texto;
  mensajeGlobal.className = "mensaje" + (tipo ? " mensaje-" + tipo : "");
}

function mensajeError(error, contexto) {
  console.error(contexto, error);
  if (error?.code === "23505") {
    mostrarMensaje("Esa actividad o esa fecha ya fue propuesta. Revisá la agenda antes de volver a intentarlo.", "error");
  } else if (error?.code === "42501" || error?.code === "PGRST301") {
    mostrarMensaje("No tenés permiso para hacer eso. Revisá que hayas ingresado con tu cuenta.", "error");
  } else {
    mostrarMensaje(error?.message || "Ocurrió un error. Probá de nuevo en unos segundos.", "error");
  }
}

function crearElemento(tag, clase, texto) {
  const elemento = document.createElement(tag);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function formatearFecha(fecha) {
  const [anio, mes, dia] = fecha.split("-");
  return new Date(Number(anio), Number(mes) - 1, Number(dia))
    .toLocaleDateString("es-AR", {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
}

function calcularUrgencia(fecha) {
  const hoy = new Date(fechaLocalISO() + "T00:00:00");
  const diaActividad = new Date(fecha + "T00:00:00");
  const dias = Math.round((diaActividad - hoy) / (1000 * 60 * 60 * 24));

  if (dias <= 1) return { clase: "urgencia-roja", texto: "Muy próxima" };
  if (dias <= 3) return { clase: "urgencia-amarilla", texto: "Próxima" };
  return { clase: "urgencia-verde", texto: "Hay tiempo" };
}

function mostrarFormulario() {
  if (!usuarioActual) {
    mostrarMensaje("Ingresá con tu cuenta para proponer una actividad.", "error");
    return;
  }
  formulario.classList.remove("oculto");
  campoMateria.focus();
}

function ocultarFormulario() {
  formulario.reset();
  campoFecha.min = fechaLocalISO();
  formulario.classList.add("oculto");
}

function actualizarPanelUsuario() {
  const conectado = Boolean(usuarioActual);
  panelAcceso.classList.toggle("oculto", conectado);
  botonSalir.classList.toggle("oculto", !conectado);
  botonMostrar.disabled = !conectado;
  tituloAcceso.textContent = conectado ? "Sesión iniciada" : "Ingresá para participar";
  textoAcceso.textContent = conectado
    ? "Estás ingresado con " + usuarioActual.email + ". Ya podés proponer actividades y votar fechas."
    : "Podés consultar la agenda sin ingresar. Para proponer actividades o votar, necesitás una cuenta.";
  if (!conectado) ocultarFormulario();
}

async function cargarMaterias() {
  const { data, error } = await supabaseClient
    .from("materias")
    .select("id,nombre")
    .order("nombre");

  if (error) throw error;
  materias = data || [];
  campoMateria.replaceChildren();
  campoMateria.append(new Option("Elegí una materia", ""));
  materias.forEach((materia) => {
    campoMateria.append(new Option(materia.nombre, materia.id));
  });
}

async function cargarAgenda() {
  if (cargando) return;
  cargando = true;
  botonActualizar.disabled = true;

  try {
    const { data: actividadesData, error: actividadesError } = await supabaseClient
      .from("actividades")
      .select("id,materia_id,tipo,titulo,estado,created_at,materias(nombre),propuestas_fechas(id,fecha)")
      .order("created_at", { ascending: false });

    if (actividadesError) throw actividadesError;
    actividades = actividadesData || [];

    const idsPropuestas = actividades.flatMap((actividad) =>
      (actividad.propuestas_fechas || []).map((propuesta) => propuesta.id)
    );

    propuestas = actividades.flatMap((actividad) =>
      (actividad.propuestas_fechas || []).map((propuesta) => ({
        ...propuesta,
        actividad_id: actividad.id
      }))
    );

    votos = [];
    if (usuarioActual && idsPropuestas.length) {
      const { data: votosData, error: votosError } = await supabaseClient
        .from("votos")
        .select("propuesta_fecha_id,usuario_id")
        .in("propuesta_fecha_id", idsPropuestas);

      if (votosError) throw votosError;
      votos = votosData || [];
    }

    renderizarAgenda();
    mostrarMensaje("", "");
  } catch (error) {
    mensajeError(error, "No se pudo cargar la agenda");
    lista.replaceChildren();
    lista.append(
      crearElemento("div", "estado-vacio"),
      crearElemento("p", "", "No pudimos cargar las actividades. Revisá la conexión y tocá Actualizar.")
    );
  } finally {
    cargando = false;
    botonActualizar.disabled = false;
  }
}

function renderizarAgenda() {
  contadorTotal.textContent = actividades.length;
  contadorEvaluaciones.textContent = actividades.filter((actividad) => actividad.tipo === "prueba").length;
  contadorTP.textContent = actividades.filter((actividad) => actividad.tipo === "trabajo_practico").length;

  lista.replaceChildren();

  if (!actividades.length) {
    const vacio = crearElemento("div", "estado-vacio");
    vacio.append(
      crearElemento("span", "", "▤"),
      crearElemento("h3", "", "La agenda está lista para empezar"),
      crearElemento("p", "", "Todavía no hay actividades compartidas. Podés ser el primero en proponer una.")
    );
    lista.append(vacio);
    return;
  }

  const ordenadas = [...actividades].sort((a, b) => {
    const fechaA = (a.propuestas_fechas || []).map((p) => p.fecha).sort()[0] || "9999-12-31";
    const fechaB = (b.propuestas_fechas || []).map((p) => p.fecha).sort()[0] || "9999-12-31";
    return fechaA.localeCompare(fechaB);
  });

  ordenadas.forEach((actividad) => {
    const tarjeta = crearElemento("article", "actividad");
    const encabezado = crearElemento("div", "actividad-encabezado");
    const materiaNombre = actividad.materias?.nombre || "Materia";
    encabezado.append(
      crearElemento("span", "actividad-materia", materiaNombre),
      crearElemento("span", "actividad-estado", actividad.estado === "confirmada" ? "Fecha confirmada" : "Fecha a definir")
    );

    const titulo = crearElemento("h3", "actividad-titulo", actividad.titulo);
    const tipoTexto = actividad.tipo === "prueba" ? "Prueba / evaluación" : "Trabajo práctico";
    const detalle = crearElemento("p", "actividad-detalle", tipoTexto);
    const fechas = crearElemento("div", "propuestas-lista");
    const fechasActividad = (actividad.propuestas_fechas || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));

    if (fechasActividad.length) {
      fechas.append(crearElemento("h4", "", "Fechas propuestas"));
      fechasActividad.forEach((propuesta) => {
        const fila = crearElemento("div", "propuesta-fecha");
        const info = crearElemento("div", "propuesta-info");
        const urgencia = calcularUrgencia(propuesta.fecha);
        info.append(
          crearElemento("strong", "", formatearFecha(propuesta.fecha)),
          crearElemento("span", "actividad-urgencia " + urgencia.clase, urgencia.texto)
        );
        const cantidadVotos = votos.filter((voto) => voto.propuesta_fecha_id === propuesta.id).length;
        const votoPropio = usuarioActual && votos.some((voto) =>
          voto.propuesta_fecha_id === propuesta.id && voto.usuario_id === usuarioActual.id
        );
        const acciones = crearElemento("div", "acciones-propuesta");
        acciones.append(crearElemento("span", "contador-votos", cantidadVotos + (cantidadVotos === 1 ? " voto" : " votos")));

        const botonVotar = crearElemento("button", "boton-votar", votoPropio ? "Ya votaste" : "Votar fecha");
        botonVotar.type = "button";
        botonVotar.disabled = !usuarioActual || Boolean(votoPropio);
        botonVotar.addEventListener("click", () => votarFecha(propuesta.id));
        acciones.append(botonVotar);
        fila.append(info, acciones);
        fechas.append(fila);
      });
    } else {
      fechas.append(crearElemento("p", "nota", "Todavía no hay fechas propuestas."));
    }

    const formularioFecha = crearElemento("form", "formulario-fecha");
    const inputFecha = crearElemento("input", "campo-fecha");
    inputFecha.type = "date";
    inputFecha.min = fechaLocalISO();
    inputFecha.required = true;
    inputFecha.setAttribute("aria-label", "Proponer otra fecha para " + actividad.titulo);
    const botonProponer = crearElemento("button", "", "Proponer otra fecha");
    botonProponer.type = "submit";
    botonProponer.disabled = !usuarioActual;
    formularioFecha.append(inputFecha, botonProponer);
    formularioFecha.addEventListener("submit", async (evento) => {
      evento.preventDefault();
      await proponerFecha(actividad.id, inputFecha.value);
    });

    tarjeta.append(encabezado, titulo, detalle, fechas, formularioFecha);
    lista.append(tarjeta);
  });
}

async function autenticar(registrar) {
  const email = campoEmail.value.trim();
  const password = campoContrasena.value;

  if (!email || !password) {
    mostrarMensaje("Completá el correo y la contraseña.", "error");
    return;
  }

  botonIngresar.disabled = true;
  botonRegistrarse.disabled = true;
  mostrarMensaje(registrar ? "Creando la cuenta…" : "Ingresando…");

  try {
    const resultado = registrar
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });

    if (resultado.error) throw resultado.error;

    if (registrar && !resultado.data.session) {
      mostrarMensaje("La cuenta se creó. Revisá tu correo para confirmar el registro y después ingresá.", "success");
      return;
    }

    usuarioActual = resultado.data.user || null;
    actualizarPanelUsuario();
    mostrarMensaje(registrar ? "Cuenta creada correctamente." : "Ingresaste correctamente.", "success");
    await cargarAgenda();
  } catch (error) {
    mensajeError(error, "Error de autenticación");
  } finally {
    botonIngresar.disabled = false;
    botonRegistrarse.disabled = false;
  }
}

async function proponerActividad(evento) {
  evento.preventDefault();

  if (!usuarioActual) {
    mostrarMensaje("Primero ingresá con tu cuenta.", "error");
    return;
  }

  const materiaId = campoMateria.value;
  const tipo = campoTipo.value;
  const titulo = campoTitulo.value.trim();
  const fecha = campoFecha.value;

  if (!materiaId || !tipo || !titulo || !fecha) {
    mostrarMensaje("Completá todos los campos.", "error");
    return;
  }
  if (fecha < fechaLocalISO()) {
    mostrarMensaje("Elegí una fecha de hoy o posterior.", "error");
    return;
  }

  const botonGuardar = formulario.querySelector('button[type="submit"]');
  botonGuardar.disabled = true;

  try {
    const { data: actividad, error: actividadError } = await supabaseClient
      .from("actividades")
      .insert({
        materia_id: materiaId,
        tipo,
        titulo,
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
      mostrarMensaje("La actividad se guardó, pero no pudimos guardar la fecha. Podés proponerla desde la tarjeta.", "error");
      ocultarFormulario();
      await cargarAgenda();
      return;
    }

    ocultarFormulario();
    mostrarMensaje("Actividad propuesta y compartida con el curso.", "success");
    await cargarAgenda();
  } catch (error) {
    mensajeError(error, "No se pudo guardar la actividad");
  } finally {
    botonGuardar.disabled = false;
  }
}

async function proponerFecha(actividadId, fecha) {
  if (!usuarioActual) {
    mostrarMensaje("Ingresá con tu cuenta para proponer una fecha.", "error");
    return;
  }
  if (!fecha || fecha < fechaLocalISO()) {
    mostrarMensaje("Elegí una fecha de hoy o posterior.", "error");
    return;
  }

  try {
    const { error } = await supabaseClient.from("propuestas_fechas").insert({
      actividad_id: actividadId,
      fecha,
      propuesta_por: usuarioActual.id
    });
    if (error) throw error;
    mostrarMensaje("Nueva fecha propuesta.", "success");
    await cargarAgenda();
  } catch (error) {
    mensajeError(error, "No se pudo proponer la fecha");
  }
}

async function votarFecha(propuestaFechaId) {
  if (!usuarioActual) {
    mostrarMensaje("Ingresá con tu cuenta para votar.", "error");
    return;
  }

  try {
    const { error } = await supabaseClient.from("votos").insert({
      propuesta_fecha_id: propuestaFechaId,
      usuario_id: usuarioActual.id
    });
    if (error) throw error;
    mostrarMensaje("Tu voto quedó registrado.", "success");
    await cargarAgenda();
  } catch (error) {
    if (error?.code === "23505") {
      mostrarMensaje("Ya votaste por esta fecha.", "error");
      await cargarAgenda();
    } else {
      mensajeError(error, "No se pudo registrar el voto");
    }
  }
}

botonMostrar.addEventListener("click", mostrarFormulario);
botonCancelar.addEventListener("click", ocultarFormulario);
botonActualizar.addEventListener("click", cargarAgenda);
formulario.addEventListener("submit", proponerActividad);
formularioAcceso.addEventListener("submit", (evento) => {
  evento.preventDefault();
  autenticar(modoRegistro);
});
botonIngresar.addEventListener("click", () => { modoRegistro = false; });
botonRegistrarse.addEventListener("click", () => {
  modoRegistro = true;
  autenticar(true);
});
botonSalir.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    mensajeError(error, "No se pudo cerrar sesión");
    return;
  }
  usuarioActual = null;
  votos = [];
  actualizarPanelUsuario();
  mostrarMensaje("Cerraste sesión.", "success");
  await cargarAgenda();
});

campoFecha.min = fechaLocalISO();

async function iniciar() {
  try {
    await cargarMaterias();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    usuarioActual = data.session?.user || null;
    actualizarPanelUsuario();
    await cargarAgenda();

    supabaseClient.auth.onAuthStateChange((_evento, session) => {
      usuarioActual = session?.user || null;
      actualizarPanelUsuario();
      cargarAgenda();
    });
  } catch (error) {
    mensajeError(error, "No se pudo iniciar la aplicación");
  }
}

iniciar();