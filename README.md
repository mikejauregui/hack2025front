Aplicación Full-Stack de Pagos con Validación Biométrica

Propósito General

Esta es una aplicación full-stack de demostración que ilustra un flujo completo para la creación de pagos seguros. El proceso captura un monto desde una interfaz web, autoriza la transacción mediante validación biométrica (reconocimiento facial y de voz) y procesa el pago final a través del servicio de OpenPayments.

Flujo de Funcionamiento

El proyecto se divide en dos componentes principales: la interfaz de usuario (frontend) y el servidor (backend).

1. Frontend (Interfaz de Usuario)

La interfaz de usuario es responsable de capturar la intención de pago y la identidad del usuario.

Permite al usuario ingresar un monto y la moneda deseada.

Inicia el proceso de identificación y validación del usuario.

Captura los datos biométricos:

Reconocimiento facial (foto / video).

Huella de voz (nota de voz).

Utiliza "Speech-to-Text" para transcribir la nota de voz, añadiendo una capa de validación contextual.

Muestra mensajes de estado en tiempo real y la respuesta detallada del pago devuelta por OpenPayments al finalizar la transacción.

2. Backend (Lógica del Servidor)

El backend recibe la información del frontend, la valida y procesa el pago de forma segura.

Recepción de Datos

El servidor espera recibir la siguiente información:

Monto y moneda de la transacción.

Datos biométricos (archivo de foto/video y nota de voz).

Transcripción de la nota de voz (generada por Speech-to-Text).

Validación y Procesamiento

Una vez recibidos los datos, el backend ejecuta los siguientes pasos:

Validación de Cuentas: Verifica las wallets involucradas y los payment grants existentes.

Verificación de Balance 

Autenticación Biométrica (AWS Rekognition):

Compara los datos biométricos (foto/video) del usuario con los registros de identidad almacenados.

Decisión: Si el reconocimiento facial y de voz coinciden con la identidad del propietario de la cuenta, el pago se aprueba y procesa.

Rechazo: Si no hay coincidencia o la validación falla, el pago se rechaza antes de ejecutarse.

Instrucciones de Ejecución

Para ejecutar la aplicación en un entorno de desarrollo, sigue estos pasos:

# 1. Instalar todas las dependencias del proyecto
npm install

# 2. Iniciar el servidor de desarrollo
npm run dev