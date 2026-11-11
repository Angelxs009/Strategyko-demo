// Nombres legibles de los puertos más comunes (UN/LOCODE). Si no está, se devuelve el código.
export const PORT_NAMES: Record<string, string> = {
  CNSHA: 'Shanghái',
  CNNGB: 'Ningbo',
  CNSZX: 'Shenzhen',
  CNTAO: 'Qingdao',
  ECGYE: 'Guayaquil',
};

export const portName = (code: string): string => PORT_NAMES[code] ?? code;
