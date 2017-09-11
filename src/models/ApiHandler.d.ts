import ApiRequest from './ApiRequest';
import ApiResponse from "./ApiResponse";
import { NextFunction } from "express";

export default interface ApiHandler<Req, Res> {
    (req: ApiRequest<Req>, res: ApiResponse<Res>): any;
}