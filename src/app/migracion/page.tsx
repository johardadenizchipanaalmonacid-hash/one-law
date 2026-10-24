'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lip/supabase';
import Link from 'next/link';

export default function MigracionSeguraPage() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [totalExistentes, setTotalExistentes] = useState(0);

  useEffect(() => {
    const verificarAcceso = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setAutorizado(false);
        return;
      }

      const { count } = await supabase
        .from('expedientes')
        .select('*', { count: 'exact', head: true });

      setTotalExistentes(count || 0);
      setAutorizado(true);
    };

    verificarAcceso();
  }, []);

  if (autorizado === null) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center text-sm text-stone-600">
        Verificando permisos de administradora...
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white border border-stone-200 p-8 rounded-2xl max-w-md shadow-sm">
          <h1 className="text-lg font-bold text-stone-900 mb-2">Acceso Restringido</h1>
          <p className="text-xs text-stone-600 mb-6">
            Debes iniciar sesión en el panel principal antes de acceder a la herramienta de migración.
          </p>
          <Link
            href="/"
            className="bg-stone-900 text-amber-400 text-xs font-bold px-5 py-2.5 rounded-lg inline-block"
          >
            Ir al Login Principal →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-stone-800 p-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white border border-stone-200 rounded-2xl p-8 shadow-xs">
        <span className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
          Almonacid Law Firm • Auditoría de Base de Datos
        </span>
        <h1 className="text-2xl font-bold text-stone-900 mt-1">
          Estado de la Migración Inicial
        </h1>
        <p className="text-sm text-stone-600 mt-2">
          La cartera histórica ya se encuentra activa y sincronizada en Supabase PostgreSQL.
        </p>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 my-6">
          <div className="text-sm font-bold text-emerald-950">
            ✓ Base de datos poblada ({totalExistentes} expedientes registrados)
          </div>
          <p className="text-xs text-emerald-800 mt-1">
            Por seguridad e integridad de datos, la importación masiva desde Excel ha quedado bloqueada para prevenir duplicidad de expedientes. Todos los nuevos casos deben ingresarse desde el botón "+ Nuevo Caso" en el panel principal.
          </p>
        </div>

        <Link
          href="/"
          className="bg-stone-900 hover:bg-stone-800 text-amber-400 text-xs font-bold px-6 py-3 rounded-lg inline-block transition"
        >
          ← Volver al Panel Principal de One Law
        </Link>
      </div>
    </div>
  );
}