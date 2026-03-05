export interface Factura {
  transaccionId: string;
  fecha: string; // formato DD-MM-YYYY
  mes: string;  // formato MM-YYYY extraído de fecha
  cliente: string;
  vendedor: string;
  producto: string;
  total: number;
  totalBruto: number;
  totalConceptos: number;
  cantidad: number;
  estado: string;
  condicionPago: string;
  moneda: string;
  importePendiente: number;
  comprobante: string;
  descripcion: string;
  numeroContrato: string;
  dimensionValor: string;
  empresa: string;
  // nivel1dimension: string;
  // nivel2dimension: string;
  // importeMonSecundaria: number;
  [key: string]: any;
}