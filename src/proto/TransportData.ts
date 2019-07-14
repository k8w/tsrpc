/**
 * 基础的数据传输单元
 */

/**
 * [ ServiceID, Buffer, SN? ]
 */
export type ServerInputData = [uint, Uint8Array, uint?];

/**
 * ApiRes: [ ServiceID, ResBuffer, undefined, SN ] | [ ServiceID, undefined, ApiError, SN ]
 * Msg: [ ServiceID, Buffer ]
 */
export type ServerOutputData = [uint, Uint8Array?, ApiError?, uint?];

export interface ApiError {
    message: string,
    info?: any
}