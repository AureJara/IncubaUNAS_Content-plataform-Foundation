import Ajv2020Import, { type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';

// Ambos paquetes son CommonJS con `export default`: en ESM estricto el import por defecto ya es la
// función o clase, pero los tipos lo describen como el módulo completo. Se normaliza en un solo lugar.
type Interop<T> = T extends { default: infer D } ? D : T;

export const Ajv2020 = Ajv2020Import as unknown as Interop<typeof Ajv2020Import>;
export const addFormats = addFormatsImport as unknown as Interop<typeof addFormatsImport>;
export type { ValidateFunction };
