export type LegalDocType = 'privacy' | 'terms';

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
};

const privacyEn: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: 'May 25, 2026',
  sections: [
    {
      title: 'Overview',
      paragraphs: [
        'RepRight (“we”, “our”, “the app”) is a mobile fitness application developed as part of academic research at Universidad Iberoamericana (UNIBE). This policy explains what information we collect, how we use it, and your choices.',
        'By creating an account or using RepRight, you agree to this Privacy Policy.',
      ],
    },
    {
      title: 'Information we collect',
      paragraphs: [
        'Account information: email address, display name, and authentication provider (email/password, Sign in with Apple, or Google) when you register.',
        'Workout and performance data: exercise type, sets, reps, weights, form scores, completion percentages, timestamps, and detected biomechanical error types during live sessions.',
        'App preferences: language, weight unit, audio feedback setting, and optional profile photo stored locally on your device.',
        'Camera data: live video frames are processed on your device for pose estimation. We do not upload raw camera video or photos to our servers.',
        'Guest mode: if you use the app without an account, workout history may be stored only on your device. Anonymous guest identifiers may be logged server-side for research participation counts (no personal contact information).',
        'Technical data: standard service logs from our hosting providers (Supabase) such as IP address, device type, and crash/diagnostic events necessary to operate the service.',
      ],
    },
    {
      title: 'How we use your information',
      paragraphs: [
        'Provide real-time form analysis and voice/visual feedback during workouts.',
        'Save session history and statistics on your device and, when signed in, sync summaries to your account in our cloud database.',
        'Authenticate you and secure your account.',
        'Improve the app and support academic research on exercise form analysis (aggregated or de-identified where possible).',
        'Respond to support requests.',
      ],
    },
    {
      title: 'Third-party services',
      paragraphs: [
        'We use Supabase (database and authentication) to store account and synced workout data. Supabase processes data according to its privacy policy: https://supabase.com/privacy',
        'Sign in with Apple and Google Sign-In are provided by Apple and Google respectively; those providers receive authentication tokens according to their own policies.',
        'We do not sell your personal information. We do not use advertising trackers or sell data to data brokers.',
      ],
    },
    {
      title: 'Data retention',
      paragraphs: [
        'Account and synced workout data are kept while your account is active.',
        'Local session history on your device remains until you delete the app, clear app data, or delete your account.',
        'When you delete your account (Profile → Delete account), we remove your profile, synced sessions, and statistics from our servers.',
      ],
    },
    {
      title: 'Your rights and account deletion',
      paragraphs: [
        'You can delete your account at any time from Profile → Delete account in the app. This permanently removes your cloud data and auth account.',
        'You may also contact us to request access, correction, or deletion of your data.',
        'Depending on your location, you may have additional privacy rights under applicable law.',
      ],
    },
    {
      title: 'Children',
      paragraphs: [
        'RepRight is not directed at children under 13. We do not knowingly collect personal information from children under 13.',
      ],
    },
    {
      title: 'Security',
      paragraphs: [
        'We use industry-standard measures including encrypted connections (HTTPS/TLS) and row-level security in our database so users can only access their own data.',
        'No method of transmission or storage is 100% secure; use the app at your own discretion.',
      ],
    },
    {
      title: 'Contact',
      paragraphs: [
        'Questions about this policy or your data: repright.support@unibe.edu.do',
        'RepRight — Universidad Iberoamericana (UNIBE), Santo Domingo, Dominican Republic.',
      ],
    },
  ],
};

const privacyEs: LegalDocument = {
  title: 'Política de Privacidad',
  lastUpdated: '25 de mayo de 2026',
  sections: [
    {
      title: 'Resumen',
      paragraphs: [
        'RepRight (“nosotros”, “la app”) es una aplicación móvil de fitness desarrollada en el marco de investigación académica en la Universidad Iberoamericana (UNIBE). Esta política explica qué información recopilamos, cómo la usamos y tus opciones.',
        'Al crear una cuenta o usar RepRight, aceptas esta Política de Privacidad.',
      ],
    },
    {
      title: 'Información que recopilamos',
      paragraphs: [
        'Datos de cuenta: correo electrónico, nombre para mostrar y proveedor de autenticación (correo/contraseña, Iniciar sesión con Apple o Google) cuando te registras.',
        'Datos de entrenamiento y rendimiento: tipo de ejercicio, series, repeticiones, pesos, puntuaciones de forma, porcentajes de finalización, marcas de tiempo y tipos de errores biomecánicos detectados durante sesiones en vivo.',
        'Preferencias de la app: idioma, unidad de peso, retroalimentación por voz y foto de perfil opcional almacenada localmente en tu dispositivo.',
        'Datos de cámara: los fotogramas de video se procesan en tu dispositivo para estimar la pose. No subimos video ni fotos de la cámara a nuestros servidores.',
        'Modo invitado: si usas la app sin cuenta, el historial puede guardarse solo en tu dispositivo. Identificadores anónimos de invitados pueden registrarse en el servidor para conteos de participación en investigación (sin datos de contacto personales).',
        'Datos técnicos: registros estándar de nuestros proveedores (Supabase), como dirección IP, tipo de dispositivo y eventos necesarios para operar el servicio.',
      ],
    },
    {
      title: 'Cómo usamos tu información',
      paragraphs: [
        'Ofrecer análisis de forma en tiempo real y retroalimentación por voz/visual durante entrenamientos.',
        'Guardar historial de sesiones y estadísticas en tu dispositivo y, si iniciaste sesión, sincronizar resúmenes con tu cuenta en la nube.',
        'Autenticarte y proteger tu cuenta.',
        'Mejorar la app y apoyar la investigación académica sobre análisis de forma (de forma agregada o anonimizada cuando sea posible).',
        'Responder solicitudes de soporte.',
      ],
    },
    {
      title: 'Servicios de terceros',
      paragraphs: [
        'Usamos Supabase (base de datos y autenticación) para almacenar datos de cuenta y entrenamientos sincronizados. Supabase procesa datos según su política: https://supabase.com/privacy',
        'Iniciar sesión con Apple y Google los proporcionan Apple y Google respectivamente.',
        'No vendemos tu información personal. No usamos rastreadores publicitarios ni vendemos datos a intermediarios.',
      ],
    },
    {
      title: 'Conservación de datos',
      paragraphs: [
        'Los datos de cuenta y entrenamientos sincronizados se conservan mientras tu cuenta esté activa.',
        'El historial local en tu dispositivo permanece hasta que elimines la app, borres datos de la app o elimines tu cuenta.',
        'Al eliminar tu cuenta (Perfil → Eliminar cuenta), removemos tu perfil, sesiones sincronizadas y estadísticas de nuestros servidores.',
      ],
    },
    {
      title: 'Tus derechos y eliminación de cuenta',
      paragraphs: [
        'Puedes eliminar tu cuenta en cualquier momento desde Perfil → Eliminar cuenta en la app. Esto elimina permanentemente tus datos en la nube y tu cuenta de autenticación.',
        'También puedes contactarnos para solicitar acceso, corrección o eliminación de tus datos.',
        'Según tu ubicación, puedes tener derechos adicionales bajo la ley aplicable.',
      ],
    },
    {
      title: 'Menores',
      paragraphs: [
        'RepRight no está dirigida a menores de 13 años. No recopilamos intencionalmente información personal de menores de 13 años.',
      ],
    },
    {
      title: 'Seguridad',
      paragraphs: [
        'Usamos medidas estándar como conexiones cifradas (HTTPS/TLS) y seguridad a nivel de fila en la base de datos para que cada usuario acceda solo a sus datos.',
        'Ningún método de transmisión o almacenamiento es 100% seguro.',
      ],
    },
    {
      title: 'Contacto',
      paragraphs: [
        'Preguntas sobre esta política o tus datos: repright.support@unibe.edu.do',
        'RepRight — Universidad Iberoamericana (UNIBE), Santo Domingo, República Dominicana.',
      ],
    },
  ],
};

const termsEn: LegalDocument = {
  title: 'Terms of Use',
  lastUpdated: 'May 25, 2026',
  sections: [
    {
      title: 'Acceptance',
      paragraphs: [
        'These Terms of Use (“Terms”) govern your access to and use of the RepRight mobile application. By using RepRight, you agree to these Terms and our Privacy Policy.',
      ],
    },
    {
      title: 'Not medical advice',
      paragraphs: [
        'RepRight provides automated feedback on exercise form for informational and educational purposes only.',
        'RepRight is not a medical device and does not provide medical advice, diagnosis, or treatment.',
        'Always consult a qualified healthcare or fitness professional before starting or changing an exercise program, especially if you have injuries, pain, or medical conditions.',
      ],
    },
    {
      title: 'Assumption of risk',
      paragraphs: [
        'Weight training and deadlifting involve inherent risks of injury. You are solely responsible for your safety, equipment setup, load selection, and exercise execution.',
        'You use RepRight at your own risk. We are not liable for injuries, property damage, or losses arising from your use of the app or reliance on its feedback.',
      ],
    },
    {
      title: 'Account and acceptable use',
      paragraphs: [
        'You must provide accurate account information and keep your credentials secure.',
        'You may not misuse the app, attempt unauthorized access, reverse engineer the software, or use the app for unlawful purposes.',
        'We may suspend or terminate access for violations of these Terms.',
      ],
    },
    {
      title: 'Intellectual property',
      paragraphs: [
        'RepRight, its branding, software, and content are owned by the developers and UNIBE research project contributors. You receive a limited, non-exclusive license to use the app for personal, non-commercial purposes.',
      ],
    },
    {
      title: 'Disclaimer of warranties',
      paragraphs: [
        'RepRight is provided “as is” and “as available” without warranties of any kind, including accuracy of pose detection or form scoring.',
        'Computer vision may fail due to lighting, camera angle, clothing, or device limitations.',
      ],
    },
    {
      title: 'Limitation of liability',
      paragraphs: [
        'To the maximum extent permitted by law, RepRight and its developers shall not be liable for indirect, incidental, special, consequential, or punitive damages, or any loss of data, profits, or goodwill.',
      ],
    },
    {
      title: 'Changes',
      paragraphs: [
        'We may update these Terms from time to time. Continued use after changes constitutes acceptance of the updated Terms.',
      ],
    },
    {
      title: 'Contact',
      paragraphs: ['Questions: repright.support@unibe.edu.do'],
    },
  ],
};

const termsEs: LegalDocument = {
  title: 'Términos de Uso',
  lastUpdated: '25 de mayo de 2026',
  sections: [
    {
      title: 'Aceptación',
      paragraphs: [
        'Estos Términos de Uso (“Términos”) regulan tu acceso y uso de la aplicación móvil RepRight. Al usar RepRight, aceptas estos Términos y nuestra Política de Privacidad.',
      ],
    },
    {
      title: 'No es asesoramiento médico',
      paragraphs: [
        'RepRight ofrece retroalimentación automatizada sobre la forma del ejercicio solo con fines informativos y educativos.',
        'RepRight no es un dispositivo médico y no proporciona asesoramiento, diagnóstico ni tratamiento médico.',
        'Consulta siempre a un profesional de salud o fitness calificado antes de iniciar o modificar un programa de ejercicio, especialmente si tienes lesiones, dolor o condiciones médicas.',
      ],
    },
    {
      title: 'Asunción de riesgo',
      paragraphs: [
        'El entrenamiento con pesas y el peso muerto conllevan riesgos inherentes de lesión. Eres el único responsable de tu seguridad, configuración del equipo, selección de carga y ejecución del ejercicio.',
        'Usas RepRight bajo tu propio riesgo. No somos responsables de lesiones, daños a la propiedad o pérdidas derivadas del uso de la app o de confiar en su retroalimentación.',
      ],
    },
    {
      title: 'Cuenta y uso aceptable',
      paragraphs: [
        'Debes proporcionar información de cuenta precisa y mantener tus credenciales seguras.',
        'No debes hacer un uso indebido de la app, intentar acceso no autorizado, ingeniería inversa del software ni usar la app con fines ilegales.',
        'Podemos suspender o terminar el acceso por violaciones de estos Términos.',
      ],
    },
    {
      title: 'Propiedad intelectual',
      paragraphs: [
        'RepRight, su marca, software y contenido pertenecen a los desarrolladores y colaboradores del proyecto de investigación UNIBE. Recibes una licencia limitada, no exclusiva, para uso personal y no comercial.',
      ],
    },
    {
      title: 'Exclusión de garantías',
      paragraphs: [
        'RepRight se proporciona “tal cual” y “según disponibilidad” sin garantías de ningún tipo, incluida la precisión de la detección de pose o puntuación de forma.',
        'La visión por computadora puede fallar por iluminación, ángulo de cámara, ropa o limitaciones del dispositivo.',
      ],
    },
    {
      title: 'Limitación de responsabilidad',
      paragraphs: [
        'En la máxima medida permitida por la ley, RepRight y sus desarrolladores no serán responsables de daños indirectos, incidentales, especiales, consecuentes o punitivos, ni de pérdida de datos, beneficios o reputación.',
      ],
    },
    {
      title: 'Cambios',
      paragraphs: [
        'Podemos actualizar estos Términos ocasionalmente. El uso continuado después de los cambios constituye aceptación de los Términos actualizados.',
      ],
    },
    {
      title: 'Contacto',
      paragraphs: ['Preguntas: repright.support@unibe.edu.do'],
    },
  ],
};

export function getLegalDocument(type: LegalDocType, language: 'en' | 'es'): LegalDocument {
  if (type === 'privacy') return language === 'es' ? privacyEs : privacyEn;
  return language === 'es' ? termsEs : termsEn;
}
