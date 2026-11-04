import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Falta configurar GEMINI_API_KEY en el archivo .env.local' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString('base64');

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: file.type || 'application/pdf',
          },
        },
        `Eres un asistente jurídico experto en el Poder Judicial y Ministerio Público del Perú (CEJ / SINOE).
        Analiza este documento judicial (resolución, cédula de notificación, cargo de ingreso de escrito o captura) y extrae los datos exactos en MAYÚSCULAS para registrar el expediente.
        Si algún dato no aparece explícitamente, devuelve una cadena vacía "".`,
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nombres: {
              type: Type.STRING,
              description: 'Nombres completos del patrocinado o partes (Ej. PEREZ GOMEZ JUAN - LOPEZ MARIA)',
            },
            numero_expediente: {
              type: Type.STRING,
              description: 'Código completo del expediente judicial o carpeta fiscal (Ej. 01234-2026-0-1501-JP-FC-01)',
            },
            juzgado: {
              type: Type.STRING,
              description: 'Juzgado, Sala o Fiscalía (Ej. 1° JPL EL TAMBO, 3° JIP HUANCAYO)',
            },
            materia: {
              type: Type.STRING,
              description: 'Materia del proceso (Ej. ALIMENTOS, OAF, DIVORCIO POR CAUSAL, VIOLENCIA)',
            },
            etapa_procesal: {
              type: Type.STRING,
              description: 'Resumen breve de lo que resuelve o estado actual (Ej. ADMITEN DEMANDA, CITAN A AUDIENCIA)',
            },
            proxima_actuacion: {
              type: Type.STRING,
              description: 'Tarea, requerimiento, plazo o audiencia ordenada por el juzgado',
            },
            tipo_tarea: {
              type: Type.STRING,
              description: 'Clasificar exactamente en: "Audiencia", "Plazo procesal" o "Seguimiento interno"',
            },
            fecha_programada: {
              type: Type.STRING,
              description: 'Fecha de audiencia o vencimiento si existe, en formato YYYY-MM-DD, o vacío ""',
            },
            especialista: {
              type: Type.STRING,
              description: 'Nombre del especialista legal o secretario de juzgado si figura en la cédula',
            },
          },
          required: [
            'nombres',
            'numero_expediente',
            'juzgado',
            'materia',
            'etapa_procesal',
            'proxima_actuacion',
            'tipo_tarea',
            'fecha_programada',
            'especialista',
          ],
        },
      },
    });

    const datosExtraidos = JSON.parse(response.text || '{}');
    return NextResponse.json(datosExtraidos);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al procesar el documento con IA.' },
      { status: 500 }
    );
  }
}