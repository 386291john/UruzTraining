# Requirements Document

## Introduction

Aplicación web integral de gestión de membresías de gimnasio que permite a administradores e instructores registrar miembros (afiliados), gestionar planes de suscripción, controlar el ingreso al gimnasio mediante documento de identidad y PIN, rastrear vencimientos de planes, enviar recordatorios de renovación vía WhatsApp, y visualizar tableros operacionales e informes. El sistema está construido con Next.js, Supabase, y desplegado en los niveles gratuitos de Vercel.

## Glossary

- **Sistema**: La aplicación web de gestión de membresías de gimnasio en su totalidad
- **Afiliado**: Un miembro registrado del gimnasio con un plan de membresía activo o vencido
- **Administrador**: Un rol de usuario con acceso completo a todas las funcionalidades del sistema incluyendo capacidades de eliminación
- **Instructor**: Un rol de usuario que puede registrar afiliados, renovar membresías, registrar ingresos y ver historial, pero no puede eliminar información
- **Plan**: Un paquete de suscripción que define días de ingreso permitidos, ventana de consumo (semanas) y precio
- **Vigencia**: El período de tiempo (en semanas) durante el cual un afiliado debe consumir sus días permitidos del plan
- **Ingreso**: Un evento único de acceso al gimnasio registrado cuando un afiliado se presenta usando documento de identidad y PIN
- **PIN**: Un número de identificación personal de 4 dígitos usado por los afiliados para autenticación de ingreso al gimnasio
- **Documento_ID**: Un número de identificación único emitido por el gobierno para cada afiliado
- **Tablero**: La pantalla principal de resumen operacional que muestra métricas clave y alertas
- **Renovación**: El proceso de extender o cambiar el plan de membresía de un afiliado
- **Regla_Inicio_Fin_de_Semana**: Una regla configurable que retrasa el inicio de vigencia del plan al siguiente lunes cuando un plan es adquirido en viernes, sábado o domingo
- **Servicio_Notificaciones**: Una interfaz de mensajería abstracta para enviar recordatorios vía WhatsApp u otros proveedores
- **RLS**: Row Level Security, el mecanismo de Supabase para restringir el acceso a datos a nivel de fila en la base de datos

## Requirements

### Requisito 1: Autenticación de Usuarios

**Historia de Usuario:** Como usuario del sistema, quiero iniciar sesión de forma segura con mis credenciales, para poder acceder al sistema según mi rol asignado.

#### Criterios de Aceptación

1. WHEN un usuario envía su correo electrónico y contraseña válidos, THE Sistema SHALL autenticar al usuario vía Supabase Auth y redirigir al Tablero en un máximo de 3 segundos
2. WHEN un usuario envía credenciales inválidas, THE Sistema SHALL mostrar un mensaje de error indicando fallo de autenticación sin revelar cuál campo es incorrecto
3. THE Sistema SHALL aplicar control de acceso basado en roles distinguiendo entre los roles Administrador (acceso completo) e Instructor (registro, renovación, check-in y consulta de historial; sin operaciones de eliminación)
4. WHILE un usuario está autenticado como Instructor, THE Sistema SHALL impedir el acceso a operaciones de eliminación en todos los módulos y mostrar un mensaje indicando permisos insuficientes
5. WHILE un usuario no está autenticado, THE Sistema SHALL redirigir todas las solicitudes a rutas protegidas hacia la página de inicio de sesión
6. WHEN la sesión de un usuario expira, THE Sistema SHALL redirigir al usuario a la página de inicio de sesión con un mensaje de expiración de sesión
7. IF un usuario falla la autenticación 5 veces consecutivas, THEN THE Sistema SHALL bloquear temporalmente los intentos de inicio de sesión para ese correo electrónico durante 15 minutos

### Requisito 2: Gestión de Planes

**Historia de Usuario:** Como instructor, quiero crear y gestionar planes de suscripción, para poder ofrecer diferentes opciones de membresía a los afiliados.

#### Criterios de Aceptación

1. WHEN un Instructor envía un formulario válido de creación de plan, THE Sistema SHALL crear un nuevo plan con los campos: nombre (máximo 100 caracteres), días permitidos (entero mayor o igual a 1, sin límite superior, o valor especial "ilimitado"), semanas de vigencia (entero mayor o igual a 1, sin límite superior), precio (valor numérico mayor o igual a 0), estado (activo o inactivo), y descripción (máximo 500 caracteres)
2. THE Sistema SHALL asociar cada plan con el Instructor que lo creó
3. WHILE un Instructor está visualizando planes, THE Sistema SHALL mostrar únicamente los planes creados por ese Instructor
4. WHILE un Administrador está visualizando planes, THE Sistema SHALL mostrar todos los planes de todos los Instructores
5. WHEN un Instructor envía una modificación de plan, THE Sistema SHALL actualizar únicamente los planes pertenecientes a ese Instructor
6. WHEN un Administrador envía una modificación de plan, THE Sistema SHALL actualizar cualquier plan sin importar la propiedad
7. IF una solicitud de creación o modificación de plan contiene campos obligatorios faltantes o valores inválidos (nombre vacío, días permitidos menor a 1, semanas de vigencia menor a 1, precio negativo), THEN THE Sistema SHALL mostrar errores de validación específicos por campo sin crear ni modificar el plan
8. WHEN el estado de un plan cambia a inactivo, THE Sistema SHALL impedir que nuevos afiliados seleccionen ese plan mientras preserva a los afiliados existentes en el plan
9. WHEN un Administrador solicita la eliminación de un plan, THE Sistema SHALL eliminar el plan únicamente si no tiene afiliados activos asociados
10. IF un Instructor intenta modificar o eliminar un plan que no le pertenece, THEN THE Sistema SHALL rechazar la operación y mostrar un error indicando permisos insuficientes

### Requisito 3: Registro de Afiliados

**Historia de Usuario:** Como instructor, quiero registrar nuevos miembros del gimnasio, para que los afiliados puedan comenzar a usar el gimnasio con su plan asignado.

#### Criterios de Aceptación

1. WHEN un Instructor envía un formulario válido de registro de afiliado, THE Sistema SHALL crear un nuevo registro de afiliado con los campos: Documento_ID, nombre completo, PIN (4 dígitos), fecha de nacimiento, número de celular, fecha de registro, plan adquirido, instructor responsable y observaciones, y mostrar una confirmación de registro exitoso con el nombre del afiliado y el plan asignado
2. IF una solicitud de registro contiene un Documento_ID que ya existe, THEN THE Sistema SHALL rechazar el registro y mostrar un error de documento duplicado sin modificar el registro existente
3. THE Sistema SHALL validar que el campo PIN contenga exactamente 4 dígitos numéricos (0000–9999)
4. THE Sistema SHALL asignar automáticamente la fecha actual como fecha de registro
5. THE Sistema SHALL asignar automáticamente al Instructor autenticado como instructor responsable
6. IF una solicitud de registro contiene campos obligatorios faltantes o con formato inválido (Documento_ID: entre 5 y 15 caracteres numéricos; nombre completo: entre 3 y 100 caracteres; PIN: exactamente 4 dígitos numéricos; fecha de nacimiento: fecha válida no futura; número de celular: entre 7 y 15 dígitos; plan: selección requerida), THEN THE Sistema SHALL mostrar errores de validación específicos por cada campo que no cumpla su regla
7. WHEN un registro de afiliado se crea exitosamente, THE Sistema SHALL calcular la fecha de inicio de vigencia y la fecha de vencimiento del plan adquirido aplicando las reglas de cálculo de vigencia definidas en el Requisito 5
8. IF un Instructor intenta seleccionar un plan con estado inactivo durante el registro, THEN THE Sistema SHALL impedir la selección y mostrar únicamente los planes con estado activo en la lista de planes disponibles
9. THE Sistema SHALL limitar el campo de observaciones a un máximo de 500 caracteres

### Requisito 4: Búsqueda de Afiliados

**Historia de Usuario:** Como instructor, quiero buscar afiliados por diferentes criterios, para poder encontrar rápidamente la información de los miembros.

#### Criterios de Aceptación

1. WHEN un Instructor o Administrador ingresa un término de búsqueda de al menos 3 caracteres en el campo de Documento_ID, THE Sistema SHALL retornar afiliados cuyo Documento_ID contenga la secuencia ingresada (coincidencia parcial)
2. WHEN un Instructor o Administrador ingresa un término de búsqueda de al menos 3 caracteres en el campo de nombre, THE Sistema SHALL retornar afiliados cuyo nombre completo contenga el término de búsqueda (sin distinción de mayúsculas y minúsculas)
3. WHEN un Instructor o Administrador ingresa un término de búsqueda de al menos 3 caracteres en el campo de número de celular, THE Sistema SHALL retornar afiliados cuyo número de celular contenga la secuencia ingresada (coincidencia parcial)
4. WHILE un Instructor está realizando una búsqueda, THE Sistema SHALL limitar los resultados a los afiliados asignados a ese Instructor
5. WHILE un Administrador está realizando una búsqueda, THE Sistema SHALL retornar afiliados de todos los Instructores sin restricción de propiedad
6. WHEN una búsqueda retorna resultados, THE Sistema SHALL mostrar los resultados paginados con un máximo de 20 afiliados por página, mostrando para cada resultado: nombre del afiliado, Documento_ID, nombre del plan, estado del plan y fecha de vencimiento
7. WHEN una búsqueda no retorna resultados, THE Sistema SHALL mostrar un mensaje indicando que ningún afiliado coincide con los criterios
8. IF un Instructor o Administrador envía un campo de búsqueda con menos de 3 caracteres, THEN THE Sistema SHALL mostrar un mensaje de validación indicando la cantidad mínima de caracteres requerida

### Requisito 5: Cálculo de Vigencia del Plan

**Historia de Usuario:** Como operador del sistema, quiero que el sistema calcule con precisión las fechas de inicio y vencimiento del plan, para que los afiliados tengan ventanas de acceso correctas.

#### Criterios de Aceptación

1. WHEN un afiliado adquiere un plan en lunes, martes, miércoles o jueves, THE Sistema SHALL establecer la fecha de inicio de conteo de semanas como la fecha de adquisición, y permitir el uso del plan (descuento de días) desde ese mismo momento
2. IF la Regla_Inicio_Fin_de_Semana está activa, WHEN un afiliado adquiere un plan en viernes, sábado o domingo, THEN THE Sistema SHALL establecer la fecha de inicio de conteo de semanas como el siguiente lunes, pero SHALL permitir el uso del plan (descuento de días e ingreso) desde la fecha de adquisición
3. IF la Regla_Inicio_Fin_de_Semana está inactiva, WHEN un afiliado adquiere un plan en viernes, sábado o domingo, THEN THE Sistema SHALL establecer la fecha de inicio de conteo de semanas como la fecha de adquisición
4. THE Sistema SHALL calcular la fecha de vencimiento sumando a la fecha de inicio de conteo de semanas el número de semanas de vigencia del plan multiplicado por 7 días calendario, donde la fecha de vencimiento resultante es el último día válido de acceso (inclusive hasta las 23:59:59 de ese día)
5. THE Sistema SHALL almacenar la Regla_Inicio_Fin_de_Semana como un parámetro configurable con valor por defecto activo, modificable únicamente por un Administrador
6. WHEN un Administrador modifica el parámetro de Regla_Inicio_Fin_de_Semana, THE Sistema SHALL aplicar la nueva regla únicamente a los planes adquiridos después de la fecha y hora de modificación, preservando las fechas de vigencia de los planes existentes sin recalcular
7. WHEN un afiliado usa el plan durante el fin de semana previo al inicio del conteo de semanas (Regla_Inicio_Fin_de_Semana activa), THE Sistema SHALL descontar los días utilizados del total de días permitidos del plan, reduciendo el saldo disponible para las semanas de vigencia

### Requisito 6: Control de Ingreso

**Historia de Usuario:** Como afiliado, quiero registrar mi ingreso al gimnasio usando mi documento y PIN, para que mi asistencia quede registrada y pueda confirmar el estado de mi membresía.

#### Criterios de Aceptación

1. WHEN un afiliado envía un Documento_ID válido y un PIN que coincide, THE Sistema SHALL registrar el ingreso con la fecha y hora actual, descontar un día disponible del plan (excepto en planes ilimitados donde no se descuenta), y mostrar: mensaje de bienvenida con el nombre del afiliado, nombre del plan, días restantes o "ilimitado" (reflejando el valor posterior al descuento) y fecha de vencimiento
2. IF un afiliado envía un Documento_ID con un PIN que no coincide, THEN THE Sistema SHALL mostrar un error de autenticación, bloquear el registro de ingreso, e incrementar el contador de intentos fallidos para ese Documento_ID
3. IF un afiliado acumula 3 intentos fallidos consecutivos de PIN para el mismo Documento_ID, THEN THE Sistema SHALL bloquear los intentos de ingreso para ese Documento_ID durante 15 minutos y mostrar un mensaje indicando el bloqueo temporal
4. IF un afiliado intenta ingresar con un plan vencido (la fecha actual es posterior a la fecha de vencimiento), THEN THE Sistema SHALL mostrar un mensaje indicando membresía vencida y bloquear el registro de ingreso
5. IF un afiliado intenta ingresar con cero días restantes (aplica solo a planes con días limitados), THEN THE Sistema SHALL mostrar un mensaje indicando que no hay días disponibles y bloquear el registro de ingreso
6. IF un afiliado intenta un segundo ingreso en el mismo día calendario (zona horaria local del gimnasio), THEN THE Sistema SHALL mostrar un mensaje indicando ingreso ya registrado y bloquear el ingreso duplicado
7. IF un afiliado envía un Documento_ID que no existe, THEN THE Sistema SHALL mostrar un mensaje indicando afiliado no encontrado y bloquear el registro de ingreso
8. THE Sistema SHALL ejecutar las validaciones de ingreso en el siguiente orden de prioridad: existencia del afiliado, coincidencia de PIN, vigencia del plan, días restantes disponibles, y duplicidad de ingreso en el día

### Requisito 7: Gestión de PIN

**Historia de Usuario:** Como instructor, quiero actualizar el PIN de un afiliado cuando se pierde, para que el afiliado pueda recuperar el acceso de ingreso.

#### Criterios de Aceptación

1. WHEN un Instructor o Administrador envía una solicitud de actualización de PIN para un afiliado, THE Sistema SHALL actualizar el PIN del afiliado al nuevo valor de 4 dígitos sin requerir el PIN anterior, y mostrar una confirmación de actualización exitosa
2. THE Sistema SHALL validar que el nuevo PIN contenga exactamente 4 dígitos numéricos (0000–9999) antes de actualizar
3. IF una solicitud de actualización de PIN contiene un formato de PIN inválido, THEN THE Sistema SHALL mostrar un error de validación especificando el requisito de 4 dígitos numéricos
4. IF una solicitud de actualización de PIN se realiza para un Documento_ID que no existe, THEN THE Sistema SHALL mostrar un error indicando que el afiliado no fue encontrado

### Requisito 8: Renovación de Membresía

**Historia de Usuario:** Como instructor, quiero renovar la membresía de un afiliado desde su perfil, para que el afiliado pueda continuar accediendo al gimnasio con un plan nuevo o modificado.

#### Criterios de Aceptación

1. WHEN un Instructor envía una renovación para un afiliado, THE Sistema SHALL crear un nuevo período de membresía con el plan seleccionado, aplicando las reglas de cálculo de vigencia (Requisito 5), independientemente de si el período anterior ha vencido o aún tiene días restantes
2. WHEN un Instructor cambia el plan asignado durante la renovación, THE Sistema SHALL aplicar los días permitidos y semanas de vigencia del nuevo plan
3. WHEN un Instructor cambia el instructor responsable durante la renovación, THE Sistema SHALL actualizar el campo de instructor responsable del afiliado
4. THE Sistema SHALL almacenar el historial completo de renovaciones incluyendo: plan anterior, plan nuevo, fecha de renovación, instructor que realiza la operación, días restantes no utilizados del plan anterior y observaciones (máximo 500 caracteres)
5. THE Sistema SHALL preservar todos los registros históricos de renovaciones sin permitir eliminación
6. WHEN una renovación se completa, THE Sistema SHALL reiniciar los días restantes del afiliado a los días permitidos del nuevo plan, recalcular la fecha de vencimiento, y mostrar una confirmación indicando el nuevo plan, días disponibles y fecha de vencimiento
7. IF un Instructor selecciona un plan con estado inactivo durante la renovación, THEN THE Sistema SHALL rechazar la operación y mostrar un mensaje de error indicando que el plan seleccionado no está disponible

### Requisito 9: Notificaciones de Vencimiento

**Historia de Usuario:** Como administrador, quiero que el sistema notifique a los afiliados antes de que su membresía venza, para que puedan renovar a tiempo.

#### Criterios de Aceptación

1. THE Sistema SHALL ejecutar una verificación diaria de todas las membresías activas en busca de próximos vencimientos, a una hora configurable por el Administrador (por defecto: 06:00 hora local del servidor)
2. WHEN la membresía de un afiliado está dentro del umbral configurable de notificación (por defecto: 2 días antes del vencimiento), THE Sistema SHALL mostrar una alerta de renovación en el Tablero incluyendo: nombre del afiliado, nombre del plan, fecha de vencimiento y días restantes hasta el vencimiento
3. WHEN la membresía de un afiliado está dentro del umbral de notificación, THE Sistema SHALL enviar un único mensaje de WhatsApp al número de teléfono registrado del afiliado por cada período de vencimiento, evitando envíos duplicados en verificaciones posteriores
4. THE Sistema SHALL usar una plantilla de mensaje configurable de máximo 1024 caracteres para los mensajes de notificación, soportando marcadores de posición para nombre del afiliado y fecha de vencimiento
5. THE Sistema SHALL implementar el Servicio_Notificaciones como una interfaz abstracta que permita la sustitución de proveedor (Twilio, Meta API) sin modificar la lógica de negocio
6. IF la entrega de una notificación de WhatsApp falla, THEN THE Sistema SHALL reintentar el envío hasta un máximo de 3 intentos con intervalos de 5 minutos, y si todos los intentos fallan, registrar la falla con Documento_ID del afiliado, número de teléfono, fecha de vencimiento e información del error para revisión del administrador
7. IF un afiliado dentro del umbral de notificación no tiene número de celular registrado, THEN THE Sistema SHALL omitir el envío de WhatsApp y registrar la omisión con el Documento_ID del afiliado para revisión del administrador

### Requisito 10: Tablero de Control

**Historia de Usuario:** Como administrador o instructor, quiero ver un tablero de resumen operacional, para poder monitorear la actividad del gimnasio y acciones pendientes de un vistazo.

#### Criterios de Aceptación

1. THE Sistema SHALL mostrar en el Tablero: conteo total de afiliados, conteo de afiliados activos, conteo de afiliados vencidos, conteo de ingresos del día, conteo de renovaciones pendientes (afiliados cuya membresía vence dentro del umbral configurable de notificación definido en Requisito 9), lista de cumpleaños del día, y ranking de los 5 planes con mayor cantidad de afiliados activos
2. WHEN el Tablero se carga, THE Sistema SHALL consultar la base de datos y mostrar los valores calculados al momento de la carga de página, reflejando el estado actual de todas las métricas sin caché
3. WHILE un Instructor está visualizando el Tablero, THE Sistema SHALL limitar todas las métricas (conteo total, activos, vencidos, ingresos del día, renovaciones pendientes, cumpleaños y ranking de planes) exclusivamente a los afiliados asignados a ese Instructor
4. WHILE un Administrador está visualizando el Tablero, THE Sistema SHALL mostrar métricas de todos los afiliados sin importar el instructor asignado
5. IF el Sistema no puede recuperar los datos de una o más métricas del Tablero, THEN THE Sistema SHALL mostrar un indicador de error en la métrica afectada y mantener visibles las métricas que sí se cargaron correctamente

### Requisito 11: Informes y Consultas

**Historia de Usuario:** Como administrador, quiero generar informes sobre ingresos, renovaciones y estado de membresías, para poder analizar las operaciones del gimnasio y tomar decisiones informadas.

#### Criterios de Aceptación

1. WHEN un Administrador solicita un informe de historial de ingresos, THE Sistema SHALL mostrar los registros de ingreso (fecha, hora, nombre del afiliado, Documento_ID, instructor que registró) filtrados opcionalmente por rango de fechas, afiliado o instructor
2. WHEN un Administrador solicita un informe de historial de renovaciones, THE Sistema SHALL mostrar las renovaciones (fecha de renovación, nombre del afiliado, Documento_ID, plan anterior, plan nuevo, instructor que realizó la operación) filtradas opcionalmente por rango de fechas, afiliado o instructor
3. WHEN un Administrador solicita un informe de afiliados vencidos, THE Sistema SHALL mostrar todos los afiliados con membresías vencidas incluyendo: nombre completo, Documento_ID, plan, fecha de vencimiento e instructor responsable
4. WHEN un Administrador solicita un informe de afiliados activos, THE Sistema SHALL mostrar todos los afiliados con membresías válidas incluyendo: nombre completo, Documento_ID, plan, días restantes, fecha de vencimiento e instructor responsable
5. WHEN un Administrador solicita un informe de próximos a vencer, THE Sistema SHALL mostrar los afiliados cuyas membresías vencen dentro del umbral configurable de notificación incluyendo: nombre completo, Documento_ID, plan, días restantes y fecha de vencimiento
6. WHEN un Administrador solicita un informe de ingresos por día, THE Sistema SHALL mostrar conteos de ingresos agrupados por día calendario para un rango de fechas seleccionado de máximo 90 días
7. WHEN un Administrador solicita un informe de ingresos por mes, THE Sistema SHALL mostrar conteos de ingresos agrupados por mes para un rango de fechas seleccionado de máximo 12 meses
8. IF un informe no contiene registros que coincidan con los filtros aplicados, THEN THE Sistema SHALL mostrar un mensaje indicando que no se encontraron resultados para los criterios seleccionados
9. WHILE un Instructor está consultando informes, THE Sistema SHALL limitar los resultados únicamente a los afiliados e ingresos asociados a ese Instructor
10. WHEN un Administrador solicita un informe que requiere rango de fechas sin especificar fechas, THE Sistema SHALL aplicar por defecto el rango de los últimos 30 días calendario

### Requisito 12: Seguridad de Base de Datos

**Historia de Usuario:** Como administrador, quiero que el sistema aplique aislamiento de datos y seguridad a nivel de base de datos, para que se prevenga el acceso no autorizado a los datos.

#### Criterios de Aceptación

1. THE Sistema SHALL aplicar políticas de Row Level Security en todas las tablas de la base de datos, permitiendo al Administrador acceder a todos los registros y restringiendo al Instructor a visualizar y modificar únicamente los datos asociados a su usuario (planes propios, afiliados asignados, ingresos de sus afiliados)
2. THE Sistema SHALL almacenar toda configuración sensible (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY y demás claves API) en variables de entorno del servidor, no en el código fuente, y SHALL impedir la exposición de claves con permisos elevados (service role key) al cliente
3. THE Sistema SHALL validar todos los datos de entrada tanto en el cliente como en el servidor antes de las operaciones de base de datos, verificando tipos de datos, formatos requeridos y longitudes máximas según las restricciones definidas por cada campo en el esquema
4. THE Sistema SHALL sanitizar todo texto proporcionado por el usuario para prevenir ataques XSS antes de renderizar, escapando caracteres HTML en campos de texto libre
5. THE Sistema SHALL implementar protección CSRF en todos los endpoints de API que modifican estado (creación, actualización y eliminación de recursos)
6. IF ocurre un error de servidor, THEN THE Sistema SHALL registrar los detalles completos del error (traza de error, contexto de la operación y marca de tiempo) en el log del servidor y retornar un mensaje de error genérico al cliente sin exponer nombres de tablas, trazas de pila ni detalles de conexión
7. IF un Instructor intenta acceder o modificar datos pertenecientes a otro Instructor, THEN THE Sistema SHALL denegar la operación y retornar un error indicando acceso no autorizado sin revelar la existencia del recurso solicitado
8. IF la validación del servidor rechaza datos de entrada, THEN THE Sistema SHALL retornar errores específicos por campo indicando la regla de validación incumplida y SHALL impedir la ejecución de la operación de base de datos

### Requisito 13: Diseño de Interfaz de Usuario

**Historia de Usuario:** Como usuario del sistema, quiero una interfaz moderna y responsiva, para poder gestionar eficientemente las operaciones del gimnasio en cualquier dispositivo.

#### Criterios de Aceptación

1. THE Sistema SHALL renderizar un diseño responsivo usando Tailwind CSS que se adapte a pantallas de escritorio (≥1024px), tablet (641-1023px) y móvil (≤640px), garantizando que todo el contenido sea visible sin desplazamiento horizontal y que los elementos interactivos tengan un área mínima de toque de 44x44 píxeles en dispositivos móviles y tablet
2. THE Sistema SHALL proporcionar un alternador de modo oscuro que persista la preferencia del usuario entre sesiones
3. THE Sistema SHALL usar iconos de Lucide en todos los botones de acción y elementos de navegación de forma consistente en toda la interfaz
4. THE Sistema SHALL usar componentes de Shadcn UI para todos los campos de formulario, botones, diálogos y tablas de datos
5. THE Sistema SHALL aplicar animaciones de transición con una duración entre 150ms y 300ms en la navegación de páginas y cambios de estado de componentes
6. THE Sistema SHALL usar una paleta de colores claros como tema por defecto, diferenciando acciones primarias de secundarias mediante contraste, y distinguiendo encabezados del texto de cuerpo mediante tamaño y peso tipográfico
7. THE Sistema SHALL completar la carga inicial de cada página en un máximo de 3 segundos sobre una conexión de 4G estándar

### Requisito 14: Aplicación Automática de Vencimiento

**Historia de Usuario:** Como operador del sistema, quiero que las membresías venzan automáticamente cuando el período de vigencia termina, para que los afiliados no puedan acceder al gimnasio más allá de la ventana de su plan independientemente de los días restantes.

#### Criterios de Aceptación

1. WHEN la fecha actual excede la fecha de vencimiento de un afiliado, THE Sistema SHALL tratar la membresía como vencida independientemente de los días no utilizados restantes
2. WHEN una membresía se detecta como vencida y aún tiene días no utilizados restantes, THE Sistema SHALL registrar en el historial de membresía el número de días perdidos, la fecha de vencimiento y la fecha en que se detectó la expiración
3. THE Sistema SHALL evaluar la validez de la membresía en el momento del ingreso verificando: para planes con días limitados, tanto los días restantes como la fecha de vencimiento (la condición más restrictiva bloquea el ingreso); para planes ilimitados, únicamente la fecha de vencimiento
4. IF un afiliado cuya membresía venció por tiempo (con días restantes > 0) intenta ingresar, THEN THE Sistema SHALL mostrar un mensaje indicando "Membresía vencida" junto con la cantidad de días que fueron perdidos
