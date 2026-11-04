'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lip/supabase';

interface PerfilUsuario {
  id: string;
  email: string;
  nombre_completo: string;
  rol: 'Administradora' | 'Abogada Colaboradora';
}

interface Tarea {
  id: string;
  expediente_id: string;
  descripcion: string;
  tipo: string;
  estado: 'Pendiente' | 'Completado';
  fecha_programada: string | null;
}

interface Documento {
  id: string;
  expediente_id: string;
  nombre_archivo: string;
  url_archivo: string;
  tipo_documento: string;
  creado_en: string;
}

interface Expediente {
  id: string;
  nombres: string;
  numero_expediente: string;
  juzgado: string;
  materia: string;
  estado_administrativo: 'Activo' | 'Concluido';
  etapa_procesal: string;
  resultado: string | null;
  observaciones_migracion: string | null;
  abogada_asignada: string | null;
  tareas?: Tarea[];
  documentos_expediente?: Documento[];
}

interface ContactoDirectorio {
  id: string;
  juzgado: string;
  especialista: string;
  notas: string | null;
}

type CategoriaJuridica =
  | 'Todas'
  | 'Familia'
  | 'Penal'
  | 'Civil y Sucesiones'
  | 'Reales y Patrimoniales'
  | 'Laboral y Otros';

const COLORES_CATEGORIA: Record<
  Exclude<CategoriaJuridica, 'Todas'>,
  { hex: string; bgBadge: string; textBadge: string; barClass: string }
> = {
  Familia: {
    hex: '#d97706', // Ámbar / Dorado
    bgBadge: 'bg-amber-100',
    textBadge: 'text-amber-900',
    barClass: 'bg-amber-500',
  },
  Penal: {
    hex: '#dc2626', // Rojo Carmesí
    bgBadge: 'bg-red-100',
    textBadge: 'text-red-900',
    barClass: 'bg-red-600',
  },
  'Civil y Sucesiones': {
    hex: '#059669', // Esmeralda
    bgBadge: 'bg-emerald-100',
    textBadge: 'text-emerald-900',
    barClass: 'bg-emerald-600',
  },
  'Reales y Patrimoniales': {
    hex: '#2563eb', // Azul Real
    bgBadge: 'bg-blue-100',
    textBadge: 'text-blue-900',
    barClass: 'bg-blue-600',
  },
  'Laboral y Otros': {
    hex: '#7c3aed', // Violeta
    bgBadge: 'bg-violet-100',
    textBadge: 'text-violet-900',
    barClass: 'bg-violet-600',
  },
};

export default function OneLawApp() {
  const [sesionVerificada, setSesionVerificada] = useState(false);
  const [perfilActual, setPerfilActual] = useState<PerfilUsuario | null>(null);
  const [listaColaboradoras, setListaColaboradoras] = useState<PerfilUsuario[]>([]);

  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');
  const [errorLogin, setErrorLogin] = useState<string | null>(null);
  const [iniciandoSesion, setIniciandoSesion] = useState(false);

  const [vistaActiva, setVistaActiva] = useState<'cartera' | 'agenda' | 'directorio' | 'equipo'>('cartera');

  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [directorio, setDirectorio] = useState<ContactoDirectorio[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros interactivos (Por defecto muestra 'Activo')
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activo' | 'Concluido'>('Activo');
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaJuridica>('Todas');
  const [subMateriaSeleccionada, setSubMateriaSeleccionada] = useState<string | null>(null);
  const [filtroTipoTarea, setFiltroTipoTarea] = useState<string>('Todas');
  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');

  const [radarExpandido, setRadarExpandido] = useState(true);

  // Ficha Lateral
  const [expSeleccionado, setExpSeleccionado] = useState<Expediente | null>(null);
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [guardandoFicha, setGuardandoFicha] = useState(false);

  const [fichaEstadoAdmin, setFichaEstadoAdmin] = useState<'Activo' | 'Concluido'>('Activo');
  const [fichaEtapa, setFichaEtapa] = useState('');
  const [fichaJuzgado, setFichaJuzgado] = useState('');
  const [fichaResultado, setFichaResultado] = useState('');
  const [fichaAsignada, setFichaAsignada] = useState('Todo el Estudio');

  const [fichaNuevaTareaDesc, setFichaNuevaTareaDesc] = useState('');
  const [fichaNuevaTareaTipo, setFichaNuevaTareaTipo] = useState('Plazo procesal');
  const [fichaNuevaTareaFecha, setFichaNuevaTareaFecha] = useState('');

  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [eliminandoDocId, setEliminandoDocId] = useState<string | null>(null);
  const [tipoDocSubida, setTipoDocSubida] = useState('Resolución / Cédula CEJ');

  // Modal Nuevo Expediente + IA
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);
  const [analizandoDocumentoIA, setAnalizandoDocumentoIA] = useState(false);
  const [mensajeIA, setMensajeIA] = useState<string | null>(null);
  const [archivoInicialNuevoCaso, setArchivoInicialNuevoCaso] = useState<File | null>(null);

  const [nuevoNombres, setNuevoNombres] = useState('');
  const [nuevoNumExp, setNuevoNumExp] = useState('');
  const [nuevoJuzgado, setNuevoJuzgado] = useState('');
  const [nuevaMateria, setNuevaMateria] = useState('');
  const [nuevoEstadoAdmin, setNuevoEstadoAdmin] = useState<'Activo' | 'Concluido'>('Activo');
  const [nuevaEtapa, setNuevaEtapa] = useState('');
  const [nuevaAsignada, setNuevaAsignada] = useState('Todo el Estudio');
  const [nuevaTareaDesc, setNuevaTareaDesc] = useState('');
  const [nuevaTareaTipo, setNuevaTareaTipo] = useState('Plazo procesal');
  const [nuevaTareaFecha, setNuevaTareaFecha] = useState('');
  const [nuevoEspecialista, setNuevoEspecialista] = useState('');
  const [nuevoTelefonoAnexo, setNuevoTelefonoAnexo] = useState('');

  // Modal Directorio
  const [modalDirAbierto, setModalDirAbierto] = useState(false);
  const [dirJuzgado, setDirJuzgado] = useState('');
  const [dirEspecialista, setDirEspecialista] = useState('');
  const [dirNotas, setDirNotas] = useState('');
  const [errorDirectorio, setErrorDirectorio] = useState<string | null>(null);

  // Clasificación macro por Categoría Jurídica
  const clasificarMateria = (materiaRaw: string): Exclude<CategoriaJuridica, 'Todas'> => {
    const m = (materiaRaw || '').toUpperCase();
    if (
      m.includes('OAF') ||
      m.includes('PENAL') ||
      m.includes('LESIONES') ||
      m.includes('CALUMNIOSA') ||
      m.includes('REHABILITACION') ||
      m.includes('REHABIL.') ||
      m.includes('HURTO') ||
      m.includes('ROBO') ||
      m.includes('PRUEBA ANTICIPADA')
    ) {
      return 'Penal';
    }
    if (
      m.includes('ALIMENTO') ||
      m.includes('ALIM.') ||
      m.includes('FILIACION') ||
      m.includes('DIVORCIO') ||
      m.includes('VIOLENCIA') ||
      m.includes('VIOLEN.') ||
      m.includes('VIOLE.') ||
      m.includes('MEDIDAS DE PROTECCION') ||
      m.includes('MEDIDAS.PROTECCION') ||
      m.includes('TENENCIA') ||
      m.includes('PATERNIDAD') ||
      m.includes('PATER.EXTRA') ||
      m.includes('LIQUIDACION')
    ) {
      return 'Familia';
    }
    if (
      m.includes('DESALOJO') ||
      m.includes('CONTRATO') ||
      m.includes('PROPIEDAD') ||
      m.includes('USUCAPION') ||
      m.includes('POSESION') ||
      m.includes('REIVINDICACION') ||
      m.includes('REAL')
    ) {
      return 'Reales y Patrimoniales';
    }
    if (
      m.includes('SUCESION') ||
      m.includes('SUSESION') ||
      m.includes('HERENCIA') ||
      m.includes('HERENECIA') ||
      m.includes('HEREDERO') ||
      m.includes('CONCILIACION') ||
      m.includes('SUMA DE DINERO') ||
      m.includes('RECTIFICACION') ||
      m.includes('CAMBIO DE NOMBRE') ||
      m.includes('CIVIL')
    ) {
      return 'Civil y Sucesiones';
    }
    return 'Laboral y Otros';
  };

  // Clasificación detallada por Sub-Materia
  const obtenerSubMateria = (materiaRaw: string): string => {
    const m = (materiaRaw || '').toUpperCase();
    if (m.includes('EXONERACION')) return 'Exoneración / Reducción Alimentos';
    if (m.includes('AUMENTO')) return 'Aumento de Alimentos';
    if (m.includes('ALIMENTO') || m.includes('ALIM.')) return 'Demanda de Alimentos';
    if (m.includes('FILIACION') || m.includes('PATERNIDAD') || m.includes('PATER.EXTRA')) return 'Filiación y Paternidad';
    if (m.includes('VIOLENCIA') || m.includes('VIOLEN.') || m.includes('VIOLE.') || m.includes('PROTECCION')) return 'Violencia / Medidas de Protección';
    if (m.includes('DIVORCIO')) return 'Divorcio por Causal';
    if (m.includes('TENENCIA')) return 'Tenencia y Régimen de Visitas';
    if (m.includes('LIQUIDACION')) return 'Liquidación de Pensiones Devengadas';
    if (m.includes('OAF')) return 'Omisión a la Asistencia Familiar (OAF)';
    if (m.includes('LESIONES')) return 'Lesiones Culposas / Agresiones';
    if (m.includes('REHABILITACION') || m.includes('REHABIL.')) return 'Rehabilitación Penal';
    if (m.includes('CALUMNIOSA') || m.includes('PRUEBA ANTICIPADA')) return 'Denuncia Calumniosa / Prueba Ant.';
    if (m.includes('SUCESION') || m.includes('SUSESION')) return 'Sucesión Intestada';
    if (m.includes('HERENCIA') || m.includes('HERENECIA') || m.includes('HEREDERO')) return 'Petición / Exclusión de Herencia';
    if (m.includes('CONCILIACION')) return 'Ejecución de Acta de Conciliación';
    if (m.includes('SUMA DE DINERO') || m.includes('CIVIL')) return 'Obligación de Dar Suma de Dinero';
    if (m.includes('RECTIFICACION') || m.includes('CAMBIO DE NOMBRE')) return 'Rectificación de Partida / Nombre';
    if (m.includes('DESALOJO')) return 'Desalojo por Ocupante Precario';
    if (m.includes('CONTRATO') || m.includes('PROPIEDAD')) return 'Contratos y Propiedad';
    if (m.includes('PENSION') || m.includes('LABORAL')) return 'Derecho Laboral / Pensión';
    return 'Otros Procesos Especiales';
  };

  const calcularFechaDiasHabiles = (diasHabiles: number): string => {
    const fecha = new Date();
    let agregados = 0;
    while (agregados < diasHabiles) {
      fecha.setDate(fecha.getDate() + 1);
      const diaSemana = fecha.getDay();
      if (diaSemana !== 0 && diaSemana !== 6) {
        agregados++;
      }
    }
    return fecha.toISOString().split('T')[0];
  };

  const evaluarUrgenciaTarea = (tarea: Tarea) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (tarea.fecha_programada) {
      const partes = tarea.fecha_programada.split('-');
      if (partes.length === 3) {
        const fechaMeta = new Date(
          Number(partes[0]),
          Number(partes[1]) - 1,
          Number(partes[2])
        );
        const diffTiempo = fechaMeta.getTime() - hoy.getTime();
        const diasRestantes = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24));

        if (diasRestantes < 0) {
          return {
            nivel: 'vencido' as const,
            dias: diasRestantes,
            etiqueta: `🚨 VENCIDO HACE ${Math.abs(diasRestantes)} DÍA(S)`,
            colorBadge: 'bg-red-600 text-white',
          };
        }
        if (diasRestantes === 0) {
          return {
            nivel: 'critico' as const,
            dias: 0,
            etiqueta: '🚨 VENCE HOY (URGENTE)',
            colorBadge: 'bg-red-600 text-white',
          };
        }
        if (diasRestantes <= 3) {
          return {
            nivel: 'critico' as const,
            dias: diasRestantes,
            etiqueta: `⚠️ QUEDAN ${diasRestantes} DÍA(S) (PLAZO FATAL)`,
            colorBadge: 'bg-amber-500 text-stone-950',
          };
        }
        return {
          nivel: 'normal' as const,
          dias: diasRestantes,
          etiqueta: `📅 En ${diasRestantes} días`,
          colorBadge: 'bg-stone-100 text-stone-700',
        };
      }
    }

    if (tarea.tipo === 'Audiencia' || tarea.tipo.includes('Plazo')) {
      return {
        nivel: 'sin_fecha_critica' as const,
        dias: 99,
        etiqueta: '⚠️ ASIGNAR FECHA',
        colorBadge: 'bg-amber-100 text-amber-900 border border-amber-300',
      };
    }

    return {
      nivel: 'normal' as const,
      dias: 999,
      etiqueta: 'Seguimiento CEJ',
      colorBadge: 'bg-stone-100 text-stone-600',
    };
  };

  useEffect(() => {
    const verificarSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await cargarPerfilUsuario(session.user.id, session.user.email || '');
      }
      setSesionVerificada(true);
    };

    verificarSesion();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await cargarPerfilUsuario(session.user.id, session.user.email || '');
      } else {
        setPerfilActual(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const cargarPerfilUsuario = async (userId: string, email: string) => {
    const { data: perfilExistente } = await supabase
      .from('perfiles_usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (perfilExistente) {
      setPerfilActual(perfilExistente);
    } else {
      const { count } = await supabase
        .from('perfiles_usuarios')
        .select('*', { count: 'exact', head: true });

      const rolInicial = (count ?? 0) === 0 ? 'Administradora' : 'Abogada Colaboradora';
      const nombreSugerido = email.split('@')[0].toUpperCase();

      const { data: nuevoPerfil } = await supabase
        .from('perfiles_usuarios')
        .insert({
          id: userId,
          email,
          nombre_completo: nombreSugerido,
          rol: rolInicial,
        })
        .select('*')
        .single();

      if (nuevoPerfil) setPerfilActual(nuevoPerfil);
    }
  };

  const cargarTodo = async () => {
    if (!perfilActual) return;
    setCargando(true);

    const [resExp, resDir, resEquipo] = await Promise.all([
      supabase
        .from('expedientes')
        .select(`*, tareas (*), documentos_expediente (*)`)
        .order('nombres', { ascending: true }),
      supabase.from('directorio_juzgados').select('*').order('juzgado', { ascending: true }),
      supabase.from('perfiles_usuarios').select('*').order('nombre_completo', { ascending: true }),
    ]);

    if (!resExp.error && resExp.data) {
      setExpedientes(resExp.data);
      if (expSeleccionado) {
        const actualizado = resExp.data.find((e) => e.id === expSeleccionado.id);
        if (actualizado) setExpSeleccionado(actualizado);
      }
    }
    if (!resDir.error && resDir.data) setDirectorio(resDir.data);
    if (!resEquipo.error && resEquipo.data) setListaColaboradoras(resEquipo.data);
    setCargando(false);
  };

  useEffect(() => {
    if (perfilActual) {
      cargarTodo();
    }
  }, [perfilActual]);

  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLogin(null);
    setIniciandoSesion(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLogin.trim(),
      password: passwordLogin,
    });

    if (error) {
      setErrorLogin('Credenciales incorrectas o usuario no autorizado.');
    }
    setIniciandoSesion(false);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setPerfilActual(null);
    setExpSeleccionado(null);
  };

  const expedientesAutorizados = useMemo(() => {
    if (!perfilActual) return [];
    if (perfilActual.rol === 'Administradora') return expedientes;

    return expedientes.filter(
      (exp) =>
        !exp.abogada_asignada ||
        exp.abogada_asignada === 'Todo el Estudio' ||
        exp.abogada_asignada.toLowerCase() === perfilActual.email.toLowerCase() ||
        exp.abogada_asignada.toUpperCase() === perfilActual.nombre_completo.toUpperCase()
    );
  }, [expedientes, perfilActual]);

  // =========================================================================
  // CÁLCULOS MATEMÁTICOS PARA EL DASHBOARD GRÁFICO (DONUT + BARRAS)
  // =========================================================================
  const estadisticasCategorias = useMemo(() => {
    const catList: Exclude<CategoriaJuridica, 'Todas'>[] = [
      'Familia',
      'Penal',
      'Civil y Sucesiones',
      'Reales y Patrimoniales',
      'Laboral y Otros',
    ];

    const totalGeneral = expedientesAutorizados.length || 1;
    let acumuladoPorcentaje = 0;

    return catList.map((cat) => {
      const casosCat = expedientesAutorizados.filter((e) => clasificarMateria(e.materia) === cat);
      const activos = casosCat.filter((e) => e.estado_administrativo === 'Activo').length;
      const concluidos = casosCat.filter((e) => e.estado_administrativo === 'Concluido').length;
      const total = casosCat.length;
      const fraccion = total / totalGeneral;
      const porcentajeExacto = Math.round(fraccion * 100);

      const offsetInicio = acumuladoPorcentaje;
      acumuladoPorcentaje += fraccion;

      return {
        nombre: cat,
        activos,
        concluidos,
        total,
        fraccion,
        porcentajeExacto,
        offsetInicio,
        color: COLORES_CATEGORIA[cat],
      };
    });
  }, [expedientesAutorizados]);

  // Desglose de Sub-Materias (muestra todas o las de la categoría seleccionada)
  const desgloseSubMaterias = useMemo(() => {
    const baseCasos =
      filtroCategoria === 'Todas'
        ? expedientesAutorizados
        : expedientesAutorizados.filter((e) => clasificarMateria(e.materia) === filtroCategoria);

    const mapa: Record<
      string,
      {
        nombre: string;
        categoria: Exclude<CategoriaJuridica, 'Todas'>;
        activos: number;
        concluidos: number;
        total: number;
      }
    > = {};

    baseCasos.forEach((exp) => {
      const sub = obtenerSubMateria(exp.materia);
      const cat = clasificarMateria(exp.materia);
      if (!mapa[sub]) {
        mapa[sub] = { nombre: sub, categoria: cat, activos: 0, concluidos: 0, total: 0 };
      }
      mapa[sub].total += 1;
      if (exp.estado_administrativo === 'Activo') mapa[sub].activos += 1;
      else mapa[sub].concluidos += 1;
    });

    const lista = Object.values(mapa).sort((a, b) => b.total - a.total);
    const maxTotal = lista.length > 0 ? Math.max(...lista.map((i) => i.total), 1) : 1;

    return lista.map((item) => ({
      ...item,
      porcentajeBarra: Math.round((item.total / maxTotal) * 100),
      color: COLORES_CATEGORIA[item.categoria],
    }));
  }, [expedientesAutorizados, filtroCategoria]);

  const alertasCriticas = useMemo(() => {
    const criticas: (Tarea & {
      expediente: Expediente;
      infoUrgencia: ReturnType<typeof evaluarUrgenciaTarea>;
    })[] = [];

    expedientesAutorizados.forEach((exp) => {
      if (exp.estado_administrativo !== 'Activo') return;
      exp.tareas?.forEach((t) => {
        if (t.estado !== 'Pendiente') return;
        const infoUrgencia = evaluarUrgenciaTarea(t);
        const esAudienciaOPlazo =
          t.tipo === 'Audiencia' ||
          t.tipo.includes('Plazo') ||
          infoUrgencia.nivel === 'critico' ||
          infoUrgencia.nivel === 'vencido';

        if (esAudienciaOPlazo) {
          criticas.push({ ...t, expediente: exp, infoUrgencia });
        }
      });
    });

    return criticas.sort((a, b) => a.infoUrgencia.dias - b.infoUrgencia.dias);
  }, [expedientesAutorizados]);

  const normalizarCodigo = (codigo: string) => codigo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  const expedienteDuplicado = useMemo(() => {
    const codigoLimpio = normalizarCodigo(nuevoNumExp);
    if (!codigoLimpio || codigoLimpio.length < 4) return null;
    return expedientes.find(
      (exp) => exp.numero_expediente && normalizarCodigo(exp.numero_expediente) === codigoLimpio
    );
  }, [nuevoNumExp, expedientes]);

  const expedientesFiltrados = useMemo(() => {
    return expedientesAutorizados.filter((exp) => {
      const cumpleEstado = filtroEstado === 'Todos' || exp.estado_administrativo === filtroEstado;
      const cumpleCategoria =
        filtroCategoria === 'Todas' || clasificarMateria(exp.materia) === filtroCategoria;
      const cumpleSubMateria =
        !subMateriaSeleccionada || obtenerSubMateria(exp.materia) === subMateriaSeleccionada;

      const termino = busqueda.toLowerCase().trim();
      if (!termino) return cumpleEstado && cumpleCategoria && cumpleSubMateria;

      const coincideTexto =
        exp.nombres?.toLowerCase().includes(termino) ||
        exp.numero_expediente?.toLowerCase().includes(termino) ||
        exp.juzgado?.toLowerCase().includes(termino) ||
        exp.materia?.toLowerCase().includes(termino) ||
        exp.etapa_procesal?.toLowerCase().includes(termino);

      return cumpleEstado && cumpleCategoria && cumpleSubMateria && coincideTexto;
    });
  }, [expedientesAutorizados, busqueda, filtroEstado, filtroCategoria, subMateriaSeleccionada]);

  const todasLasTareas = useMemo(() => {
    const lista: (Tarea & {
      expediente: Expediente;
      infoUrgencia: ReturnType<typeof evaluarUrgenciaTarea>;
    })[] = [];
    expedientesAutorizados.forEach((exp) => {
      exp.tareas?.forEach((t) => {
        lista.push({ ...t, expediente: exp, infoUrgencia: evaluarUrgenciaTarea(t) });
      });
    });

    return lista
      .filter((t) => filtroTipoTarea === 'Todas' || t.tipo === filtroTipoTarea)
      .sort((a, b) => {
        if (a.estado !== b.estado) return a.estado === 'Pendiente' ? -1 : 1;
        return a.infoUrgencia.dias - b.infoUrgencia.dias;
      });
  }, [expedientesAutorizados, filtroTipoTarea]);

  const directorioFiltrado = useMemo(() => {
    const t = busquedaDirectorio.toLowerCase().trim();
    if (!t) return directorio;
    return directorio.filter(
      (d) =>
        d.juzgado?.toLowerCase().includes(t) ||
        d.especialista?.toLowerCase().includes(t) ||
        d.notas?.toLowerCase().includes(t)
    );
  }, [directorio, busquedaDirectorio]);

  const metricas = useMemo(() => {
    const total = expedientesAutorizados.length;
    const activos = expedientesAutorizados.filter((e) => e.estado_administrativo === 'Activo').length;
    const concluidos = expedientesAutorizados.filter((e) => e.estado_administrativo === 'Concluido').length;
    const tareasPendientes = expedientesAutorizados.reduce(
      (acc, exp) => acc + (exp.tareas?.filter((t) => t.estado === 'Pendiente').length || 0),
      0
    );
    return { total, activos, concluidos, tareasPendientes };
  }, [expedientesAutorizados]);

  const abrirFicha = (exp: Expediente) => {
    setExpSeleccionado(exp);
    setFichaEstadoAdmin(exp.estado_administrativo);
    setFichaEtapa(exp.etapa_procesal || '');
    setFichaJuzgado(exp.juzgado || '');
    setFichaResultado(exp.resultado || '');
    setFichaAsignada(exp.abogada_asignada || 'Todo el Estudio');
    setEditandoFicha(false);
  };

  const guardarCambiosFicha = async () => {
    if (!expSeleccionado) return;
    setGuardandoFicha(true);

    const { error } = await supabase
      .from('expedientes')
      .update({
        estado_administrativo: fichaEstadoAdmin,
        etapa_procesal: fichaEtapa.trim().toUpperCase(),
        juzgado: fichaJuzgado.trim().toUpperCase(),
        resultado: fichaResultado.trim().toUpperCase() || null,
        abogada_asignada: fichaAsignada,
      })
      .eq('id', expSeleccionado.id);

    if (!error) {
      await cargarTodo();
      setEditandoFicha(false);
    }
    setGuardandoFicha(false);
  };

  const marcarAlertaComoVerificada = async (idExp: string) => {
    await supabase.from('expedientes').update({ observaciones_migracion: null }).eq('id', idExp);
    await cargarTodo();
  };

  const agregarTareaEnFicha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expSeleccionado || !fichaNuevaTareaDesc.trim()) return;

    await supabase.from('tareas').insert({
      expediente_id: expSeleccionado.id,
      descripcion: fichaNuevaTareaDesc.trim().toUpperCase(),
      tipo: fichaNuevaTareaTipo,
      estado: 'Pendiente',
      fecha_programada: fichaNuevaTareaFecha || null,
    });

    setFichaNuevaTareaDesc('');
    setFichaNuevaTareaFecha('');
    await cargarTodo();
  };

  const cambiarEstadoTarea = async (tarea: Tarea) => {
    const nuevoEstado = tarea.estado === 'Pendiente' ? 'Completado' : 'Pendiente';
    await supabase.from('tareas').update({ estado: nuevoEstado }).eq('id', tarea.id);
    await cargarTodo();
  };

  const manejarSubidaArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !expSeleccionado) return;

    setSubiendoArchivo(true);
    try {
      const ext = file.name.split('.').pop();
      const nombreSeguro = `${expSeleccionado.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('anexos-expedientes')
        .upload(nombreSeguro, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('anexos-expedientes')
        .getPublicUrl(nombreSeguro);

      await supabase.from('documentos_expediente').insert({
        expediente_id: expSeleccionado.id,
        nombre_archivo: file.name,
        url_archivo: publicUrlData.publicUrl,
        tipo_documento: tipoDocSubida,
      });

      await cargarTodo();
    } catch (err: any) {
      alert(`Error al subir el anexo: ${err.message}`);
    } finally {
      setSubiendoArchivo(false);
      e.target.value = '';
    }
  };

  const eliminarDocumentoSubido = async (doc: Documento) => {
    const confirmar = window.confirm(`¿Estás segura de eliminar el documento "${doc.nombre_archivo}"?`);
    if (!confirmar) return;

    setEliminandoDocId(doc.id);
    try {
      const marcadorBucket = '/anexos-expedientes/';
      const indice = doc.url_archivo.indexOf(marcadorBucket);
      if (indice !== -1) {
        const rutaStorage = decodeURIComponent(
          doc.url_archivo.substring(indice + marcadorBucket.length)
        );
        await supabase.storage.from('anexos-expedientes').remove([rutaStorage]);
      }

      await supabase.from('documentos_expediente').delete().eq('id', doc.id);
      await cargarTodo();
    } catch (err: any) {
      alert(`No se pudo eliminar el documento: ${err.message}`);
    } finally {
      setEliminandoDocId(null);
    }
  };

  const escanearDocumentoNuevoCaso = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivoInicialNuevoCaso(file);
    setAnalizandoDocumentoIA(true);
    setErrorFormulario(null);
    setMensajeIA('Analizando documento judicial con IA...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/extraer-expediente', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar el documento.');

      if (data.nombres) setNuevoNombres(data.nombres.toUpperCase());
      if (data.numero_expediente) setNuevoNumExp(data.numero_expediente.toUpperCase());
      if (data.juzgado) setNuevoJuzgado(data.juzgado.toUpperCase());
      if (data.materia) setNuevaMateria(data.materia.toUpperCase());
      if (data.etapa_procesal) setNuevaEtapa(data.etapa_procesal.toUpperCase());
      if (data.proxima_actuacion) setNuevaTareaDesc(data.proxima_actuacion.toUpperCase());
      if (data.tipo_tarea) setNuevaTareaTipo(data.tipo_tarea);
      if (data.fecha_programada) setNuevaTareaFecha(data.fecha_programada);
      if (data.especialista) setNuevoEspecialista(data.especialista.toUpperCase());

      setMensajeIA(`✓ Datos extraídos de "${file.name}". Verifica y guarda.`);
    } catch (err: any) {
      setMensajeIA(null);
      setErrorFormulario(`Aviso IA: ${err.message}. Completa manualmente si es necesario.`);
    } finally {
      setAnalizandoDocumentoIA(false);
      e.target.value = '';
    }
  };

  const guardarNuevoExpediente = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorFormulario(null);

    const nombresLimpio = nuevoNombres.replace(/\s+/g, ' ').trim().toUpperCase();
    const expLimpio = nuevoNumExp.replace(/\s+/g, ' ').trim().toUpperCase();
    const juzgadoLimpio = nuevoJuzgado.replace(/\s+/g, ' ').trim().toUpperCase();
    const materiaLimpia = nuevaMateria.replace(/\s+/g, ' ').trim().toUpperCase();
    const etapaLimpia =
      nuevaEtapa.trim().toUpperCase() ||
      (nuevoEstadoAdmin === 'Concluido' ? 'CONCLUIDO / ARCHIVADO' : 'EN TRÁMITE INICIAL');

    if (!nombresLimpio || !juzgadoLimpio || !materiaLimpia) {
      setErrorFormulario('Completa los campos obligatorios.');
      return;
    }

    if (expedienteDuplicado) {
      setErrorFormulario(`Bloqueado: El expediente ${expLimpio} ya pertenece a ${expedienteDuplicado.nombres}.`);
      return;
    }

    setGuardandoNuevo(true);
    try {
      const { data: expCreado, error: errorExp } = await supabase
        .from('expedientes')
        .insert({
          nombres: nombresLimpio,
          numero_expediente: expLimpio || null,
          juzgado: juzgadoLimpio,
          materia: materiaLimpia,
          estado_administrativo: nuevoEstadoAdmin,
          etapa_procesal: etapaLimpia,
          abogada_asignada: nuevaAsignada,
        })
        .select('id')
        .single();

      if (errorExp) throw errorExp;

      if (nuevaTareaDesc.trim() && expCreado?.id) {
        await supabase.from('tareas').insert({
          expediente_id: expCreado.id,
          descripcion: nuevaTareaDesc.trim().toUpperCase(),
          tipo: nuevaTareaTipo,
          estado: 'Pendiente',
          fecha_programada: nuevaTareaFecha || null,
        });
      }

      if (nuevoEspecialista.trim() || nuevoTelefonoAnexo.trim()) {
        await supabase.from('directorio_juzgados').insert({
          juzgado: juzgadoLimpio,
          especialista: nuevoEspecialista.trim().toUpperCase() || 'NO ESPECIFICADO',
          notas: `${nuevoTelefonoAnexo.trim().toUpperCase()} (Exp: ${expLimpio || 'S/N'})`,
        });
      }

      if (archivoInicialNuevoCaso && expCreado?.id) {
        const ext = archivoInicialNuevoCaso.name.split('.').pop();
        const nombreSeguro = `${expCreado.id}/${Date.now()}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from('anexos-expedientes')
          .upload(nombreSeguro, archivoInicialNuevoCaso);

        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from('anexos-expedientes')
            .getPublicUrl(nombreSeguro);

          await supabase.from('documentos_expediente').insert({
            expediente_id: expCreado.id,
            nombre_archivo: archivoInicialNuevoCaso.name,
            url_archivo: urlData.publicUrl,
            tipo_documento: 'Documento Inicial Escaneado',
          });
        }
      }

      await cargarTodo();
      setModalAbierto(false);
    } catch (err: any) {
      setErrorFormulario(err.message || 'Error al guardar.');
    } finally {
      setGuardandoNuevo(false);
    }
  };

  const guardarContactoDirectorio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorDirectorio(null);

    const juzLimpio = dirJuzgado.replace(/\s+/g, ' ').trim().toUpperCase();
    const espLimpio = dirEspecialista.replace(/\s+/g, ' ').trim().toUpperCase();
    const notasLimpio = dirNotas.replace(/\s+/g, ' ').trim().toUpperCase();

    const existe = directorio.find(
      (d) => d.juzgado.toUpperCase() === juzLimpio && d.especialista.toUpperCase() === espLimpio
    );

    if (existe) {
      setErrorDirectorio('Especialista ya registrado en este juzgado.');
      return;
    }

    const { error } = await supabase.from('directorio_juzgados').insert({
      juzgado: juzLimpio,
      especialista: espLimpio || 'NO ESPECIFICADO',
      notas: notasLimpio,
    });

    if (!error) {
      setDirJuzgado('');
      setDirEspecialista('');
      setDirNotas('');
      setModalDirAbierto(false);
      await cargarTodo();
    }
  };

  const cambiarRolMiembro = async (idUsuario: string, nuevoRol: 'Administradora' | 'Abogada Colaboradora') => {
    await supabase.from('perfiles_usuarios').update({ rol: nuevoRol }).eq('id', idUsuario);
    if (perfilActual?.id === idUsuario) {
      setPerfilActual({ ...perfilActual, rol: nuevoRol });
    }
    await cargarTodo();
  };

  if (!sesionVerificada) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-300 text-sm">
        Verificando credenciales de seguridad...
      </div>
    );
  }

  if (!perfilActual) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col justify-center items-center p-6 font-sans">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-stone-900 p-8 text-center border-b border-stone-800">
            <div className="w-10 h-1.5 bg-amber-500 mx-auto mb-4 rounded-full" />
            <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold block">
              Almonacid Law Firm
            </span>
            <h1 className="text-2xl font-bold text-white mt-1">ONE LAW</h1>
            <p className="text-xs text-stone-400 mt-1">Acceso Restringido • Sistema de Gestión Procesal</p>
          </div>

          <form onSubmit={manejarLogin} className="p-8 space-y-5">
            {errorLogin && (
              <div className="bg-red-50 border border-red-200 text-red-900 text-xs font-medium p-3.5 rounded-lg">
                ⚠️ {errorLogin}
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase text-stone-600 mb-1.5">Correo Electrónico</label>
              <input
                type="email"
                required
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-stone-600 mb-1.5">Contraseña</label>
              <input
                type="password"
                required
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={iniciandoSesion}
              className="w-full bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold py-3 rounded-lg text-sm transition cursor-pointer"
            >
              {iniciandoSesion ? 'Autenticando...' : 'Ingresar al Sistema →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Parámetros del Gráfico de Anillo (Donut SVG)
  const radioDonut = 62;
  const circunferenciaDonut = 2 * Math.PI * radioDonut;
  const maxCasosCategoria = Math.max(...estadisticasCategorias.map((c) => c.total), 1);

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-800 font-sans">
      {/* BARRA SUPERIOR */}
      <nav className="bg-stone-900 text-stone-100 border-b border-stone-800 px-6 md:px-10 py-4 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-8 bg-amber-500 rounded-xs" />
            <div>
              <span className="text-[11px] uppercase tracking-widest text-amber-400 font-semibold block">
                Almonacid Law Firm
              </span>
              <span className="text-lg font-bold tracking-tight text-white">ONE LAW • GESTIÓN PROCESAL</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-stone-800 p-1 rounded-lg">
            <button
              onClick={() => setVistaActiva('cartera')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                vistaActiva === 'cartera' ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:text-white'
              }`}
            >
              Procesos ({metricas.activos} Activos)
            </button>
            <button
              onClick={() => setVistaActiva('agenda')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                vistaActiva === 'agenda' ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:text-white'
              }`}
            >
              Agenda y Plazos ({metricas.tareasPendientes})
            </button>
            <button
              onClick={() => setVistaActiva('directorio')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                vistaActiva === 'directorio' ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:text-white'
              }`}
            >
              Directorio Juzgados ({directorio.length})
            </button>
            {perfilActual.rol === 'Administradora' && (
              <button
                onClick={() => setVistaActiva('equipo')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  vistaActiva === 'equipo' ? 'bg-amber-500 text-stone-950' : 'text-stone-300 hover:text-white'
                }`}
              >
                Equipo ({listaColaboradoras.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {alertasCriticas.length > 0 && (
              <button
                onClick={() => setRadarExpandido(!radarExpandido)}
                className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>🚨 {alertasCriticas.length} Urgencias</span>
              </button>
            )}

            <button
              onClick={() => {
                setNuevoNombres('');
                setNuevoNumExp('');
                setNuevoJuzgado('');
                setNuevaMateria('');
                setNuevaEtapa('');
                setNuevaTareaDesc('');
                setNuevaTareaFecha('');
                setNuevoEspecialista('');
                setNuevoTelefonoAnexo('');
                setArchivoInicialNuevoCaso(null);
                setMensajeIA(null);
                setErrorFormulario(null);
                setModalAbierto(true);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-3.5 py-2 rounded-lg text-xs transition cursor-pointer"
            >
              + Nuevo Caso
            </button>

            <button
              onClick={cerrarSesion}
              className="border border-stone-700 hover:border-stone-500 text-stone-300 hover:text-white text-xs px-3 py-2 rounded-lg cursor-pointer"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        {/* =================================================================
            RADAR DE ALERTAS CRÍTICAS (AUDIENCIAS Y PLAZOS DE 2-3 DÍAS)
           ================================================================= */}
        {alertasCriticas.length > 0 && (
          <div className="bg-stone-900 text-white border-2 border-amber-500 rounded-2xl p-5 mb-8 shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                <span className="bg-red-600 text-white text-xs font-extrabold uppercase px-3 py-1 rounded-full">
                  Atención Prioritaria
                </span>
                <div>
                  <h2 className="text-base font-bold text-amber-400">
                    Radar de Audiencias y Plazos Fatales ({alertasCriticas.length})
                  </h2>
                  <p className="text-xs text-stone-300">
                    Control preventivo contra vencimiento de subsanaciones (2-3 días) y audiencias programadas.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRadarExpandido(!radarExpandido)}
                className="text-xs font-semibold text-amber-400 hover:underline cursor-pointer"
              >
                {radarExpandido ? 'Minimizar Radar ▲' : 'Desplegar Lista ▼'}
              </button>
            </div>

            {radarExpandido && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 pt-4 border-t border-stone-800 max-h-72 overflow-y-auto pr-1">
                {alertasCriticas.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => abrirFicha(item.expediente)}
                    className="bg-stone-800/90 hover:bg-stone-800 border border-stone-700 hover:border-amber-500 rounded-xl p-3.5 flex flex-col justify-between cursor-pointer transition"
                  >
                    <div>
                      <div className="flex justify-between items-center gap-2 mb-2">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${item.infoUrgencia.colorBadge}`}>
                          {item.infoUrgencia.etiqueta}
                        </span>
                        <span className="text-[11px] font-mono text-amber-400 font-semibold">{item.tipo}</span>
                      </div>
                      <p className="text-xs font-bold text-white line-clamp-2 mb-1">{item.descripcion}</p>
                      <p className="text-[11px] text-stone-300 truncate">👤 {item.expediente.nombres}</p>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-stone-700/70 text-[11px] text-stone-400">
                      <span className="font-mono truncate max-w-[160px]">
                        {item.expediente.numero_expediente || item.expediente.juzgado}
                      </span>
                      <span className="text-amber-400 font-semibold">Atender →</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =================================================================
            DASHBOARD GRÁFICO VISUAL (ANILLO SVG + COLUMNAS + SUB-MATERIAS)
           ================================================================= */}
        {vistaActiva === 'cartera' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 mb-8 shadow-xs">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-stone-200 gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-amber-700 block">
                  Dashboard Estadístico e Interactivo
                </span>
                <h3 className="text-lg font-bold text-stone-900 mt-0.5">
                  Gráficos de Cartera por Especialidad y Sub-Materias
                </h3>
                <p className="text-xs text-stone-500">
                  Haz clic en cualquier segmento del anillo, columna o barra horizontal para filtrar tus expedientes.
                </p>
              </div>
              {(filtroCategoria !== 'Todas' || subMateriaSeleccionada) && (
                <button
                  onClick={() => {
                    setFiltroCategoria('Todas');
                    setSubMateriaSeleccionada(null);
                  }}
                  className="bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer transition"
                >
                  ✕ Quitar Filtro Gráfico ({filtroCategoria}
                  {subMateriaSeleccionada ? ` • ${subMateriaSeleccionada}` : ''})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* GRÁFICO 1: ANILLO VECTORIAL (DONUT CHART SVG) - 4 COLUMNAS */}
              <div className="lg:col-span-4 bg-stone-50/70 border border-stone-200 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    1. Proporción por Rama Jurídica
                  </h4>
                  <p className="text-[11px] text-stone-500 mb-4">
                    Distribución porcentual sobre {metricas.total} procesos
                  </p>
                </div>

                <div className="flex flex-col items-center justify-center my-2">
                  <div className="relative w-44 h-44 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                      <circle
                        cx="80"
                        cy="80"
                        r={radioDonut}
                        fill="transparent"
                        stroke="#e7e5e4"
                        strokeWidth="22"
                      />
                      {estadisticasCategorias.map((cat) => {
                        const longitudArco = cat.fraccion * circunferenciaDonut;
                        const desplazamiento = -cat.offsetInicio * circunferenciaDonut;
                        const activa =
                          filtroCategoria === 'Todas' || filtroCategoria === cat.nombre;

                        return (
                          <circle
                            key={cat.nombre}
                            cx="80"
                            cy="80"
                            r={radioDonut}
                            fill="transparent"
                            stroke={cat.color.hex}
                            strokeWidth={filtroCategoria === cat.nombre ? '26' : '22'}
                            strokeDasharray={`${longitudArco} ${circunferenciaDonut}`}
                            strokeDashoffset={desplazamiento}
                            onClick={() => {
                              setFiltroCategoria(
                                filtroCategoria === cat.nombre ? 'Todas' : cat.nombre
                              );
                              setSubMateriaSeleccionada(null);
                            }}
                            className="cursor-pointer transition-all duration-300"
                            style={{ opacity: activa ? 1 : 0.25 }}
                          >
                            <title>{`${cat.nombre}: ${cat.total} casos (${cat.porcentajeExacto}%)`}</title>
                          </circle>
                        );
                      })}
                    </svg>
                    {/* Texto central del Donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                      <span className="text-2xl font-extrabold text-stone-900 leading-none">
                        {filtroCategoria === 'Todas'
                          ? metricas.activos
                          : estadisticasCategorias.find((c) => c.nombre === filtroCategoria)
                              ?.activos || 0}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-emerald-700 mt-1">
                        Activos
                      </span>
                      <span className="text-[10px] text-stone-400 truncate max-w-[95px]">
                        {filtroCategoria === 'Todas' ? 'En todo el estudio' : filtroCategoria}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Leyenda interactiva del Donut */}
                <div className="space-y-1.5 mt-4 pt-3 border-t border-stone-200/80">
                  {estadisticasCategorias.map((cat) => {
                    const seleccionada = filtroCategoria === cat.nombre;
                    return (
                      <div
                        key={cat.nombre}
                        onClick={() => {
                          setFiltroCategoria(seleccionada ? 'Todas' : cat.nombre);
                          setSubMateriaSeleccionada(null);
                        }}
                        className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg cursor-pointer transition ${
                          seleccionada
                            ? 'bg-stone-900 text-white font-bold'
                            : 'hover:bg-stone-200/60 text-stone-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className="w-3 h-3 rounded-xs shrink-0"
                            style={{ backgroundColor: cat.color.hex }}
                          />
                          <span className="truncate">{cat.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                          <span className={seleccionada ? 'text-amber-400' : 'font-bold'}>
                            {cat.total}
                          </span>
                          <span className={seleccionada ? 'text-stone-300' : 'text-stone-400'}>
                            ({cat.porcentajeExacto}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* GRÁFICO 2: COLUMNAS COMPARATIVAS (ACTIVOS VS CONCLUIDOS) - 4 COLUMNAS */}
              <div className="lg:col-span-4 bg-stone-50/70 border border-stone-200 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    2. Procesos Avanzados: Activos vs. Concluidos
                  </h4>
                  <p className="text-[11px] text-stone-500 mb-4">
                    Comparativa visual de carga en trámite frente a casos cerrados
                  </p>
                </div>

                {/* Área del Gráfico de Columnas Verticales */}
                <div className="h-52 flex items-end justify-around gap-2 pt-6 pb-2 px-2 border-b border-stone-300">
                  {estadisticasCategorias.map((cat) => {
                    const alturaActivos = Math.round((cat.activos / maxCasosCategoria) * 140);
                    const alturaConcluidos = Math.round((cat.concluidos / maxCasosCategoria) * 140);
                    const seleccionada = filtroCategoria === cat.nombre;

                    return (
                      <div
                        key={cat.nombre}
                        onClick={() => {
                          setFiltroCategoria(seleccionada ? 'Todas' : cat.nombre);
                          setSubMateriaSeleccionada(null);
                        }}
                        className={`flex flex-col items-center group cursor-pointer transition-opacity ${
                          filtroCategoria !== 'Todas' && !seleccionada ? 'opacity-35' : 'opacity-100'
                        }`}
                      >
                        <div className="flex items-end gap-1.5 h-36">
                          {/* Columna Activos */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-mono font-bold text-emerald-800 mb-1">
                              {cat.activos}
                            </span>
                            <div
                              className="w-4 sm:w-5 bg-emerald-600 rounded-t-md transition-all duration-500 group-hover:brightness-110"
                              style={{ height: `${Math.max(alturaActivos, 4)}px` }}
                              title={`${cat.nombre} - Activos: ${cat.activos}`}
                            />
                          </div>

                          {/* Columna Concluidos */}
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] font-mono font-semibold text-stone-500 mb-1">
                              {cat.concluidos}
                            </span>
                            <div
                              className="w-4 sm:w-5 bg-stone-400 rounded-t-md transition-all duration-500"
                              style={{ height: `${Math.max(alturaConcluidos, 4)}px` }}
                              title={`${cat.nombre} - Concluidos: ${cat.concluidos}`}
                            />
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold mt-2 text-center max-w-[64px] truncate ${
                            seleccionada ? 'text-amber-800 underline' : 'text-stone-600'
                          }`}
                        >
                          {cat.nombre.split(' ')[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Leyenda de Columnas y Resumen de Avance */}
                <div className="mt-4 pt-2 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-center gap-5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-emerald-600 inline-block" />
                      <span className="font-semibold text-stone-700">
                        Activos ({metricas.activos})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-stone-400 inline-block" />
                      <span className="font-semibold text-stone-600">
                        Concluidos ({metricas.concluidos})
                      </span>
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-lg p-2.5 text-center text-[11px] text-stone-600">
                    Tasa global de procesos concluidos:{' '}
                    <strong className="text-stone-900">
                      {metricas.total > 0
                        ? Math.round((metricas.concluidos / metricas.total) * 100)
                        : 0}
                      %
                    </strong>{' '}
                    de la cartera histórica
                  </div>
                </div>
              </div>

              {/* GRÁFICO 3: BARRAS HORIZONTALES POR SUB-MATERIAS ESPECÍFICAS - 4 COLUMNAS */}
              <div className="lg:col-span-4 bg-stone-50/70 border border-stone-200 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                      3. Ranking por Sub-Materia Específica
                    </h4>
                    <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded">
                      {filtroCategoria === 'Todas' ? 'Todas las ramas' : filtroCategoria}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mb-3">
                    Haz clic en una barra para filtrar esos procesos en la tabla:
                  </p>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 flex-1">
                  {desgloseSubMaterias.map((sub) => {
                    const esSeleccionada = subMateriaSeleccionada === sub.nombre;
                    return (
                      <div
                        key={sub.nombre}
                        onClick={() =>
                          setSubMateriaSeleccionada(esSeleccionada ? null : sub.nombre)
                        }
                        className={`p-2.5 rounded-lg border transition cursor-pointer ${
                          esSeleccionada
                            ? 'bg-stone-900 text-white border-stone-900 shadow-xs'
                            : 'bg-white hover:border-amber-400 border-stone-200/90 text-stone-800'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs mb-1">
                          <span className="font-bold truncate pr-2">{sub.nombre}</span>
                          <span
                            className={`font-mono text-[11px] font-bold shrink-0 ${
                              esSeleccionada ? 'text-amber-400' : 'text-stone-700'
                            }`}
                          >
                            {sub.activos} act. / {sub.total} tot.
                          </span>
                        </div>

                        {/* Barra horizontal proporcional */}
                        <div className="w-full h-2.5 bg-stone-200 rounded-full overflow-hidden flex">
                          <div
                            className="h-full transition-all duration-500"
                            style={{
                              width: `${sub.porcentajeBarra}%`,
                              backgroundColor: sub.color.hex,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 pt-2 border-t border-stone-200/80 text-[11px] text-stone-500 text-center">
                  Mostrando {desgloseSubMaterias.length} tipologías específicas en base de datos
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================
            VISTA 1: TABLA DE CARTERA (POR DEFECTO EN 'ACTIVOS')
           ================================================================= */}
        {vistaActiva === 'cartera' && (
          <>
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="w-full md:w-96 relative">
                <input
                  type="text"
                  placeholder="Buscar patrocinado, expediente, juzgado o materia..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded-lg px-4 py-2 text-sm text-stone-800 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-stone-500 mr-1">Mostrar procesos:</span>
                {(['Activo', 'Concluido', 'Todos'] as const).map((estado) => (
                  <button
                    key={estado}
                    onClick={() => setFiltroEstado(estado)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filtroEstado === estado
                        ? 'bg-stone-900 text-amber-400'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {estado === 'Activo'
                      ? `Activos (${metricas.activos})`
                      : estado === 'Concluido'
                      ? `Concluidos (${metricas.concluidos})`
                      : `Todos (${metricas.total})`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 border-b border-stone-200 uppercase text-xs">
                      <th className="p-4 font-semibold">Estado & Especialidad</th>
                      <th className="p-4 font-semibold">Patrocinado / Partes</th>
                      <th className="p-4 font-semibold">Expediente & Juzgado</th>
                      <th className="p-4 font-semibold">Materia & Etapa Actual</th>
                      <th className="p-4 font-semibold">Próxima Actuación / Plazo</th>
                      <th className="p-4 font-semibold text-right">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {expedientesFiltrados.map((exp) => {
                      const tareasPend = exp.tareas?.filter((t) => t.estado === 'Pendiente') || [];
                      const primeraTarea = tareasPend[0];
                      const urgencia = primeraTarea ? evaluarUrgenciaTarea(primeraTarea) : null;
                      const rama = clasificarMateria(exp.materia);
                      const estiloRama = COLORES_CATEGORIA[rama];

                      return (
                        <tr
                          key={exp.id}
                          onClick={() => abrirFicha(exp)}
                          className="hover:bg-amber-50/40 transition-colors align-top cursor-pointer"
                        >
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold inline-block ${
                                exp.estado_administrativo === 'Activo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-200 text-stone-700'
                              }`}
                            >
                              {exp.estado_administrativo}
                            </span>
                            <div className="mt-1.5">
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${estiloRama.bgBadge} ${estiloRama.textBadge}`}
                              >
                                {rama}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 font-medium text-stone-900 max-w-xs">
                            <div>{exp.nombres}</div>
                            <div className="text-[11px] text-stone-400 mt-0.5">
                              Asignado: {exp.abogada_asignada || 'Todo el Estudio'}
                            </div>
                            {exp.observaciones_migracion && (
                              <div className="mt-1 inline-block text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                                ⚠️ {exp.observaciones_migracion}
                              </div>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="font-mono font-semibold text-amber-900 text-xs">
                              {exp.numero_expediente || 'S/N'}
                            </div>
                            <div className="text-xs text-stone-500 mt-1 font-medium">{exp.juzgado}</div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="font-semibold text-stone-800 text-xs uppercase">{exp.materia}</div>
                            <div className="text-xs text-stone-600 mt-1 line-clamp-2">{exp.etapa_procesal}</div>
                          </td>
                          <td className="p-4 max-w-sm">
                            {primeraTarea && urgencia ? (
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${urgencia.colorBadge}`}>
                                    {urgencia.etiqueta}
                                  </span>
                                  <span className="text-[11px] font-semibold text-stone-600">
                                    • {primeraTarea.tipo}
                                  </span>
                                </div>
                                <p className="text-xs text-stone-800 font-medium line-clamp-2">
                                  {primeraTarea.descripcion}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-stone-400 italic">Al día / Sin pendientes</span>
                            )}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                abrirFicha(exp);
                              }}
                              className="text-xs font-semibold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition"
                            >
                              Abrir →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* VISTA 2: AGENDA */}
        {vistaActiva === 'agenda' && (
          <div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs mb-6 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-stone-900">Agenda General de Plazos y Audiencias</h2>
                <p className="text-xs text-stone-500">Ordenados automáticamente por urgencia de vencimiento.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Todas', 'Audiencia', 'Plazo por verificar', 'Plazo procesal', 'Seguimiento interno'].map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setFiltroTipoTarea(tipo)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filtroTipoTarea === tipo ? 'bg-stone-900 text-amber-400' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {tipo}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {todasLasTareas.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition ${
                    t.estado === 'Completado'
                      ? 'border-stone-200 opacity-60'
                      : t.infoUrgencia.nivel === 'critico' || t.infoUrgencia.nivel === 'vencido'
                      ? 'border-red-400 bg-red-50/20'
                      : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <input
                      type="checkbox"
                      checked={t.estado === 'Completado'}
                      onChange={() => cambiarEstadoTarea(t)}
                      className="mt-1 w-4 h-4 cursor-pointer accent-stone-900"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${t.infoUrgencia.colorBadge}`}>
                          {t.infoUrgencia.etiqueta}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-stone-100 text-stone-700">
                          {t.tipo}
                        </span>
                        {t.fecha_programada && (
                          <span className="text-xs font-mono font-semibold text-stone-700">
                            📅 Límite: {t.fecha_programada}
                          </span>
                        )}
                        <span className="text-xs font-mono text-amber-800 font-semibold">
                          {t.expediente.numero_expediente || 'S/N'}
                        </span>
                      </div>

                      <p className={`text-sm font-medium ${t.estado === 'Completado' ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                        {t.descripcion}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        Patrocinado: <strong className="text-stone-700">{t.expediente.nombres}</strong> • {t.expediente.juzgado} ({t.expediente.materia})
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => abrirFicha(t.expediente)}
                    className="text-xs font-semibold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Abrir Expediente →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 3: DIRECTORIO */}
        {vistaActiva === 'directorio' && (
          <div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <input
                type="text"
                placeholder="Buscar por juzgado, nombre de especialista o anexo..."
                value={busquedaDirectorio}
                onChange={(e) => setBusquedaDirectorio(e.target.value)}
                className="w-full md:w-96 bg-stone-50 border border-stone-300 rounded-lg px-4 py-2 text-sm text-stone-800 focus:outline-none focus:border-amber-600"
              />
              <button
                onClick={() => {
                  setErrorDirectorio(null);
                  setModalDirAbierto(true);
                }}
                className="bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer"
              >
                + Agregar Especialista / Anexo
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directorioFiltrado.map((item) => (
                <div key={item.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 inline-block mb-2">
                      {item.juzgado}
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">Especialista: {item.especialista || 'No especificado'}</h3>
                    <p className="text-xs text-stone-600 mt-2 font-mono bg-stone-50 p-2.5 rounded border border-stone-200">
                      📞 {item.notas || 'Sin datos de anexo'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VISTA 4: EQUIPO */}
        {vistaActiva === 'equipo' && perfilActual.rol === 'Administradora' && (
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-stone-900 mb-1">Control de Acceso y Roles del Estudio</h2>
            <p className="text-xs text-stone-500 mb-6">Gestiona qué usuarias tienen rango de Administradora o Abogada Colaboradora.</p>

            <div className="space-y-3">
              {listaColaboradoras.map((u) => (
                <div key={u.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-stone-50 border border-stone-200 gap-4">
                  <div>
                    <span className="font-bold text-sm text-stone-900 block">{u.nombre_completo}</span>
                    <span className="text-xs text-stone-500">{u.email}</span>
                  </div>
                  <select
                    value={u.rol}
                    onChange={(e) => cambiarRolMiembro(u.id, e.target.value as 'Administradora' | 'Abogada Colaboradora')}
                    className="border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white"
                  >
                    <option value="Administradora">Administradora (Acceso Total)</option>
                    <option value="Abogada Colaboradora">Abogada Colaboradora</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FICHA TÉCNICA LATERAL */}
      {expSeleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-[#FAF9F6] w-full max-w-2xl h-full shadow-2xl border-l border-stone-200 flex flex-col overflow-hidden">
            <div className="bg-stone-900 text-white p-6 flex justify-between items-start">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-amber-400 font-semibold">
                  Ficha • {clasificarMateria(expSeleccionado.materia)} ({obtenerSubMateria(expSeleccionado.materia)})
                </span>
                <h2 className="text-lg font-bold mt-1">{expSeleccionado.nombres}</h2>
                <p className="text-xs font-mono text-stone-300 mt-1">
                  Exp: {expSeleccionado.numero_expediente || 'SIN NÚMERO'} • {expSeleccionado.juzgado}
                </p>
              </div>
              <button
                onClick={() => setExpSeleccionado(null)}
                className="text-stone-400 hover:text-white text-xl font-bold px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {expSeleccionado.observaciones_migracion && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex justify-between items-center gap-4">
                  <div className="text-xs text-amber-900">
                    <strong className="block font-bold mb-0.5">⚠️ Observación de migración:</strong>
                    {expSeleccionado.observaciones_migracion}
                  </div>
                  {perfilActual.rol === 'Administradora' && (
                    <button
                      onClick={() => marcarAlertaComoVerificada(expSeleccionado.id)}
                      className="bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer"
                    >
                      Validar ✓
                    </button>
                  )}
                </div>
              )}

              {/* SECCIÓN 1: ESTADO Y ETAPA */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
                    1. Estado Administrativo, Etapa y Responsable
                  </h3>
                  {!editandoFicha ? (
                    <button
                      onClick={() => setEditandoFicha(true)}
                      className="text-xs font-semibold text-amber-800 hover:underline cursor-pointer"
                    >
                      ✏️ Actualizar Datos
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditandoFicha(false)} className="text-xs text-stone-500 px-2 py-1">Cancelar</button>
                      <button
                        onClick={guardarCambiosFicha}
                        disabled={guardandoFicha}
                        className="bg-stone-900 text-amber-400 text-xs font-semibold px-3 py-1 rounded-md cursor-pointer"
                      >
                        {guardandoFicha ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  )}
                </div>

                {!editandoFicha ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-stone-400 block">Estado Administrativo</span>
                      <span className="font-bold text-stone-900">{expSeleccionado.estado_administrativo}</span>
                    </div>
                    <div>
                      <span className="text-xs text-stone-400 block">Juzgado</span>
                      <span className="font-semibold text-stone-800">{expSeleccionado.juzgado}</span>
                    </div>
                    <div>
                      <span className="text-xs text-stone-400 block">Responsable</span>
                      <span className="font-semibold text-amber-800">{expSeleccionado.abogada_asignada || 'Todo el Estudio'}</span>
                    </div>
                    <div className="md:col-span-3">
                      <span className="text-xs text-stone-400 block">Etapa Procesal</span>
                      <p className="font-medium text-stone-800 bg-stone-50 p-3 rounded-lg border border-stone-200 mt-1 text-xs">
                        {expSeleccionado.etapa_procesal}
                      </p>
                    </div>
                    {expSeleccionado.resultado && (
                      <div className="md:col-span-3">
                        <span className="text-xs text-stone-400 block">Resultado / Sentencia</span>
                        <p className="font-semibold text-emerald-900 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200 mt-1 text-xs">
                          {expSeleccionado.resultado}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="font-semibold text-stone-600 block mb-1">Estado</label>
                        <select
                          value={fichaEstadoAdmin}
                          onChange={(e) => setFichaEstadoAdmin(e.target.value as 'Activo' | 'Concluido')}
                          className="w-full border border-stone-300 rounded-lg p-2 bg-white"
                        >
                          <option value="Activo">Activo</option>
                          <option value="Concluido">Concluido</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-semibold text-stone-600 block mb-1">Juzgado</label>
                        <input
                          type="text"
                          value={fichaJuzgado}
                          onChange={(e) => setFichaJuzgado(e.target.value)}
                          className="w-full border border-stone-300 rounded-lg p-2 uppercase"
                        />
                      </div>
                      <div>
                        <label className="font-semibold text-stone-600 block mb-1">Asignar</label>
                        <select
                          value={fichaAsignada}
                          onChange={(e) => setFichaAsignada(e.target.value)}
                          disabled={perfilActual.rol !== 'Administradora'}
                          className="w-full border border-stone-300 rounded-lg p-2 bg-white disabled:opacity-60"
                        >
                          <option value="Todo el Estudio">Todo el Estudio</option>
                          {listaColaboradoras.map((col) => (
                            <option key={col.id} value={col.email}>
                              {col.nombre_completo}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-stone-600 block mb-1">Etapa Procesal</label>
                      <textarea
                        rows={2}
                        value={fichaEtapa}
                        onChange={(e) => setFichaEtapa(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg p-2 uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-stone-600 block mb-1">Resultado / Sentencia (Opcional)</label>
                      <input
                        type="text"
                        value={fichaResultado}
                        onChange={(e) => setFichaResultado(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg p-2 uppercase"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN 2: TAREAS CON PLAZOS RÁPIDOS (+2, +3, +5 días) */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">
                  2. Control de Actuaciones, Audiencias y Plazos ({expSeleccionado.tareas?.length || 0})
                </h3>

                <div className="space-y-2.5 mb-5">
                  {expSeleccionado.tareas && expSeleccionado.tareas.length > 0 ? (
                    expSeleccionado.tareas.map((tarea) => {
                      const urg = evaluarUrgenciaTarea(tarea);
                      return (
                        <div key={tarea.id} className="flex items-start gap-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
                          <input
                            type="checkbox"
                            checked={tarea.estado === 'Completado'}
                            onChange={() => cambiarEstadoTarea(tarea)}
                            className="mt-1 cursor-pointer accent-stone-900"
                          />
                          <div className="flex-1 text-xs">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${urg.colorBadge}`}>
                                {urg.etiqueta}
                              </span>
                              <span className="font-bold text-stone-700 bg-stone-200 px-2 py-0.5 rounded">{tarea.tipo}</span>
                              {tarea.fecha_programada && (
                                <span className="font-mono text-stone-600">📅 Vence: {tarea.fecha_programada}</span>
                              )}
                            </div>
                            <p className={tarea.estado === 'Completado' ? 'line-through text-stone-400' : 'text-stone-800 font-medium'}>
                              {tarea.descripcion}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-stone-400 italic">No hay actuaciones registradas.</p>
                  )}
                </div>

                <form onSubmit={agregarTareaEnFicha} className="border-t border-stone-200 pt-4 space-y-3 text-xs">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <span className="font-bold text-stone-700">+ Programar Plazo Fatal o Audiencia</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-stone-500">Vencimiento rápido:</span>
                      {[2, 3, 5].map((dias) => (
                        <button
                          key={dias}
                          type="button"
                          onClick={() => {
                            setFichaNuevaTareaTipo('Plazo procesal');
                            setFichaNuevaTareaFecha(calcularFechaDiasHabiles(dias));
                          }}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-2 py-1 rounded text-[11px] cursor-pointer"
                        >
                          +{dias} días háb.
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Descripción (Ej. SUBSANAR DEMANDA BAJO APERCIBIMIENTO)"
                    value={fichaNuevaTareaDesc}
                    onChange={(e) => setFichaNuevaTareaDesc(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg p-2.5 uppercase"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={fichaNuevaTareaTipo}
                      onChange={(e) => setFichaNuevaTareaTipo(e.target.value)}
                      className="border border-stone-300 rounded-lg p-2 bg-white"
                    >
                      <option value="Plazo procesal">Plazo procesal (Fatal)</option>
                      <option value="Audiencia">Audiencia</option>
                      <option value="Seguimiento interno">Seguimiento interno</option>
                    </select>
                    <input
                      type="date"
                      value={fichaNuevaTareaFecha}
                      onChange={(e) => setFichaNuevaTareaFecha(e.target.value)}
                      className="border border-stone-300 rounded-lg p-2"
                    />
                    <button
                      type="submit"
                      className="bg-stone-900 hover:bg-stone-800 text-amber-400 font-semibold rounded-lg px-4 py-2 cursor-pointer"
                    >
                      Guardar Alerta
                    </button>
                  </div>
                </form>
              </div>

              {/* SECCIÓN 3: REPOSITORIO DE ANEXOS CON ELIMINACIÓN SEGURA */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">
                  3. Anexos Judiciales y Resoluciones ({expSeleccionado.documentos_expediente?.length || 0})
                </h3>

                <div className="space-y-2 mb-4">
                  {expSeleccionado.documentos_expediente && expSeleccionado.documentos_expediente.length > 0 ? (
                    expSeleccionado.documentos_expediente.map((doc) => (
                      <div key={doc.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-amber-900 block truncate">📄 {doc.nombre_archivo}</span>
                          <span className="text-[11px] text-stone-500">{doc.tipo_documento}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={doc.url_archivo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-semibold px-3 py-1.5 rounded-lg transition"
                          >
                            Ver / Descargar ↗
                          </a>
                          <button
                            type="button"
                            onClick={() => eliminarDocumentoSubido(doc)}
                            disabled={eliminandoDocId === doc.id}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            {eliminandoDocId === doc.id ? 'Borrando...' : '🗑️ Eliminar'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400 italic">Sin documentos adjuntos.</p>
                  )}
                </div>

                <div className="border-t border-stone-200 pt-4 text-xs">
                  <label className="font-bold text-stone-700 block mb-2">Subir PDF o Resolución CEJ</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={tipoDocSubida}
                      onChange={(e) => setTipoDocSubida(e.target.value)}
                      className="border border-stone-300 rounded-lg p-2 bg-white"
                    >
                      <option value="Resolución / Cédula CEJ">Resolución / Cédula CEJ</option>
                      <option value="Escrito Presentado / Cargo">Escrito Presentado / Cargo</option>
                      <option value="Acta de Audiencia / Conciliación">Acta de Audiencia / Conciliación</option>
                      <option value="Depósito Judicial / Liquidación">Depósito Judicial / Liquidación</option>
                    </select>
                    <label className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold rounded-lg p-2 text-center cursor-pointer">
                      {subiendoArchivo ? 'Subiendo...' : 'Seleccionar Archivo (PDF / Imagen)'}
                      <input type="file" accept=".pdf,image/*" onChange={manejarSubidaArchivo} disabled={subiendoArchivo} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DIRECTORIO */}
      {modalDirAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900 mb-4">Registrar Especialista en Directorio</h3>
            {errorDirectorio && <div className="bg-red-50 border border-red-200 text-red-900 text-xs p-3 rounded-lg mb-4">{errorDirectorio}</div>}
            <form onSubmit={guardarContactoDirectorio} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">Juzgado *</label>
                <input type="text" required value={dirJuzgado} onChange={(e) => setDirJuzgado(e.target.value)} className="w-full border border-stone-300 rounded-lg p-2.5 uppercase" />
              </div>
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">Especialista *</label>
                <input type="text" required value={dirEspecialista} onChange={(e) => setDirEspecialista(e.target.value)} className="w-full border border-stone-300 rounded-lg p-2.5 uppercase" />
              </div>
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">Teléfono / Anexo *</label>
                <input type="text" required value={dirNotas} onChange={(e) => setDirNotas(e.target.value)} className="w-full border border-stone-300 rounded-lg p-2.5 uppercase" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalDirAbierto(false)} className="px-4 py-2 rounded-lg border text-stone-600">Cancelar</button>
                <button type="submit" className="bg-stone-900 text-amber-400 font-semibold px-4 py-2 rounded-lg cursor-pointer">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EXPEDIENTE CON ESCANEO IA */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-stone-200 pb-4 mb-5">
              <div>
                <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">Registro Inteligente</span>
                <h2 className="text-xl font-bold text-stone-900">Ingresar Nuevo Expediente</h2>
              </div>
              <button onClick={() => setModalAbierto(false)} className="text-stone-400 hover:text-stone-700 text-lg font-bold px-2 cursor-pointer">✕</button>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 mb-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-xs font-bold uppercase text-amber-900 block">✨ Autocompletar subiendo Resolución o Cédula (Opcional)</span>
                  <p className="text-xs text-stone-600 mt-0.5">Extrae patrocinado, expediente, juzgado y plazos automáticamente.</p>
                </div>
                <label className="bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-semibold px-4 py-2.5 rounded-lg cursor-pointer whitespace-nowrap shadow-xs transition">
                  {analizandoDocumentoIA ? 'Escaneando...' : '📄 Subir PDF / Imagen'}
                  <input type="file" accept=".pdf,image/*" onChange={escanearDocumentoNuevoCaso} disabled={analizandoDocumentoIA} className="hidden" />
                </label>
              </div>
              {mensajeIA && <div className="mt-3 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">{mensajeIA}</div>}
            </div>

            {errorFormulario && <div className="bg-red-50 border border-red-200 text-red-900 text-xs p-3.5 rounded-lg mb-5">{errorFormulario}</div>}

            <form onSubmit={guardarNuevoExpediente} className="space-y-5 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Patrocinado / Partes *</label>
                  <input type="text" required value={nuevoNombres} onChange={(e) => setNuevoNombres(e.target.value)} placeholder="Ej. PEREZ GOMEZ JUAN" className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">N° de Expediente</label>
                  <input type="text" value={nuevoNumExp} onChange={(e) => setNuevoNumExp(e.target.value)} placeholder="Ej. 01234-2026-0-1501-JP-FC-01" className={`w-full border rounded-lg px-3.5 py-2 font-mono uppercase ${expedienteDuplicado ? 'border-red-500 bg-red-50 text-red-900' : 'border-stone-300'}`} />
                  {expedienteDuplicado && <p className="text-xs text-red-700 font-semibold mt-1">⚠️ Duplicado: Pertenece a {expedienteDuplicado.nombres}.</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Responsable</label>
                  <select value={nuevaAsignada} onChange={(e) => setNuevaAsignada(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3.5 py-2 bg-white">
                    <option value="Todo el Estudio">Todo el Estudio</option>
                    {listaColaboradoras.map((col) => (
                      <option key={col.id} value={col.email}>{col.nombre_completo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Juzgado *</label>
                  <input type="text" required value={nuevoJuzgado} onChange={(e) => setNuevoJuzgado(e.target.value)} placeholder="Ej. 1° JPL EL TAMBO" className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Materia *</label>
                  <input type="text" required value={nuevaMateria} onChange={(e) => setNuevaMateria(e.target.value)} placeholder="Ej. ALIMENTOS / OAF" className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Etapa Inicial</label>
                  <input type="text" value={nuevaEtapa} onChange={(e) => setNuevaEtapa(e.target.value)} placeholder="Ej. DEMANDA ADMITIDA" className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase" />
                </div>
              </div>

              <div className="border-t border-stone-200 pt-4">
                <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                  <span className="text-xs font-bold uppercase text-amber-800">Primera Actuación o Plazo</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-stone-500">Plazo rápido:</span>
                    {[2, 3, 5].map((d) => (
                      <button key={d} type="button" onClick={() => { setNuevaTareaTipo('Plazo procesal'); setNuevaTareaFecha(calcularFechaDiasHabiles(d)); }} className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded text-xs cursor-pointer">
                        +{d} días háb.
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <input type="text" placeholder="Descripción de la actuación" value={nuevaTareaDesc} onChange={(e) => setNuevaTareaDesc(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase" />
                  </div>
                  <select value={nuevaTareaTipo} onChange={(e) => setNuevaTareaTipo(e.target.value)} className="border border-stone-300 rounded-lg px-3.5 py-2 bg-white">
                    <option value="Plazo procesal">Plazo procesal (Fatal)</option>
                    <option value="Audiencia">Audiencia</option>
                    <option value="Seguimiento interno">Seguimiento interno</option>
                  </select>
                  <input type="date" value={nuevaTareaFecha} onChange={(e) => setNuevaTareaFecha(e.target.value)} className="border border-stone-300 rounded-lg px-3.5 py-2" />
                </div>
              </div>

              <div className="border-t border-stone-200 pt-5 flex justify-end gap-3">
                <button type="button" onClick={() => setModalAbierto(false)} className="px-4 py-2 rounded-lg border text-stone-700">Cancelar</button>
                <button type="submit" disabled={guardandoNuevo || !!expedienteDuplicado || analizandoDocumentoIA} className="bg-stone-900 text-amber-400 font-semibold px-6 py-2 rounded-lg cursor-pointer">
                  {guardandoNuevo ? 'Guardando...' : 'Guardar Expediente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}