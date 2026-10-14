/**
 * API Forge - Política de Seguridad y Prevención de SSRF (Fase 1A)
 * Valida protocolos, resuelve nombres DNS y bloquea destinos privados, loopback y metadatos cloud.
 */

import net from 'net';
import dns from 'dns';

export interface SecurityPolicyOptions {
  allowLoopbackForTesting?: boolean;
}

export class SecurityError extends Error {
  public readonly code: 'FORBIDDEN_PROTOCOL' | 'SSRF_BLOCKED' | 'DNS_RESOLUTION_FAILED';

  constructor(message: string, code: 'FORBIDDEN_PROTOCOL' | 'SSRF_BLOCKED' | 'DNS_RESOLUTION_FAILED') {
    super(message);
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Convierte cualquier representación de IPv4 (decimal, octal, hex o dword) a entero de 32 bits
 * Retorna null si no es una dirección IPv4 válida
 */
export function parseIPv4ToNumber(ipStr: string): number | null {
  // Limpiar espacios y corchetes
  const clean = ipStr.trim().replace(/^\[|\]$/g, '');

  // Caso 1: Entero decimal único (dword) ej: "2130706433"
  if (/^\d+$/.test(clean)) {
    const num = Number(clean);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return num >>> 0;
    }
  }

  // Caso 2: Hexadecimal único ej: "0x7f000001"
  if (/^0x[0-9a-fA-F]+$/i.test(clean)) {
    const num = Number(clean);
    if (!isNaN(num) && num >= 0 && num <= 0xffffffff) {
      return num >>> 0;
    }
  }

  // Caso 3: Cuartetos con punto ej: "127.0.0.1", "0177.0.0.1", "0x7f.0.0.1"
  const parts = clean.split('.');
  if (parts.length === 4) {
    let result = 0;
    for (let i = 0; i < 4; i++) {
      const part = parts[i].trim();
      let val: number;

      if (/^0x[0-9a-fA-F]+$/i.test(part)) {
        val = parseInt(part, 16);
      } else if (/^0\d+$/.test(part)) {
        // Notación octal
        val = parseInt(part, 8);
      } else if (/^\d+$/.test(part)) {
        val = parseInt(part, 10);
      } else {
        return null;
      }

      if (isNaN(val) || val < 0 || val > 255) {
        return null;
      }

      result = ((result << 8) | val) >>> 0;
    }
    return result;
  }

  return null;
}

/**
 * Determina si una dirección IPv4 (como número de 32 bits) es privada, loopback o reservada
 */
export function isForbiddenIPv4(ipNum: number, allowLoopback: boolean = false): { forbidden: boolean; reason?: string } {
  const p0 = (ipNum >>> 24) & 0xff;
  const p1 = (ipNum >>> 16) & 0xff;
  const p2 = (ipNum >>> 8) & 0xff;

  // 0.0.0.0/8 (Origen / esta red)
  if (p0 === 0) {
    return { forbidden: true, reason: 'Dirección de red actual / 0.0.0.0 no permitida' };
  }

  // 127.0.0.0/8 (Loopback)
  if (p0 === 127) {
    if (allowLoopback) {
      return { forbidden: false };
    }
    return { forbidden: true, reason: 'Dirección loopback local (127.0.0.0/8) bloqueada por seguridad' };
  }

  // 10.0.0.0/8 (Red privada RFC 1918)
  if (p0 === 10) {
    return { forbidden: true, reason: 'Red privada local (10.0.0.0/8) no permitida' };
  }

  // 172.16.0.0/12 (Red privada RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (p0 === 172 && p1 >= 16 && p1 <= 31) {
    return { forbidden: true, reason: 'Red privada local (172.16.0.0/12) no permitida' };
  }

  // 192.168.0.0/16 (Red privada RFC 1918)
  if (p0 === 192 && p1 === 168) {
    return { forbidden: true, reason: 'Red privada local (192.168.0.0/16) no permitida' };
  }

  // 169.254.0.0/16 (Link-local y servicio de metadatos cloud: 169.254.169.254)
  if (p0 === 169 && p1 === 254) {
    return { forbidden: true, reason: 'Dirección link-local o metadatos de nube (169.254.0.0/16) bloqueada' };
  }

  // 100.64.0.0/10 (Carrier Grade NAT)
  if (p0 === 100 && p1 >= 64 && p1 <= 127) {
    return { forbidden: true, reason: 'Rango Carrier Grade NAT (100.64.0.0/10) bloqueado' };
  }

  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (p0 === 192 && p1 === 0 && p2 === 0) {
    return { forbidden: true, reason: 'Rango IETF reservado (192.0.0.0/24) bloqueado' };
  }

  // 192.0.2.0/24 (TEST-NET-1)
  if (p0 === 192 && p1 === 0 && p2 === 2) {
    return { forbidden: true, reason: 'Rango de documentación TEST-NET-1 bloqueado' };
  }

  // 198.18.0.0/15 (Benchmarking)
  if (p0 === 198 && (p1 === 18 || p1 === 19)) {
    return { forbidden: true, reason: 'Rango de benchmarking (198.18.0.0/15) bloqueado' };
  }

  // 198.51.100.0/24 (TEST-NET-2)
  if (p0 === 198 && p1 === 51 && p2 === 100) {
    return { forbidden: true, reason: 'Rango de documentación TEST-NET-2 bloqueado' };
  }

  // 203.0.113.0/24 (TEST-NET-3)
  if (p0 === 203 && p1 === 0 && p2 === 113) {
    return { forbidden: true, reason: 'Rango de documentación TEST-NET-3 bloqueado' };
  }

  // 224.0.0.0/4 (Multicast 224-239 y Reservado 240-255)
  if (p0 >= 224) {
    return { forbidden: true, reason: 'Rango Multicast o Reservado (224.0.0.0+) bloqueado' };
  }

  return { forbidden: false };
}

/**
 * Determina si una dirección IPv6 es privada, loopback o reservada
 */
export function isForbiddenIPv6(ip: string, allowLoopback: boolean = false): { forbidden: boolean; reason?: string } {
  const normalized = ip.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    if (allowLoopback) {
      return { forbidden: false };
    }
    return { forbidden: true, reason: 'Dirección IPv6 loopback (::1) bloqueada por seguridad' };
  }

  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
    return { forbidden: true, reason: 'Dirección IPv6 no especificada (::) bloqueada' };
  }

  // IPv4-mapped IPv6 ej: ::ffff:127.0.0.1 o ::ffff:7f00:1
  if (normalized.startsWith('::ffff:') || normalized.startsWith('0:0:0:0:0:ffff:')) {
    const parts = normalized.split(':');
    const lastPart = parts[parts.length - 1];

    // Si tiene formato de IPv4 al final (ej: 127.0.0.1)
    const ipv4Num = parseIPv4ToNumber(lastPart);
    if (ipv4Num !== null) {
      return isForbiddenIPv4(ipv4Num, allowLoopback);
    }
  }

  // Unique Local Addresses (fc00::/7 -> fc.. o fd..)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return { forbidden: true, reason: 'Dirección IPv6 privada (fc00::/7) bloqueada' };
  }

  // Link-Local (fe80::/10 -> fe8, fe9, fea, feb)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized)) {
    return { forbidden: true, reason: 'Dirección IPv6 link-local (fe80::/10) bloqueada' };
  }

  // Multicast (ff00::/8)
  if (/^ff[0-9a-f]{2}:/i.test(normalized)) {
    return { forbidden: true, reason: 'Dirección IPv6 multicast (ff00::/8) bloqueada' };
  }

  return { forbidden: false };
}

/**
 * Valida un nombre de host o dirección IP
 */
export function isForbiddenHostOrIp(host: string, allowLoopback: boolean = false): { forbidden: boolean; reason?: string } {
  const cleanHost = host.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // 1. Hostnames prohibidos explícitos
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost === 'metadata.google.internal' ||
    cleanHost === 'metadata' ||
    cleanHost === 'instance-data'
  ) {
    if (allowLoopback && (cleanHost === 'localhost' || cleanHost.endsWith('.localhost'))) {
      return { forbidden: false };
    }
    return { forbidden: true, reason: `Nombre de host interno '${cleanHost}' bloqueado por seguridad (SSRF)` };
  }

  // 2. Comprobar si es IPv4
  const ipv4Num = parseIPv4ToNumber(cleanHost);
  if (ipv4Num !== null) {
    return isForbiddenIPv4(ipv4Num, allowLoopback);
  }

  // 3. Comprobar si es IPv6
  if (net.isIPv6(cleanHost) || cleanHost.includes(':')) {
    return isForbiddenIPv6(cleanHost, allowLoopback);
  }

  return { forbidden: false };
}

/**
 * Política Central de Seguridad para Solicitudes HTTP
 */
export class SecurityPolicy {
  private readonly allowLoopback: boolean;

  constructor(options?: SecurityPolicyOptions) {
    this.allowLoopback = options?.allowLoopbackForTesting === true;
  }

  /**
   * Valida el protocolo de la URL (únicamente http: y https:)
   */
  public validateProtocol(parsedUrl: URL): void {
    const protocol = parsedUrl.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new SecurityError(
        `Protocolo '${protocol}' no permitido. API Forge únicamente admite 'http:' y 'https:'.`,
        'FORBIDDEN_PROTOCOL'
      );
    }
  }

  /**
   * Valida la URL completa antes de iniciar cualquier conexión
   */
  public async validateUrl(urlStr: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new SecurityError(`La URL '${urlStr}' no es una dirección válida.`, 'SSRF_BLOCKED');
    }

    // 1. Validar protocolo
    this.validateProtocol(parsed);

    const hostname = parsed.hostname;

    // 2. Validar sintaxis directa del host
    const directCheck = isForbiddenHostOrIp(hostname, this.allowLoopback);
    if (directCheck.forbidden) {
      throw new SecurityError(
        `Destino bloqueado por política SSRF: ${directCheck.reason || hostname}`,
        'SSRF_BLOCKED'
      );
    }

    // 3. Resolución DNS y verificación de todas las direcciones IP resultantes
    // Si el hostname es una IP literal válida, no es necesario hacer DNS lookup
    if (net.isIP(hostname) === 0) {
      try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        if (!addresses || addresses.length === 0) {
          throw new SecurityError(`No se pudo resolver el nombre de host '${hostname}'`, 'DNS_RESOLUTION_FAILED');
        }

        for (const addr of addresses) {
          const ipCheck = addr.family === 6
            ? isForbiddenIPv6(addr.address, this.allowLoopback)
            : (() => {
                const num = parseIPv4ToNumber(addr.address);
                return num !== null ? isForbiddenIPv4(num, this.allowLoopback) : { forbidden: true, reason: 'IP inválida' };
              })();

          if (ipCheck.forbidden) {
            throw new SecurityError(
              `Destino bloqueado por política SSRF: ${hostname} resuelve a dirección restringida (${addr.address})`,
              'SSRF_BLOCKED'
            );
          }
        }
      } catch (dnsErr) {
        if (dnsErr instanceof SecurityError) {
          throw dnsErr;
        }
        throw new SecurityError(
          `Fallo al resolver DNS para '${hostname}': ${dnsErr instanceof Error ? dnsErr.message : String(dnsErr)}`,
          'DNS_RESOLUTION_FAILED'
        );
      }
    }

    return parsed;
  }

  /**
   * Proporciona una función de lookup personalizada para sockets Node.js
   * Evita ataques de DNS Rebinding al validar la IP en el instante exacto de conexión del socket
   */
  public createSafeLookup() {
    const allowLoopback = this.allowLoopback;

    return (
      hostname: string,
      options: dns.LookupOptions,
      callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
    ) => {
      dns.lookup(hostname, options, (err, address, family) => {
        if (err) {
          return callback(err, address, family);
        }

        const addressesToCheck: string[] = Array.isArray(address)
          ? address.map((a) => a.address)
          : [address as string];

        for (const ip of addressesToCheck) {
          const isV6 = net.isIPv6(ip);
          const check = isV6
            ? isForbiddenIPv6(ip, allowLoopback)
            : (() => {
                const num = parseIPv4ToNumber(ip);
                return num !== null ? isForbiddenIPv4(num, allowLoopback) : { forbidden: true, reason: 'IP inválida' };
              })();

          if (check.forbidden) {
            const ssrfErr = new Error(`Conexión abortada por protección SSRF: dirección prohibida detectada en socket (${ip})`);
            return callback(ssrfErr as NodeJS.ErrnoException, address, family);
          }
        }

        callback(null, address, family);
      });
    };
  }
}

export const defaultSecurityPolicy = new SecurityPolicy();
