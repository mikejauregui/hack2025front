# Demo Pagos OpenPayments + Reconocimiento Facial

Aplicación full-stack mínima que ilustra cómo capturar un monto desde una interfaz web, validarlo mediante reconocimiento facial (simulado) y crear un intento de pago contra el servicio de OpenPayments.

## Estructura del proyecto

- `backend`: API REST en Node.js + Express con TypeScript.
- `frontend`: Aplicación React + Vite.

## Requisitos

- Node.js >= 18
- npm >= 9

## Configuración

### Backend

1. Copia el archivo de variables de entorno:
   ```bash
   cd backend
   cp env.example .env
   ```
2. Ajusta los valores según tus credenciales:
   - `PORT`: Puerto del servidor Express.
   - `CLIENT_ORIGIN`: URL permitida para CORS (por defecto el puerto de Vite).
   - `OPENPAYMENTS_BASE_URL`: Endpoint base del servicio OpenPayments.
   - `OPENPAYMENTS_API_KEY`: Token de autenticación proporcionado por OpenPayments.
3. Instala dependencias y levanta el servidor:
   ```bash
   npm install
   npm run dev
   ```

El endpoint principal se expone en `POST /api/payments` y espera:

```json
{
  "amount": 49.99,
  "currency": "USD",
  "userId": "usuario-123",
  "faceAuthToken": "valid-abcdef"
}
```

El controlador verifica el token biométrico a través de `FaceAuthService`. La implementación actual es un stub que debe reemplazarse cuando se integre el proveedor real de reconocimiento facial (SDK/REST que el usuario compartirá).

### Frontend

1. Configura la URL del backend creando el archivo `.env`:
   ```bash
   cd frontend
   cp env.example .env
   ```
2. Instala dependencias y ejecuta la app:
   ```bash
   npm install
   npm run dev
   ```

La UI permite:
- Ingresar monto y moneda.
- Identificar al usuario (`userId`).
- Capturar el token de reconocimiento facial (`faceAuthToken`), que en esta fase simula el resultado del proveedor biométrico.
- Mostrar mensajes de estado y detalles del intento de pago devuelto por OpenPayments.

## Próximos pasos sugeridos

- Sustituir `FaceAuthService` por la integración real una vez que se disponga del SDK o API externo.
- Mapear los endpoints reales de OpenPayments dentro de `OpenPaymentsService`.
- Agregar manejo de errores más detallado (por ejemplo, códigos específicos del proveedor de pagos).
- Implementar persistencia para almacenar logs/auditorías de las solicitudes aceptadas y rechazadas.


