
Aplicación full-stack mínima que ilustra cómo capturar un monto desde una interfaz web, validarlo mediante reconocimiento facial y crear un pago con el servicio de OpenPayments.

Para ejecutar la app corre:
   npm install
   npm run dev

La UI permite:
- Ingresar monto y moneda.
- Identificar al usuario.
- Capturar el reconocimiento facial y la huella de voz, además de hacer speech to text para hacer una validación extra.
- Mostrar mensajes de estado y detalles del pago devuelto por OpenPayments.

El back recibe:
- Monto.
- Currency.
- Face recognition, foto/video del usuario.
- Nota de voz.
- Transcript de la nota de voz (Speech to text).

El back valida & procesa:
- Wallets involucradas
- Payment grants
- AWS Rekognition: Valida foto/video y determina si el usuario coincide con los records, si coincide se procesa el pago, si no hay coincidencia se rechaza el pago.
- Balance


