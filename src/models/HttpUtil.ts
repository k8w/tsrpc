import * as http from "http"

export class HttpUtil {
  static getClientIp(req: http.IncomingMessage) {
    var ipAddress
    // The request may be forwarded from local web server.
    var forwardedIpsStr = req.headers["x-forwarded-for"] as string | undefined
    if (forwardedIpsStr) {
      // 'x-forwarded-for' header may return multiple IP addresses in
      // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
      // the first one
      var forwardedIps = forwardedIpsStr.split(",")
      ipAddress = forwardedIps[0]
    }
    if (!ipAddress) {
      // If request was not forwarded
      ipAddress = req.connection.remoteAddress
    }
    // Remove prefix ::ffff:
    return ipAddress ? ipAddress.replace(/^::ffff:/, "") : ""
  }
}
