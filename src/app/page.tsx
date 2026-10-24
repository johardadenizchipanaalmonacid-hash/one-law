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

export default function OneLawApp() {
  // Estados de Autenticación y Perfil
  const [sesionVerificada, setSesionVerificada] = useState(false);
  const [perfilActual, setPerfilActual] = useState<PerfilUsuario | null>(null);
  const [listaColaboradoras, setListaColaboradoras] = useState<PerfilUsuario[]>([]);

  // Estados del Formulario de Login
  const [emailLogin, setEmailLogin] = useState('');
  const [passwordLogin, setPasswordLogin] = useState('');
  const [errorLogin, setErrorLogin] = useState<string | null>(null);
  const [iniciandoSesion, setIniciandoSesion] = useState(false);

  // Navegación principal
  const [vistaActiva, setVistaActiva] = useState<'cartera' | 'agenda' | 'directorio' | 'equipo'>('cartera');

  // Datos principales
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [directorio, setDirectorio] = useState<ContactoDirectorio[]>([]);
  const [cargando, setCargando] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Activo' | 'Concluido'>('Todos');
  const [filtroTipoTarea, setFiltroTipoTarea] = useState<string>('Todas');
  const [busquedaDirectorio, setBusquedaDirectorio] = useState('');

  // Ficha Lateral
  const [expSeleccionado, setExpSeleccionado] = useState<Expediente | null>(null);
  const [editandoFicha, setEditandoFicha] = useState(false);
  const [guardandoFicha, setGuardandoFicha] = useState(false);

  const [fichaEstadoAdmin, setFichaEstadoAdmin] = useState<'Activo' | 'Concluido'>('Activo');
  const [fichaEtapa, setFichaEtapa] = useState('');
  const [fichaJuzgado, setFichaJuzgado] = useState('');
  const [fichaResultado, setFichaResultado] = useState('');
  const [fichaAsignada, setFichaAsignada] = useState('Todo el Estudio');

  // Nueva tarea en Ficha
  const [fichaNuevaTareaDesc, setFichaNuevaTareaDesc] = useState('');
  const [fichaNuevaTareaTipo, setFichaNuevaTareaTipo] = useState('Seguimiento interno');
  const [fichaNuevaTareaFecha, setFichaNuevaTareaFecha] = useState('');

  // Subida de archivos
  const [subiendoArchivo, setSubiendoArchivo] = useState(false);
  const [tipoDocSubida, setTipoDocSubida] = useState('Resolución / Cédula CEJ');

  // Modal Nuevo Expediente
  const [modalAbierto, setModalAbierto] = useState(false);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [errorFormulario, setErrorFormulario] = useState<string | null>(null);

  const [nuevoNombres, setNuevoNombres] = useState('');
  const [nuevoNumExp, setNuevoNumExp] = useState('');
  const [nuevoJuzgado, setNuevoJuzgado] = useState('');
  const [nuevaMateria, setNuevaMateria] = useState('');
  const [nuevoEstadoAdmin, setNuevoEstadoAdmin] = useState<'Activo' | 'Concluido'>('Activo');
  const [nuevaEtapa, setNuevaEtapa] = useState('');
  const [nuevaAsignada, setNuevaAsignada] = useState('Todo el Estudio');
  const [nuevaTareaDesc, setNuevaTareaDesc] = useState('');
  const [nuevaTareaTipo, setNuevaTareaTipo] = useState('Seguimiento interno');
  const [nuevaTareaFecha, setNuevaTareaFecha] = useState('');

  // Modal Directorio
  const [modalDirAbierto, setModalDirAbierto] = useState(false);
  const [dirJuzgado, setDirJuzgado] = useState('');
  const [dirEspecialista, setDirEspecialista] = useState('');
  const [dirNotas, setDirNotas] = useState('');
  const [errorDirectorio, setErrorDirectorio] = useState<string | null>(null);

  // 1. Verificar sesión activa al cargar la app
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

  // 2. Obtener o crear perfil del usuario autenticado
  const cargarPerfilUsuario = async (userId: string, email: string) => {
    const { data: perfilExistente } = await supabase
      .from('perfiles_usuarios')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (perfilExistente) {
      setPerfilActual(perfilExistente);
    } else {
      // Si es el primer usuario registrado en la tabla, asignarle rol Administradora por defecto
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

  // 3. Cargar cartera una vez que el usuario está autenticado
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

  // Iniciar sesión con correo y contraseña
  const manejarLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLogin(null);
    setIniciandoSesion(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailLogin.trim(),
      password: passwordLogin,
    });

    if (error) {
      setErrorLogin('Credenciales incorrectas o usuario no autorizado en Supabase Auth.');
    }
    setIniciandoSesion(false);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setPerfilActual(null);
    setExpSeleccionado(null);
  };

  // Filtrar expedientes según el Rol del Usuario (Seguridad de Cartera)
  const expedientesAutorizados = useMemo(() => {
    if (!perfilActual) return [];
    if (perfilActual.rol === 'Administradora') return expedientes;

    // Las abogadas colaboradoras ven los casos de "Todo el Estudio" o asignados a su correo/nombre
    return expedientes.filter(
      (exp) =>
        !exp.abogada_asignada ||
        exp.abogada_asignada === 'Todo el Estudio' ||
        exp.abogada_asignada.toLowerCase() === perfilActual.email.toLowerCase() ||
        exp.abogada_asignada.toUpperCase() === perfilActual.nombre_completo.toUpperCase()
    );
  }, [expedientes, perfilActual]);

  // Normalizador para evitar duplicados
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
      const termino = busqueda.toLowerCase().trim();
      if (!termino) return cumpleEstado;

      const coincideTexto =
        exp.nombres?.toLowerCase().includes(termino) ||
        exp.numero_expediente?.toLowerCase().includes(termino) ||
        exp.juzgado?.toLowerCase().includes(termino) ||
        exp.materia?.toLowerCase().includes(termino) ||
        exp.etapa_procesal?.toLowerCase().includes(termino);

      return cumpleEstado && coincideTexto;
    });
  }, [expedientesAutorizados, busqueda, filtroEstado]);

  const todasLasTareas = useMemo(() => {
    const lista: (Tarea & { expediente: Expediente })[] = [];
    expedientesAutorizados.forEach((exp) => {
      exp.tareas?.forEach((t) => {
        lista.push({ ...t, expediente: exp });
      });
    });

    return lista
      .filter((t) => filtroTipoTarea === 'Todas' || t.tipo === filtroTipoTarea)
      .sort((a, b) => {
        if (a.estado !== b.estado) return a.estado === 'Pendiente' ? -1 : 1;
        if (a.fecha_programada && b.fecha_programada) {
          return a.fecha_programada.localeCompare(b.fecha_programada);
        }
        return a.fecha_programada ? -1 : 1;
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
    const tareasPendientes = expedientesAutorizados.reduce(
      (acc, exp) => acc + (exp.tareas?.filter((t) => t.estado === 'Pendiente').length || 0),
      0
    );
    const conAlertas = expedientesAutorizados.filter((e) => e.observaciones_migracion).length;
    return { total, activos, tareasPendientes, conAlertas };
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
      setErrorFormulario('Completa los campos obligatorios (Patrocinado, Juzgado y Materia).');
      return;
    }

    if (expedienteDuplicado) {
      setErrorFormulario(
        `Bloqueado: El expediente ${expLimpio} ya pertenece a ${expedienteDuplicado.nombres}.`
      );
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

      await cargarTodo();
      setModalAbierto(false);
    } catch (err: any) {
      setErrorFormulario(err.message || 'Error al guardar el expediente.');
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
      setErrorDirectorio('Este especialista ya se encuentra registrado en ese juzgado.');
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

  // =========================================================================
  // PANTALLA DE CARGA O LOGIN DE SEGURIDAD
  // =========================================================================
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
            <p className="text-xs text-stone-400 mt-1">
              Acceso Restringido • Sistema de Gestión Procesal
            </p>
          </div>

          <form onSubmit={manejarLogin} className="p-8 space-y-5">
            {errorLogin && (
              <div className="bg-red-50 border border-red-200 text-red-900 text-xs font-medium p-3.5 rounded-lg">
                ⚠️ {errorLogin}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-stone-600 mb-1.5">
                Correo Electrónico Institucional
              </label>
              <input
                type="email"
                required
                placeholder="abogada@almonacidlaw.com"
                value={emailLogin}
                onChange={(e) => setEmailLogin(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-amber-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-stone-600 mb-1.5">
                Contraseña de Acceso
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordLogin}
                onChange={(e) => setPasswordLogin(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-amber-600"
              />
            </div>

            <button
              type="submit"
              disabled={iniciandoSesion}
              className="w-full bg-stone-900 hover:bg-stone-800 text-amber-400 font-bold py-3 rounded-lg text-sm transition cursor-pointer disabled:opacity-50"
            >
              {iniciandoSesion ? 'Autenticando...' : 'Ingresar al Sistema →'}
            </button>

            <p className="text-[11px] text-center text-stone-400 pt-2">
              Protegido por Row Level Security (RLS) y secreto profesional.
            </p>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================================
  // APLICACIÓN PRINCIPAL (USUARIO AUTENTICADO)
  // =========================================================================
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
              <span className="text-lg font-bold tracking-tight text-white">
                ONE LAW • GESTIÓN PROCESAL
              </span>
            </div>
          </div>

          {/* PESTAÑAS DE MÓDULOS */}
          <div className="flex flex-wrap items-center gap-1.5 bg-stone-800 p-1 rounded-lg">
            <button
              onClick={() => setVistaActiva('cartera')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                vistaActiva === 'cartera'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Cartera ({expedientesAutorizados.length})
            </button>
            <button
              onClick={() => setVistaActiva('agenda')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                vistaActiva === 'agenda'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Agenda y Plazos ({metricas.tareasPendientes})
            </button>
            <button
              onClick={() => setVistaActiva('directorio')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                vistaActiva === 'directorio'
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              Directorio Juzgados ({directorio.length})
            </button>
            {perfilActual.rol === 'Administradora' && (
              <button
                onClick={() => setVistaActiva('equipo')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                  vistaActiva === 'equipo'
                    ? 'bg-amber-500 text-stone-950'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                Permisos y Equipo ({listaColaboradoras.length})
              </button>
            )}
          </div>

          {/* PERFIL ACTIVO Y BOTÓN NUEVO EXPEDIENTE */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-white block">
                {perfilActual.nombre_completo}
              </span>
              <span className="text-[11px] text-amber-400 font-semibold">
                {perfilActual.rol}
              </span>
            </div>

            <button
              onClick={() => {
                setNuevoNombres('');
                setNuevoNumExp('');
                setNuevoJuzgado('');
                setNuevaMateria('');
                setNuevaEtapa('');
                setNuevaTareaDesc('');
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
        {/* TARJETAS DE RESUMEN (KPIs) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-xs uppercase tracking-wider text-stone-500 font-semibold">
              Cartera Autorizada
            </span>
            <div className="text-3xl font-bold text-stone-900 mt-1">{metricas.total}</div>
            <span className="text-xs text-stone-500">Vista según tu rol activo</span>
          </div>
          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-xs uppercase tracking-wider text-emerald-700 font-semibold">
              Procesos Activos
            </span>
            <div className="text-3xl font-bold text-emerald-800 mt-1">{metricas.activos}</div>
            <span className="text-xs text-stone-500">En litigio / ejecución</span>
          </div>
          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-xs uppercase tracking-wider text-amber-700 font-semibold">
              Actuaciones Pendientes
            </span>
            <div className="text-3xl font-bold text-amber-800 mt-1">
              {metricas.tareasPendientes}
            </div>
            <span className="text-xs text-stone-500">Audiencias, plazos y CEJ</span>
          </div>
          <div className="bg-white border border-stone-200 p-5 rounded-xl shadow-xs">
            <span className="text-xs uppercase tracking-wider text-stone-600 font-semibold">
              Alertas por Auditar
            </span>
            <div className="text-3xl font-bold text-stone-800 mt-1">{metricas.conAlertas}</div>
            <span className="text-xs text-stone-500">Observaciones de migración</span>
          </div>
        </div>

        {/* =========================================================
            VISTA 1: CARTERA DE EXPEDIENTES
           ========================================================= */}
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

              <div className="flex items-center gap-2">
                {(['Todos', 'Activo', 'Concluido'] as const).map((estado) => (
                  <button
                    key={estado}
                    onClick={() => setFiltroEstado(estado)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      filtroEstado === estado
                        ? 'bg-stone-900 text-amber-400'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {estado === 'Todos' ? 'Todos' : `${estado}s`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-stone-200 rounded-xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-stone-100 text-stone-700 border-b border-stone-200 uppercase text-xs">
                      <th className="p-4 font-semibold">Estado</th>
                      <th className="p-4 font-semibold">Patrocinado / Partes</th>
                      <th className="p-4 font-semibold">Expediente & Juzgado</th>
                      <th className="p-4 font-semibold">Materia & Etapa Actual</th>
                      <th className="p-4 font-semibold">Próxima Actuación</th>
                      <th className="p-4 font-semibold text-right">Ficha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {expedientesFiltrados.map((exp) => {
                      const tareasPend = exp.tareas?.filter((t) => t.estado === 'Pendiente') || [];
                      const primeraTarea = tareasPend[0];

                      return (
                        <tr
                          key={exp.id}
                          onClick={() => abrirFicha(exp)}
                          className="hover:bg-amber-50/40 transition-colors align-top cursor-pointer"
                        >
                          <td className="p-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                exp.estado_administrativo === 'Activo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-200 text-stone-700'
                              }`}
                            >
                              {exp.estado_administrativo}
                            </span>
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
                            <div className="text-xs text-stone-500 mt-1 font-medium">
                              {exp.juzgado}
                            </div>
                          </td>
                          <td className="p-4 max-w-xs">
                            <div className="font-semibold text-stone-800 text-xs uppercase">
                              {exp.materia}
                            </div>
                            <div className="text-xs text-stone-600 mt-1 line-clamp-2">
                              {exp.etapa_procesal}
                            </div>
                          </td>
                          <td className="p-4 max-w-sm">
                            {primeraTarea ? (
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 mb-1">
                                  {primeraTarea.tipo}
                                </span>
                                <p className="text-xs text-stone-700 line-clamp-2">
                                  {primeraTarea.descripcion}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-stone-400 italic">
                                Al día / Sin pendientes
                              </span>
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

        {/* =========================================================
            VISTA 2: AGENDA PROCESAL Y CONTROL DE PLAZOS
           ========================================================= */}
        {vistaActiva === 'agenda' && (
          <div>
            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs mb-6 flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Control de Actuaciones, Audiencias y Seguimientos CEJ
                </h2>
                <p className="text-xs text-stone-500">
                  Marca la casilla cuando hayas cumplido la diligencia o revisado el expediente en el CEJ.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Todas', 'Audiencia', 'Plazo por verificar', 'Plazo procesal', 'Seguimiento interno'].map(
                  (tipo) => (
                    <button
                      key={tipo}
                      onClick={() => setFiltroTipoTarea(tipo)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        filtroTipoTarea === tipo
                          ? 'bg-stone-900 text-amber-400'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {tipo}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-3">
              {todasLasTareas.map((t) => (
                <div
                  key={t.id}
                  className={`bg-white border rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition ${
                    t.estado === 'Completado'
                      ? 'border-stone-200 opacity-60'
                      : t.tipo.includes('Plazo') || t.tipo === 'Audiencia'
                      ? 'border-amber-300'
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
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                            t.tipo === 'Audiencia'
                              ? 'bg-red-100 text-red-800'
                              : t.tipo.includes('Plazo')
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {t.tipo}
                        </span>
                        {t.fecha_programada && (
                          <span className="text-xs font-mono font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                            📅 Fecha límite: {t.fecha_programada}
                          </span>
                        )}
                        <span className="text-xs font-mono text-amber-800 font-semibold">
                          {t.expediente.numero_expediente || 'S/N'}
                        </span>
                      </div>

                      <p
                        className={`text-sm font-medium ${
                          t.estado === 'Completado' ? 'line-through text-stone-400' : 'text-stone-900'
                        }`}
                      >
                        {t.descripcion}
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        Patrocinado: <strong className="text-stone-700">{t.expediente.nombres}</strong> •{' '}
                        {t.expediente.juzgado} ({t.expediente.materia})
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => abrirFicha(t.expediente)}
                    className="text-xs font-semibold text-stone-700 hover:text-stone-950 bg-stone-100 hover:bg-stone-200 px-3 py-1.5 rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Ver Expediente →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            VISTA 3: DIRECTORIO DE JUZGADOS Y ESPECIALISTAS
           ========================================================= */}
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
                <div
                  key={item.id}
                  className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 inline-block mb-2">
                      {item.juzgado}
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">
                      Especialista: {item.especialista || 'No especificado'}
                    </h3>
                    <p className="text-xs text-stone-600 mt-2 font-mono bg-stone-50 p-2.5 rounded border border-stone-200">
                      📞 {item.notas || 'Sin datos de anexo'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================
            VISTA 4: GESTIÓN DE EQUIPO Y ROLES (SOLO ADMINISTRADORA)
           ========================================================= */}
        {vistaActiva === 'equipo' && perfilActual.rol === 'Administradora' && (
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-stone-900 mb-1">
              Control de Acceso y Roles del Estudio
            </h2>
            <p className="text-xs text-stone-500 mb-6">
              Gestiona qué usuarias tienen rango de Administradora (acceso total) o Abogada Colaboradora (acceso a casos asignados).
            </p>

            <div className="space-y-3">
              {listaColaboradoras.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-xl bg-stone-50 border border-stone-200 gap-4"
                >
                  <div>
                    <span className="font-bold text-sm text-stone-900 block">
                      {u.nombre_completo}
                    </span>
                    <span className="text-xs text-stone-500">{u.email}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <select
                      value={u.rol}
                      onChange={(e) =>
                        cambiarRolMiembro(
                          u.id,
                          e.target.value as 'Administradora' | 'Abogada Colaboradora'
                        )
                      }
                      className="border border-stone-300 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white"
                    >
                      <option value="Administradora">Administradora (Acceso Total)</option>
                      <option value="Abogada Colaboradora">Abogada Colaboradora</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          PANEL LATERAL (SLIDE-OVER): FICHA DETALLADA DEL EXPEDIENTE
         ========================================================= */}
      {expSeleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-[#FAF9F6] w-full max-w-2xl h-full shadow-2xl border-l border-stone-200 flex flex-col overflow-hidden">
            <div className="bg-stone-900 text-white p-6 flex justify-between items-start">
              <div>
                <span className="text-[11px] uppercase tracking-widest text-amber-400 font-semibold">
                  Ficha Técnica de Proceso • {expSeleccionado.materia}
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
                    <strong className="block font-bold mb-0.5">
                      ⚠️ Observación detectada en la auditoría:
                    </strong>
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

              {/* SECCIÓN 1: ESTADO, ETAPA Y ASIGNACIÓN */}
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
                      <button
                        onClick={() => setEditandoFicha(false)}
                        className="text-xs text-stone-500 hover:text-stone-800 px-2 py-1"
                      >
                        Cancelar
                      </button>
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
                      <span className="font-bold text-stone-900">
                        {expSeleccionado.estado_administrativo}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-stone-400 block">Juzgado / Dependencia</span>
                      <span className="font-semibold text-stone-800">{expSeleccionado.juzgado}</span>
                    </div>
                    <div>
                      <span className="text-xs text-stone-400 block">Responsable Asignada</span>
                      <span className="font-semibold text-amber-800">
                        {expSeleccionado.abogada_asignada || 'Todo el Estudio'}
                      </span>
                    </div>
                    <div className="md:col-span-3">
                      <span className="text-xs text-stone-400 block">Etapa Procesal / Estado Actual</span>
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
                        <label className="font-semibold text-stone-600 block mb-1">
                          Estado Administrativo
                        </label>
                        <select
                          value={fichaEstadoAdmin}
                          onChange={(e) =>
                            setFichaEstadoAdmin(e.target.value as 'Activo' | 'Concluido')
                          }
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
                        <label className="font-semibold text-stone-600 block mb-1">
                          Asignar Abogada
                        </label>
                        <select
                          value={fichaAsignada}
                          onChange={(e) => setFichaAsignada(e.target.value)}
                          disabled={perfilActual.rol !== 'Administradora'}
                          className="w-full border border-stone-300 rounded-lg p-2 bg-white disabled:opacity-60"
                        >
                          <option value="Todo el Estudio">Todo el Estudio</option>
                          {listaColaboradoras.map((col) => (
                            <option key={col.id} value={col.email}>
                              {col.nombre_completo} ({col.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="font-semibold text-stone-600 block mb-1">
                        Etapa Procesal / Estado Actual
                      </label>
                      <textarea
                        rows={2}
                        value={fichaEtapa}
                        onChange={(e) => setFichaEtapa(e.target.value)}
                        className="w-full border border-stone-300 rounded-lg p-2 uppercase"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-stone-600 block mb-1">
                        Resultado / Sentencia Final (Opcional)
                      </label>
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

              {/* SECCIÓN 2: TAREAS Y PLAZOS */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">
                  2. Control de Actuaciones y Plazos ({expSeleccionado.tareas?.length || 0})
                </h3>

                <div className="space-y-2.5 mb-5">
                  {expSeleccionado.tareas && expSeleccionado.tareas.length > 0 ? (
                    expSeleccionado.tareas.map((tarea) => (
                      <div
                        key={tarea.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-stone-50 border border-stone-200"
                      >
                        <input
                          type="checkbox"
                          checked={tarea.estado === 'Completado'}
                          onChange={() => cambiarEstadoTarea(tarea)}
                          className="mt-1 cursor-pointer accent-stone-900"
                        />
                        <div className="flex-1 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                              {tarea.tipo}
                            </span>
                            {tarea.fecha_programada && (
                              <span className="font-mono text-stone-600">
                                📅 {tarea.fecha_programada}
                              </span>
                            )}
                          </div>
                          <p
                            className={
                              tarea.estado === 'Completado'
                                ? 'line-through text-stone-400'
                                : 'text-stone-800 font-medium'
                            }
                          >
                            {tarea.descripcion}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400 italic">
                      No hay actuaciones registradas para este expediente.
                    </p>
                  )}
                </div>

                <form
                  onSubmit={agregarTareaEnFicha}
                  className="border-t border-stone-200 pt-4 space-y-3 text-xs"
                >
                  <span className="font-bold text-stone-700 block">
                    + Programar Nueva Actuación o Plazo
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Descripción de la tarea o diligencia"
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
                      <option value="Seguimiento interno">Seguimiento interno</option>
                      <option value="Plazo procesal">Plazo procesal</option>
                      <option value="Audiencia">Audiencia</option>
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
                      Añadir Tarea
                    </button>
                  </div>
                </form>
              </div>

              {/* SECCIÓN 3: REPOSITORIO DE RESOLUCIONES Y ANEXOS */}
              <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">
                  3. Anexos Judiciales, Cédulas y Resoluciones (
                  {expSeleccionado.documentos_expediente?.length || 0})
                </h3>

                <div className="space-y-2 mb-4">
                  {expSeleccionado.documentos_expediente &&
                  expSeleccionado.documentos_expediente.length > 0 ? (
                    expSeleccionado.documentos_expediente.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex justify-between items-center p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-amber-900 block">
                            📄 {doc.nombre_archivo}
                          </span>
                          <span className="text-[11px] text-stone-500">{doc.tipo_documento}</span>
                        </div>
                        <a
                          href={doc.url_archivo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white border border-stone-300 hover:border-stone-500 text-stone-800 font-semibold px-3 py-1.5 rounded-lg"
                        >
                          Ver / Descargar ↗
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400 italic">
                      Sin documentos adjuntos en este expediente.
                    </p>
                  )}
                </div>

                <div className="border-t border-stone-200 pt-4 text-xs">
                  <label className="font-bold text-stone-700 block mb-2">
                    Subir PDF o Captura de Resolución CEJ
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={tipoDocSubida}
                      onChange={(e) => setTipoDocSubida(e.target.value)}
                      className="border border-stone-300 rounded-lg p-2 bg-white"
                    >
                      <option value="Resolución / Cédula CEJ">Resolución / Cédula CEJ</option>
                      <option value="Escrito Presentado / Cargo">Escrito Presentado / Cargo</option>
                      <option value="Acta de Audiencia / Conciliación">
                        Acta de Audiencia / Conciliación
                      </option>
                      <option value="Depósito Judicial / Liquidación">
                        Depósito Judicial / Liquidación
                      </option>
                    </select>
                    <label className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold rounded-lg p-2 text-center cursor-pointer">
                      {subiendoArchivo ? 'Subiendo archivo...' : 'Seleccionar Archivo (PDF / Imagen)'}
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={manejarSubidaArchivo}
                        disabled={subiendoArchivo}
                        className="hidden"
                      />
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
            <h3 className="text-lg font-bold text-stone-900 mb-4">
              Registrar Especialista en Directorio
            </h3>
            {errorDirectorio && (
              <div className="bg-red-50 border border-red-200 text-red-900 text-xs p-3 rounded-lg mb-4">
                {errorDirectorio}
              </div>
            )}
            <form onSubmit={guardarContactoDirectorio} className="space-y-4 text-xs">
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">
                  Juzgado / Dependencia *
                </label>
                <input
                  type="text"
                  required
                  value={dirJuzgado}
                  onChange={(e) => setDirJuzgado(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg p-2.5 uppercase"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">
                  Nombre del Especialista *
                </label>
                <input
                  type="text"
                  required
                  value={dirEspecialista}
                  onChange={(e) => setDirEspecialista(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg p-2.5 uppercase"
                />
              </div>
              <div>
                <label className="font-bold uppercase text-stone-600 block mb-1">
                  Teléfono / Anexo / Celular *
                </label>
                <input
                  type="text"
                  required
                  value={dirNotas}
                  onChange={(e) => setDirNotas(e.target.value)}
                  className="w-full border border-stone-300 rounded-lg p-2.5 uppercase"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalDirAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-stone-900 text-amber-400 font-semibold px-4 py-2 rounded-lg cursor-pointer"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NUEVO EXPEDIENTE */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-2xl w-full p-6 md:p-8 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-stone-200 pb-4 mb-6">
              <div>
                <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
                  Registro Validado
                </span>
                <h2 className="text-xl font-bold text-stone-900">Ingresar Nuevo Expediente</h2>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="text-stone-400 hover:text-stone-700 text-lg font-bold px-2"
              >
                ✕
              </button>
            </div>

            {errorFormulario && (
              <div className="bg-red-50 border border-red-200 text-red-900 text-xs font-medium p-3.5 rounded-lg mb-5">
                {errorFormulario}
              </div>
            )}

            <form onSubmit={guardarNuevoExpediente} className="space-y-5 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Patrocinado / Partes del Proceso *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoNombres}
                    onChange={(e) => setNuevoNombres(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    N° de Expediente / Carpeta Fiscal
                  </label>
                  <input
                    type="text"
                    value={nuevoNumExp}
                    onChange={(e) => setNuevoNumExp(e.target.value)}
                    className={`w-full border rounded-lg px-3.5 py-2 font-mono uppercase ${
                      expedienteDuplicado
                        ? 'border-red-500 bg-red-50 text-red-900'
                        : 'border-stone-300'
                    }`}
                  />
                  {expedienteDuplicado && (
                    <p className="text-xs text-red-700 font-semibold mt-1">
                      ⚠️ Duplicado: Ya pertenece a {expedienteDuplicado.nombres}.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Responsable Asignada
                  </label>
                  <select
                    value={nuevaAsignada}
                    onChange={(e) => setNuevaAsignada(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3.5 py-2 bg-white"
                  >
                    <option value="Todo el Estudio">Todo el Estudio</option>
                    {listaColaboradoras.map((col) => (
                      <option key={col.id} value={col.email}>
                        {col.nombre_completo} ({col.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Juzgado / Dependencia *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoJuzgado}
                    onChange={(e) => setNuevoJuzgado(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Materia *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevaMateria}
                    onChange={(e) => setNuevaMateria(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Etapa Procesal Inicial
                  </label>
                  <input
                    type="text"
                    value={nuevaEtapa}
                    onChange={(e) => setNuevaEtapa(e.target.value)}
                    className="w-full border border-stone-300 rounded-lg px-3.5 py-2 uppercase"
                  />
                </div>
              </div>

              <div className="border-t border-stone-200 pt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-lg border border-stone-300 text-stone-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoNuevo || !!expedienteDuplicado}
                  className="bg-stone-900 text-amber-400 font-semibold px-6 py-2 rounded-lg disabled:opacity-50 cursor-pointer"
                >
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